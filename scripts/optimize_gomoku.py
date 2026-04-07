"""
五目並べAIの評価関数パラメータをCMA-ESで最適化する。

使い方:
  python scripts/optimize_gomoku.py [世代数]

出力:
  最適化されたスコアパラメータ（TypeScriptにそのまま貼れる形式）
"""

import numpy as np
from cmaes import CMA
import time
import sys

BOARD_SIZE = 15
DIRECTIONS = [(0, 1), (1, 0), (1, 1), (1, -1)]
CANDIDATE_RANGE = 2

# --- ゲームロジック ---

def opponent(color):
    return "white" if color == "black" else "black"

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

def get_candidate_moves(board):
    occupied = []
    for r in range(BOARD_SIZE):
        for c in range(BOARD_SIZE):
            if board[r][c] is not None:
                occupied.append((r, c))
    if not occupied:
        return [(7, 7)]

    seen = set()
    candidates = []
    for sr, sc in occupied:
        for dr in range(-CANDIDATE_RANGE, CANDIDATE_RANGE + 1):
            for dc in range(-CANDIDATE_RANGE, CANDIDATE_RANGE + 1):
                if dr == 0 and dc == 0:
                    continue
                nr, nc = sr + dr, sc + dc
                if 0 <= nr < BOARD_SIZE and 0 <= nc < BOARD_SIZE and board[nr][nc] is None:
                    key = nr * BOARD_SIZE + nc
                    if key not in seen:
                        seen.add(key)
                        candidates.append((nr, nc))
    return candidates

# --- 評価関数 (高速版: ラインを事前構築) ---

def build_lines():
    """全方向のライン座標を事前計算"""
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

def evaluate_color_fast(board, color, params):
    s5, s_of, s_bf, s_f, s_ot, s_bt, s_t, s_o2, s_2 = params[:9]
    opp = opponent(color)
    score = 0

    for coords in ALL_LINES:
        n = len(coords)
        for i in range(n - 4):
            my = 0
            empty = 0
            has_opp = False
            for j in range(5):
                cell = board[coords[i+j][0]][coords[i+j][1]]
                if cell == color:
                    my += 1
                elif cell is None:
                    empty += 1
                else:
                    has_opp = True
                    break
            if has_opp:
                continue

            if my == 5:
                score += s5
            elif my == 4 and empty == 1:
                # 簡易判定: ギャップの有無を確認
                gap = False
                for j in range(4):
                    c1 = board[coords[i+j][0]][coords[i+j][1]]
                    c2 = board[coords[i+j+1][0]][coords[i+j+1][1]]
                    if c1 == color and c2 is None and j+2 < 5:
                        c3 = board[coords[i+j+2][0]][coords[i+j+2][1]]
                        if c3 == color:
                            gap = True
                            break
                if gap:
                    score += s_bf
                else:
                    ob = i > 0 and board[coords[i-1][0]][coords[i-1][1]] is None
                    oa = i+5 < n and board[coords[i+5][0]][coords[i+5][1]] is None
                    oe = (1 if ob else 0) + (1 if oa else 0)
                    score += s_of if oe == 2 else (s_f if oe == 1 else 0)
            elif my == 3 and empty == 2:
                gap = False
                for j in range(4):
                    c1 = board[coords[i+j][0]][coords[i+j][1]]
                    c2 = board[coords[i+j+1][0]][coords[i+j+1][1]]
                    if c1 == color and c2 is None and j+2 < 5:
                        c3 = board[coords[i+j+2][0]][coords[i+j+2][1]]
                        if c3 == color:
                            gap = True
                            break
                if gap:
                    score += s_bt
                else:
                    ob = i > 0 and board[coords[i-1][0]][coords[i-1][1]] is None
                    oa = i+5 < n and board[coords[i+5][0]][coords[i+5][1]] is None
                    oe = (1 if ob else 0) + (1 if oa else 0)
                    score += s_ot if oe == 2 else (s_t if oe == 1 else 0)
            elif my == 2 and empty == 3:
                ob = i > 0 and board[coords[i-1][0]][coords[i-1][1]] is None
                oa = i+5 < n and board[coords[i+5][0]][coords[i+5][1]] is None
                oe = (1 if ob else 0) + (1 if oa else 0)
                score += s_o2 if oe == 2 else (s_2 if oe == 1 else 0)

    return score

def evaluate_fast(board, color, params):
    dm = params[9]
    return evaluate_color_fast(board, color, params) - dm * evaluate_color_fast(board, opponent(color), params)

# --- AI ---

def choose_move(board, color, params):
    moves = get_candidate_moves(board)
    if not moves:
        return None
    best_move = moves[0]
    best_score = -float("inf")
    for r, c in moves:
        board[r][c] = color
        score = evaluate_fast(board, color, params)
        board[r][c] = None  # 元に戻す（コピーを避けて高速化）
        if score > best_score:
            best_score = score
            best_move = (r, c)
    return best_move

# --- 対戦 ---

