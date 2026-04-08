"""
五目並べ Policy Network の2段階学習。

Phase 1: 教師あり学習（ミニマックスAIの手を正解として学習）
Phase 2: 自己対戦強化学習（Phase 1のモデルを起点に改善）

使い方:
  python scripts/train_gomoku_nn.py [phase1エポック] [phase2エポック]
  python scripts/train_gomoku_nn.py 50 30    # phase1=50, phase2=30

出力:
  scripts/gomoku_nn_weights.json
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

def opponent(color):
    return -color  # 1=黒, -1=白

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

# --- 評価関数（ミニマックスAI用、CMA-ES最適化済み）---

SCORE_FIVE = 74456
SCORE_OPEN_FOUR = 52097
SCORE_BROKEN_FOUR = 10435
SCORE_FOUR = 6433
SCORE_OPEN_THREE = 34227
SCORE_BROKEN_THREE = 720
SCORE_THREE = 275
SCORE_OPEN_TWO = 297
SCORE_TWO = 9
DEFENSE_MULTIPLIER = 1.55

def build_lines():
    all_lines = []
    for dr, dc in DIRECTIONS:
        if dr == 0 and dc == 1:
            starts = [(r, 0) for r in range(BOARD_SIZE)]
        elif dr == 1 and dc == 0:
            starts = [(0, c) for c in range(BOARD_SIZE)]
        elif dr == 1 and dc == 1:
            starts = [(0, c) for c in range(BOARD_SIZE)] + [(r, 0) for r in range(1, BOARD_SIZE)]
        else:
            starts = [(0, c) for c in range(BOARD_SIZE)] + [(r, BOARD_SIZE-1) for r in range(1, BOARD_SIZE)]
        for sr, sc in starts:
            coords = []
            cr, cc = sr, sc
            while 0 <= cr < BOARD_SIZE and 0 <= cc < BOARD_SIZE:
                coords.append((cr, cc))
                cr += dr
                cc += dc
            if len(coords) >= 5:
                all_lines.append(coords)
    return all_lines

ALL_LINES = build_lines()

def evaluate_color_fast(board, color):
    score = 0
    opp = opponent(color)
    for coords in ALL_LINES:
        n = len(coords)
        for i in range(n - 4):
            my, empty, has_opp = 0, 0, False
            for j in range(5):
                cell = board[coords[i+j][0]][coords[i+j][1]]
                if cell == color: my += 1
                elif cell == 0: empty += 1
                else: has_opp = True; break
            if has_opp: continue
            if my == 5: score += SCORE_FIVE
            elif my == 4 and empty == 1:
                gap = False
                for j in range(4):
                    c1 = board[coords[i+j][0]][coords[i+j][1]]
                    c2 = board[coords[i+j+1][0]][coords[i+j+1][1]]
                    if c1 == color and c2 == 0 and j+2 < 5:
                        if board[coords[i+j+2][0]][coords[i+j+2][1]] == color:
                            gap = True; break
                if gap: score += SCORE_BROKEN_FOUR
                else:
                    ob = i > 0 and board[coords[i-1][0]][coords[i-1][1]] == 0
                    oa = i+5 < n and board[coords[i+5][0]][coords[i+5][1]] == 0
                    oe = (1 if ob else 0) + (1 if oa else 0)
                    score += SCORE_OPEN_FOUR if oe == 2 else (SCORE_FOUR if oe == 1 else 0)
            elif my == 3 and empty == 2:
                gap = False
                for j in range(4):
                    c1 = board[coords[i+j][0]][coords[i+j][1]]
                    c2 = board[coords[i+j+1][0]][coords[i+j+1][1]]
                    if c1 == color and c2 == 0 and j+2 < 5:
                        if board[coords[i+j+2][0]][coords[i+j+2][1]] == color:
                            gap = True; break
                if gap: score += SCORE_BROKEN_THREE
                else:
                    ob = i > 0 and board[coords[i-1][0]][coords[i-1][1]] == 0
                    oa = i+5 < n and board[coords[i+5][0]][coords[i+5][1]] == 0
                    oe = (1 if ob else 0) + (1 if oa else 0)
                    score += SCORE_OPEN_THREE if oe == 2 else (SCORE_THREE if oe == 1 else 0)
            elif my == 2 and empty == 3:
                ob = i > 0 and board[coords[i-1][0]][coords[i-1][1]] == 0
                oa = i+5 < n and board[coords[i+5][0]][coords[i+5][1]] == 0
                oe = (1 if ob else 0) + (1 if oa else 0)
                score += SCORE_OPEN_TWO if oe == 2 else (SCORE_TWO if oe == 1 else 0)
    return score

def evaluate_fast(board, color):
    return evaluate_color_fast(board, color) - DEFENSE_MULTIPLIER * evaluate_color_fast(board, opponent(color))

def choose_minimax_move(board, color, max_depth=2, max_time=0.5):
    """ミニマックスAI（教師データ生成用）"""
    moves = get_valid_moves(board)
    if not moves:
        return None
    deadline = time.time() + max_time
    best_move = moves[0]
    best_score = -float("inf")
    for r, c in moves:
        board[r][c] = color
        score = evaluate_fast(board, color)
        board[r][c] = 0
        if score > best_score:
            best_score = score
            best_move = (r, c)
    return best_move

# --- NN モデル（ResNet風、ch=256, blocks=4）---

class ResBlock(nn.Module):
    def __init__(self, channels):
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, 3, padding=1)
        self.bn1 = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, 3, padding=1)
        self.bn2 = nn.BatchNorm2d(channels)

    def forward(self, x):
        residual = x
        x = F.relu(self.bn1(self.conv1(x)))
        x = self.bn2(self.conv2(x))
        x = F.relu(x + residual)
        return x

class GomokuPolicyNet(nn.Module):
    def __init__(self, channels=256, num_blocks=4):
        super().__init__()
        self.input_conv = nn.Conv2d(3, channels, 3, padding=1)
        self.input_bn = nn.BatchNorm2d(channels)
        self.blocks = nn.ModuleList([ResBlock(channels) for _ in range(num_blocks)])
        self.output_conv = nn.Conv2d(channels, 1, 1)

    def forward(self, x):
        x = F.relu(self.input_bn(self.input_conv(x)))
        for block in self.blocks:
            x = block(x)
        x = self.output_conv(x)
        return x.view(-1, TOTAL_CELLS)

def board_to_tensor(board, current_player):
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

# --- Phase 1: 教師あり学習 ---

def generate_expert_games(num_games, max_moves=80):
    """ミニマックスAIで対局し、教師データを生成"""
    all_states = []
    all_actions = []

    for g in range(num_games):
        board = np.zeros((BOARD_SIZE, BOARD_SIZE), dtype=np.int8)
        current = 1

        for _ in range(max_moves):
            valid = get_valid_moves(board)
            if not valid:
                break
            move = choose_minimax_move(board, current)
            if move is None:
                break
            r, c = move
            state = board_to_tensor(board, current)
            action = r * BOARD_SIZE + c
            all_states.append(state)
            all_actions.append(action)

            board[r][c] = current
            if check_win(board, r, c, current):
                break
            current = opponent(current)

        if (g + 1) % 10 == 0:
            print(f"  expert game {g+1}/{num_games}", flush=True)

    return np.array(all_states), np.array(all_actions)

def train_supervised(model, optimizer, device, states, actions, batch_size=256, epochs=1):
    """教師あり学習（1エポック）"""
    model.train()
    n = len(states)
    indices = np.random.permutation(n)
    total_loss = 0
    batches = 0

    for i in range(0, n, batch_size):
        batch_idx = indices[i:i+batch_size]
        s = torch.FloatTensor(states[batch_idx]).to(device)
        a = torch.LongTensor(actions[batch_idx]).to(device)

        logits = model(s)
        loss = F.cross_entropy(logits, a)

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        total_loss += loss.item()
        batches += 1

    return total_loss / max(batches, 1)

# --- Phase 2: 自己対戦強化学習 ---

def self_play_game(model, device, temperature=1.0):
    board = np.zeros((BOARD_SIZE, BOARD_SIZE), dtype=np.int8)
    history = []
    current = 1

    for _ in range(TOTAL_CELLS):
        valid = get_valid_moves(board)
        if not valid:
            break
        state = board_to_tensor(board, current)
        state_t = torch.FloatTensor(state).unsqueeze(0).to(device)

        with torch.no_grad():
            logits = model(state_t).squeeze(0)

        mask = torch.full((TOTAL_CELLS,), -float('inf'), device=device)
        for r, c in valid:
            mask[r * BOARD_SIZE + c] = 0.0
        probs = F.softmax((logits + mask) / temperature, dim=0)
        action = torch.multinomial(probs, 1).item()

        r, c = action // BOARD_SIZE, action % BOARD_SIZE
        history.append((state.copy(), action, current))
        board[r][c] = current

        if check_win(board, r, c, current):
            return history, current
        current = opponent(current)

    return history, 0

def train_self_play(model, optimizer, device, num_games=50, temperature=1.0):
    model.eval()
    all_states, all_actions = [], []

    for _ in range(num_games):
        history, winner = self_play_game(model, device, temperature)
        for state, action, player in history:
            if winner != 0 and player == winner:
                all_states.append(state)
                all_actions.append(action)

    if not all_states:
        return 0.0

    model.train()
    states = torch.FloatTensor(np.array(all_states)).to(device)
    actions = torch.LongTensor(all_actions).to(device)
    logits = model(states)
    loss = F.cross_entropy(logits, actions)

    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
    return loss.item()

# --- 評価 ---

def evaluate_vs_minimax(model, device, num_games=10):
    """ミニマックスAIとの対戦で勝率を測定"""
    model.eval()
    wins = 0
    for i in range(num_games):
        board = np.zeros((BOARD_SIZE, BOARD_SIZE), dtype=np.int8)
        nn_player = 1 if i % 2 == 0 else -1
        current = 1

        for _ in range(TOTAL_CELLS):
            valid = get_valid_moves(board)
            if not valid:
                break

            if current == nn_player:
                state = board_to_tensor(board, current)
                state_t = torch.FloatTensor(state).unsqueeze(0).to(device)
                with torch.no_grad():
                    logits = model(state_t).squeeze(0)
                mask = torch.full((TOTAL_CELLS,), -float('inf'), device=device)
                for r, c in valid:
                    mask[r * BOARD_SIZE + c] = 0.0
                action = (logits + mask).argmax().item()
                r, c = action // BOARD_SIZE, action % BOARD_SIZE
            else:
                move = choose_minimax_move(board, current)
                if move is None:
                    break
                r, c = move

            board[r][c] = current
            if check_win(board, r, c, current):
                if current == nn_player:
                    wins += 1
                break
            current = opponent(current)

    return wins / num_games

# --- エクスポート ---

def export_weights(model, path):
    weights = {}
    for name, param in model.named_parameters():
        weights[name] = param.detach().cpu().numpy().tolist()
    # BatchNormのrunning_mean/varも必要
    for name, buf in model.named_buffers():
        weights[name] = buf.detach().cpu().numpy().tolist()
    with open(path, 'w') as f:
        json.dump(weights, f)
    size_mb = len(json.dumps(weights)) / 1e6
    print(f"  -> {path} ({size_mb:.1f}MB)", flush=True)

# --- メイン ---

def main():
    phase1_epochs = int(sys.argv[1]) if len(sys.argv) > 1 else 50
    phase2_epochs = int(sys.argv[2]) if len(sys.argv) > 2 else 30
    expert_games = 200

    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Device: {device}", flush=True)
    print(f"Model: ch=128, blocks=6", flush=True)
    print(f"Phase 1: {phase1_epochs} epochs, {expert_games} expert games", flush=True)
    print(f"Phase 2: {phase2_epochs} epochs", flush=True)
    print(flush=True)

    model = GomokuPolicyNet(channels=128, num_blocks=6).to(device)
    params = sum(p.numel() for p in model.parameters())
    print(f"Parameters: {params:,}", flush=True)

    # === Phase 1: 教師あり学習 ===
    print(flush=True)
    print("=== Phase 1: Expert data generation ===", flush=True)
    t0 = time.time()
    states, actions = generate_expert_games(expert_games)
    print(f"  {len(states)} samples generated in {time.time()-t0:.1f}s", flush=True)

    print(flush=True)
    print("=== Phase 1: Supervised learning ===", flush=True)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

    best_winrate = 0.0
    for epoch in range(1, phase1_epochs + 1):
        t0 = time.time()
        loss = train_supervised(model, optimizer, device, states, actions)
        elapsed = time.time() - t0

        if epoch % 5 == 0 or epoch == 1:
            wr = evaluate_vs_minimax(model, device, num_games=10)
            if wr > best_winrate:
                best_winrate = wr
                export_weights(model, 'scripts/gomoku_nn_weights.json')
            print(f"  epoch {epoch:3d}/{phase1_epochs}: loss={loss:.4f} vs_minimax={wr:.0%} best={best_winrate:.0%} ({elapsed:.1f}s)", flush=True)
        else:
            print(f"  epoch {epoch:3d}/{phase1_epochs}: loss={loss:.4f} ({elapsed:.1f}s)", flush=True)

    # === Phase 2: 自己対戦強化学習 ===
    print(flush=True)
    print("=== Phase 2: Self-play reinforcement ===", flush=True)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.0003)

    for epoch in range(1, phase2_epochs + 1):
        t0 = time.time()
        temperature = max(0.5, 1.5 - epoch * 1.0 / phase2_epochs)
        loss = train_self_play(model, optimizer, device, num_games=30, temperature=temperature)
        elapsed = time.time() - t0

        if epoch % 5 == 0 or epoch == 1:
            wr = evaluate_vs_minimax(model, device, num_games=10)
            if wr > best_winrate:
                best_winrate = wr
                export_weights(model, 'scripts/gomoku_nn_weights.json')
            print(f"  epoch {epoch:3d}/{phase2_epochs}: loss={loss:.4f} vs_minimax={wr:.0%} best={best_winrate:.0%} temp={temperature:.2f} ({elapsed:.1f}s)", flush=True)
        else:
            print(f"  epoch {epoch:3d}/{phase2_epochs}: loss={loss:.4f} temp={temperature:.2f} ({elapsed:.1f}s)", flush=True)

    # 最終評価
    print(flush=True)
    print("=== Final evaluation ===", flush=True)
    final_wr = evaluate_vs_minimax(model, device, num_games=20)
    print(f"vs minimax (20 games): {final_wr:.0%}", flush=True)
    export_weights(model, 'scripts/gomoku_nn_weights.json')

if __name__ == "__main__":
    main()
