"""
五目並べ Policy Network の自己対戦学習。

盤面 → 次の手の確率分布 を学習する。
学習方法: 自己対戦(REINFORCE) + 勝った側の手を正解として学習。

使い方:
  python scripts/train_gomoku_nn.py [エポック数]

出力:
  scripts/gomoku_nn_weights.json (TypeScript用の重みファイル)
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
import json
import sys
import time
import random

BOARD_SIZE = 15
TOTAL_CELLS = BOARD_SIZE * BOARD_SIZE
DIRECTIONS = [(0, 1), (1, 0), (1, 1), (1, -1)]
CANDIDATE_RANGE = 2

# --- ゲームロジック ---

def check_win(board, row, col, color):
    for dr, dc in DIRECTIONS:
        count = 1
        for sign in (1, -1):
            r, c = row + sign * dr, col + sign * dc
            while 0 <= r < BOARD_SIZE and 0 <= c < BOARD_SIZE and board[r][c] == color:
                count += 1
                r += sign * dr
                c += sign * dc
        if count >= 5:
            return True
    return False

def get_valid_moves(board):
    """空きマスのうち、既存の石から2マス以内"""
    occupied = []
    for r in range(BOARD_SIZE):
        for c in range(BOARD_SIZE):
            if board[r][c] != 0:
                occupied.append((r, c))
    if not occupied:
        return [(7, 7)]

    seen = set()
    moves = []
    for sr, sc in occupied:
        for dr in range(-CANDIDATE_RANGE, CANDIDATE_RANGE + 1):
            for dc in range(-CANDIDATE_RANGE, CANDIDATE_RANGE + 1):
                if dr == 0 and dc == 0:
                    continue
                nr, nc = sr + dr, sc + dc
                if 0 <= nr < BOARD_SIZE and 0 <= nc < BOARD_SIZE and board[nr][nc] == 0:
                    key = nr * BOARD_SIZE + nc
                    if key not in seen:
                        seen.add(key)
                        moves.append((nr, nc))
    return moves

def board_to_tensor(board, current_player):
    """盤面をNN入力に変換 (3チャンネル: 自分の石, 相手の石, 手番)"""
    my_stones = np.zeros((BOARD_SIZE, BOARD_SIZE), dtype=np.float32)
    opp_stones = np.zeros((BOARD_SIZE, BOARD_SIZE), dtype=np.float32)
    turn_plane = np.full((BOARD_SIZE, BOARD_SIZE), current_player == 1, dtype=np.float32)

    for r in range(BOARD_SIZE):
        for c in range(BOARD_SIZE):
            if board[r][c] == current_player:
                my_stones[r][c] = 1.0
            elif board[r][c] != 0:
                opp_stones[r][c] = 1.0

    return np.stack([my_stones, opp_stones, turn_plane])

# --- ニューラルネットワーク ---

class GomokuPolicyNet(nn.Module):
    """盤面 → 各マスに打つ確率"""
    def __init__(self):
        super().__init__()
        # CNNベース: 盤面の空間的パターンを捉える
        self.conv1 = nn.Conv2d(3, 64, 3, padding=1)
        self.conv2 = nn.Conv2d(64, 64, 3, padding=1)
        self.conv3 = nn.Conv2d(64, 64, 3, padding=1)
        self.conv4 = nn.Conv2d(64, 32, 3, padding=1)
        self.conv_out = nn.Conv2d(32, 1, 1)  # 1チャンネル出力 → 各マスのスコア

    def forward(self, x):
        x = F.relu(self.conv1(x))
        x = F.relu(self.conv2(x))
        x = F.relu(self.conv3(x))
        x = F.relu(self.conv4(x))
        x = self.conv_out(x)  # (B, 1, 15, 15)
        x = x.view(-1, TOTAL_CELLS)  # (B, 225)
        return x  # logits (softmaxは損失関数内で適用)

# --- 自己対戦 ---

def self_play_game(model, device, temperature=1.0):
    """1局の自己対戦。盤面と手の履歴を返す。"""
    board = np.zeros((BOARD_SIZE, BOARD_SIZE), dtype=np.int8)
    history = []  # (board_tensor, action, player)
    current_player = 1  # 1=黒, -1=白

    for move_num in range(TOTAL_CELLS):
        valid_moves = get_valid_moves(board)
        if not valid_moves:
            break

        # NN推論
        state = board_to_tensor(board, current_player)
        state_tensor = torch.FloatTensor(state).unsqueeze(0).to(device)

        with torch.no_grad():
            logits = model(state_tensor).squeeze(0)

        # 合法手のマスク
        mask = torch.full((TOTAL_CELLS,), -float('inf'), device=device)
        for r, c in valid_moves:
            mask[r * BOARD_SIZE + c] = 0.0
        masked_logits = logits + mask

        # 温度付きサンプリング
        probs = F.softmax(masked_logits / temperature, dim=0)
        action = torch.multinomial(probs, 1).item()

        r, c = action // BOARD_SIZE, action % BOARD_SIZE
        history.append((state.copy(), action, current_player))

        board[r][c] = current_player
        if check_win(board, r, c, current_player):
            return history, current_player  # 勝者

        current_player = -current_player

    return history, 0  # 引き分け

def train_epoch(model, optimizer, device, num_games=100, temperature=1.0):
    """1エポック分の自己対戦+学習"""
    model.eval()

    all_states = []
    all_actions = []
    all_rewards = []

    for _ in range(num_games):
        history, winner = self_play_game(model, device, temperature)

        for state, action, player in history:
            all_states.append(state)
            all_actions.append(action)
            # 勝った側の手に正の報酬、負けた側に負の報酬
            if winner == 0:
                all_rewards.append(0.0)
            elif player == winner:
                all_rewards.append(1.0)
            else:
                all_rewards.append(-1.0)

    if not all_states:
        return 0.0

    # バッチ学習
    model.train()
    states = torch.FloatTensor(np.array(all_states)).to(device)
    actions = torch.LongTensor(all_actions).to(device)
    rewards = torch.FloatTensor(all_rewards).to(device)

    # 正の報酬の手のみで教師あり学習（勝った手を真似る）
    positive_mask = rewards > 0
    if positive_mask.sum() == 0:
        return 0.0

    logits = model(states[positive_mask])
    loss = F.cross_entropy(logits, actions[positive_mask])

    optimizer.zero_grad()
    loss.backward()
    optimizer.step()

    return loss.item()

# --- 強さ評価 ---

def evaluate_vs_random(model, device, num_games=20):
    """ランダムAIとの対戦で勝率を測定"""
    model.eval()
    wins = 0
    for i in range(num_games):
        board = np.zeros((BOARD_SIZE, BOARD_SIZE), dtype=np.int8)
        nn_player = 1 if i % 2 == 0 else -1
        current_player = 1

        for _ in range(TOTAL_CELLS):
            valid_moves = get_valid_moves(board)
            if not valid_moves:
                break

            if current_player == nn_player:
                # NN
                state = board_to_tensor(board, current_player)
                state_tensor = torch.FloatTensor(state).unsqueeze(0).to(device)
                with torch.no_grad():
                    logits = model(state_tensor).squeeze(0)
                mask = torch.full((TOTAL_CELLS,), -float('inf'), device=device)
                for r, c in valid_moves:
                    mask[r * BOARD_SIZE + c] = 0.0
                action = (logits + mask).argmax().item()
                r, c = action // BOARD_SIZE, action % BOARD_SIZE
            else:
                # ランダム
                r, c = random.choice(valid_moves)

            board[r][c] = current_player
            if check_win(board, r, c, current_player):
                if current_player == nn_player:
                    wins += 1
                break
            current_player = -current_player

    return wins / num_games

# --- 重みエクスポート ---

def export_weights(model, path):
    """モデルの重みをJSON形式でエクスポート"""
    weights = {}
    for name, param in model.named_parameters():
        weights[name] = param.detach().cpu().numpy().tolist()
    with open(path, 'w') as f:
        json.dump(weights, f)
    print(f"重みを {path} にエクスポートしました")

# --- メイン ---

def main():
    epochs = int(sys.argv[1]) if len(sys.argv) > 1 else 100
    games_per_epoch = 50
    lr = 0.001

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"デバイス: {device}", flush=True)
    print(f"エポック数: {epochs}, 対戦数/エポック: {games_per_epoch}", flush=True)
    print(flush=True)

    model = GomokuPolicyNet().to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)

    best_winrate = 0.0

    for epoch in range(1, epochs + 1):
        t0 = time.time()

        # 序盤は高温（探索重視）、後半は低温（活用重視）
        temperature = max(0.5, 2.0 - epoch * 1.5 / epochs)

        loss = train_epoch(model, optimizer, device, games_per_epoch, temperature)
        elapsed = time.time() - t0

        # 10エポックごとに強さ評価
        if epoch % 10 == 0 or epoch == 1:
            winrate = evaluate_vs_random(model, device, num_games=20)
            if winrate > best_winrate:
                best_winrate = winrate
                export_weights(model, 'scripts/gomoku_nn_weights.json')
            print(f"エポック {epoch:3d}/{epochs}: loss={loss:.4f} vs_random={winrate:.1%} best={best_winrate:.1%} temp={temperature:.2f} ({elapsed:.1f}s)", flush=True)
        else:
            print(f"エポック {epoch:3d}/{epochs}: loss={loss:.4f} temp={temperature:.2f} ({elapsed:.1f}s)", flush=True)

    # 最終エクスポート
    final_winrate = evaluate_vs_random(model, device, num_games=50)
    print(flush=True)
    print(f"=== 学習完了 ===", flush=True)
    print(f"最終勝率（vsランダム50局）: {final_winrate:.1%}", flush=True)
    export_weights(model, 'scripts/gomoku_nn_weights.json')

if __name__ == "__main__":
    main()