def play_game(params_black, params_white, max_moves=80):
    board = [[None] * BOARD_SIZE for _ in range(BOARD_SIZE)]
    current = "black"
    for _ in range(max_moves):
        params = params_black if current == "black" else params_white
        move = choose_move(board, current, params)
        if move is None:
            break
        r, c = move
        board[r][c] = current
        if check_win(board, r, c, current):
            return 1 if current == "black" else -1
        current = opponent(current)
    return 0

def fitness(params, baseline, num_games=4):
    wins = 0
    for i in range(num_games):
        if i % 2 == 0:
            r = play_game(params, baseline)
            wins += (1 if r == 1 else (0.5 if r == 0 else 0))
        else:
            r = play_game(baseline, params)
            wins += (1 if r == -1 else (0.5 if r == 0 else 0))
    return wins / num_games

# --- パラメータ ---

PARAM_NAMES = [
    "SCORE_FIVE", "SCORE_OPEN_FOUR", "SCORE_BROKEN_FOUR", "SCORE_FOUR",
    "SCORE_OPEN_THREE", "SCORE_BROKEN_THREE", "SCORE_THREE",
    "SCORE_OPEN_TWO", "SCORE_TWO", "DEFENSE_MULTIPLIER",
]

DEFAULT_PARAMS = np.array([
    100000, 50000, 10000, 10000, 10000, 1000, 200, 100, 10, 1.2
])

# --- CMA-ES ---

def optimize(generations=50, pop_size=12, num_games=4):
    print(f"=== CMA-ES 五目並べパラメータ最適化 ===", flush=True)
    print(f"世代数: {generations}, 個体数: {pop_size}, 対戦数/評価: {num_games}", flush=True)

    initial_mean = np.array([
        np.log(100000), np.log(50000), np.log(10000), np.log(10000),
        np.log(10000), np.log(1000), np.log(200), np.log(100), np.log(10),
        1.2
    ])

    optimizer = CMA(mean=initial_mean, sigma=0.5, population_size=pop_size)

    best_params = DEFAULT_PARAMS.copy()
    best_fitness = 0.5

    for gen in range(generations):
        t0 = time.time()
        solutions = []
        for _ in range(pop_size):
            x = optimizer.ask()
            params = np.array([
                np.exp(x[0]), np.exp(x[1]), np.exp(x[2]), np.exp(x[3]),
                np.exp(x[4]), np.exp(x[5]), np.exp(x[6]), np.exp(x[7]),
                np.exp(x[8]),
                max(0.5, min(3.0, x[9]))
            ])
            params[:9] = np.maximum(params[:9], 1.0)
            fit = fitness(params, DEFAULT_PARAMS, num_games)
            solutions.append((x, -fit))

        optimizer.tell(solutions)

        gen_best_idx = np.argmin([s[1] for s in solutions])
        gen_best_fit = -solutions[gen_best_idx][1]
        gen_best_x = solutions[gen_best_idx][0]

        if gen_best_fit > best_fitness:
            best_fitness = gen_best_fit
            best_params = np.array([
                np.exp(gen_best_x[0]), np.exp(gen_best_x[1]), np.exp(gen_best_x[2]),
                np.exp(gen_best_x[3]), np.exp(gen_best_x[4]), np.exp(gen_best_x[5]),
                np.exp(gen_best_x[6]), np.exp(gen_best_x[7]), np.exp(gen_best_x[8]),
                max(0.5, min(3.0, gen_best_x[9]))
            ])

        avg_fit = -np.mean([s[1] for s in solutions])
        elapsed = time.time() - t0
        print(f"世代 {gen+1:3d}/{generations}: 最良={gen_best_fit:.3f} 平均={avg_fit:.3f} 全体最良={best_fitness:.3f} ({elapsed:.1f}s)", flush=True)

    print(flush=True)
    print("=== 最適化完了 ===", flush=True)
    print(flush=True)
    print("// TypeScriptに貼り付け用:", flush=True)
    for name, val in zip(PARAM_NAMES, best_params):
        if name == "DEFENSE_MULTIPLIER":
            print(f"const {name} = {val:.2f};")
        else:
            print(f"const {name} = {int(round(val))};")

    print(flush=True)
    print(f"// デフォルトに対する勝率: {best_fitness:.3f}", flush=True)

    # 検証
    print(flush=True)
    print("=== 検証対戦（最適 vs デフォルト × 10局）===", flush=True)
    wins = 0
    for i in range(10):
        if i % 2 == 0:
            r = play_game(best_params, DEFAULT_PARAMS)
            wins += (1 if r == 1 else (0.5 if r == 0 else 0))
        else:
            r = play_game(DEFAULT_PARAMS, best_params)
            wins += (1 if r == -1 else (0.5 if r == 0 else 0))
    print(f"勝率: {wins/10:.1%}", flush=True)

    return best_params

if __name__ == "__main__":
    generations = int(sys.argv[1]) if len(sys.argv) > 1 else 50
    optimize(generations=generations)
