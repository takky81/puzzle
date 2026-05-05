//! Numberlink puzzle generator.
//!
//! Produces puzzles where:
//!   - K simple paths cover all n×n cells
//!   - Each path connects its number pair endpoints
//!   - No 2×2 monochromatic block
//!   - Solution is unique
//!
//! Usage:
//!   cargo run --release -- [output_dir] [sizes]
//!   (default output_dir: ../../static/puzzles/numberlink)
//!   (default sizes: 4,5,6)

/// k 間で候補を絞り込む際の上限（難易度上位をメモリに保持）
const KEEP_TOP: usize = 2000;

fn max_k_for_size(n: usize) -> usize {
    (n * n) / 2
}

/// 生成時の k 上限。6×6 は k=8 以降が長時間かかるため k=7 で打ち切る。
fn generation_max_k(n: usize) -> usize {
    match n {
        6 => 7,
        _ => max_k_for_size(n),
    }
}

fn key_to_string(key: &[usize]) -> String {
    key.iter().map(|x| x.to_string()).collect::<Vec<_>>().join("-")
}

/// 難易度スコア = 各パスの「迂回係数」(パス長 - マンハッタン距離) の積。
/// 直線パスの係数は 1、迂回するほど大きくなる。
fn compute_difficulty(puzzle: &Puzzle) -> u64 {
    let mut score: u64 = 1;
    for (i, sol) in puzzle.solution.iter().enumerate() {
        let path_len = sol.path.len() as i64;
        let [r1, c1] = puzzle.numbers[i].positions[0];
        let [r2, c2] = puzzle.numbers[i].positions[1];
        let manhattan =
            (r1 as i64 - r2 as i64).abs() + (c1 as i64 - c2 as i64).abs();
        let factor = (path_len - manhattan) as u64;
        score = score.saturating_mul(factor);
    }
    score
}

/// 難易度上位 n 問を選択して難易度降順で返す。
/// n 以下なら全て返す。同一難易度の端数は全て含む（ちょうど 1000 問ではなく 1000 問超えた難易度まで含む）。
fn select_top_n_by_difficulty(mut puzzles: Vec<Puzzle>, n: usize) -> Vec<Puzzle> {
    if puzzles.len() <= n {
        return puzzles;
    }
    puzzles.sort_by(|a, b| b.difficulty.cmp(&a.difficulty));
    let cutoff = puzzles[n - 1].difficulty;
    puzzles.retain(|p| p.difficulty >= cutoff);
    puzzles
}

fn generate_for_size(n: usize) -> Vec<Puzzle> {
    use rayon::prelude::*;
    use std::collections::HashSet;
    use std::time::Instant;
    let mut all_puzzles: Vec<Puzzle> = Vec::new();
    let mut seen: HashSet<Vec<usize>> = HashSet::new();
    let limit: u64 = 2;

    for k in 2..=generation_max_k(n) {
        let t_k = Instant::now();
        eprintln!("  [n={n} k={k}] 探索開始");

        let t_enum = Instant::now();
        let covers = enumerate_covers(n, k);
        let dt_enum = t_enum.elapsed().as_secs_f64();
        eprintln!("    カバー列挙: {} 件 ({:.2}s)", covers.len(), dt_enum);

        if covers.is_empty() {
            eprintln!("    → カバーなし、次のkへ");
            continue;
        }

        let t_dedup = Instant::now();
        let mut new_keys: Vec<(Vec<usize>, Puzzle)> = Vec::new();
        for cover in covers {
            let puzzle = cover_to_puzzle(&cover);
            let key = canonical_key(n, &puzzle.numbers);
            if seen.insert(key.clone()) {
                new_keys.push((key, puzzle));
            }
        }
        let dt_dedup = t_dedup.elapsed().as_secs_f64();
        let n_dedup = new_keys.len();
        eprintln!("    重複除去後: {n_dedup} 問 ({dt_dedup:.2}s)");

        if n_dedup == 0 {
            eprintln!("    → 新規問題なし、次のkへ");
            continue;
        }

        eprintln!("    一意解チェック中 ({n_dedup} 問)...");
        let t_unique = Instant::now();
        let unique: Vec<Puzzle> = new_keys
            .into_par_iter()
            .filter_map(|(key, mut puzzle)| {
                if count_solutions(n, &puzzle.numbers, limit) == 1 {
                    puzzle.id = key_to_string(&key);
                    Some(puzzle)
                } else {
                    None
                }
            })
            .collect();
        let dt_unique = t_unique.elapsed().as_secs_f64();
        let n_unique = unique.len();
        eprintln!("    一意解: {n_unique} 問 ({dt_unique:.2}s)");
        eprintln!(
            "  [n={n} k={k}] 完了: {n_unique} 問 (合計 {:.2}s)",
            t_k.elapsed().as_secs_f64()
        );

        if n_unique > 0 {
            all_puzzles.extend(unique);
            // 中間絞り込み: メモリを KEEP_TOP に制限
            if all_puzzles.len() > KEEP_TOP {
                all_puzzles = select_top_n_by_difficulty(all_puzzles, KEEP_TOP);
                eprintln!("    → 上位 {} 問に絞り込み", all_puzzles.len());
            }
        }
    }

    let total_before = all_puzzles.len();
    let selected = select_top_n_by_difficulty(all_puzzles, 1000);
    eprintln!(
        "  全k統合: {} → {} 問 (難易度上位)",
        total_before,
        selected.len()
    );
    selected
}

fn main() {
    use std::fs;
    use std::path::PathBuf;
    use std::time::Instant;

    let total_cpus = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1);
    let threads = (total_cpus).saturating_sub(2).max(1);
    rayon::ThreadPoolBuilder::new()
        .num_threads(threads)
        .build_global()
        .unwrap();
    eprintln!("CPUs={total_cpus}, rayon threads={threads}");

    let out_dir = std::env::args()
        .nth(1)
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("../../static/puzzles/numberlink"));

    fs::create_dir_all(&out_dir).expect("cannot create output directory");

    let size_range: Vec<usize> = match std::env::args().nth(2) {
        Some(s) => s
            .split(',')
            .filter_map(|x| x.parse().ok())
            .collect::<Vec<usize>>(),
        None => (4..=6).collect(),
    };

    for n in size_range {
        let t = Instant::now();
        eprintln!("\n=== {}×{} 生成開始 ===", n, n);

        let puzzles = generate_for_size(n);
        let count = puzzles.len();

        if puzzles.is_empty() {
            eprintln!(
                "=== {}×{}: 有効問題なし ({:.1}s) ===",
                n,
                n,
                t.elapsed().as_secs_f64()
            );
            continue;
        }

        eprintln!(
            "=== {}×{} 完了: {}問 ({:.1}s) ===",
            n,
            n,
            count,
            t.elapsed().as_secs_f64()
        );

        let file = out_dir.join(format!("{}x{}.json", n, n));
        let json =
            serde_json::to_string_pretty(&PuzzleFile { puzzles }).expect("serialize puzzles");
        fs::write(&file, &json).expect("write puzzles file");
        eprintln!("  書き込み: {} ({} 問)", file.display(), count);
    }
}

fn rc(n: usize, i: usize) -> (usize, usize) {
    (i / n, i % n)
}

fn idx(n: usize, r: usize, c: usize) -> usize {
    r * n + c
}

use serde::Serialize;

#[derive(Serialize, Clone, Debug, PartialEq)]
struct NumPair {
    id: usize,
    positions: [[usize; 2]; 2],
}

#[derive(Serialize, Clone, Debug, PartialEq)]
struct PathSolution {
    id: usize,
    path: Vec<[usize; 2]>,
}

#[derive(Serialize, Clone, Debug)]
struct Puzzle {
    id: String,
    k: usize,
    difficulty: u64,
    size: usize,
    numbers: Vec<NumPair>,
    solution: Vec<PathSolution>,
}

#[derive(Serialize)]
struct PuzzleFile {
    puzzles: Vec<Puzzle>,
}

#[derive(Clone)]
struct Cover {
    n: usize,
    cell_id: Vec<usize>,
    endpoints: Vec<(usize, usize)>,
}

fn cover_to_puzzle(cover: &Cover) -> Puzzle {
    let n = cover.n;
    let k = cover.endpoints.len();
    let mut numbers = Vec::with_capacity(k);
    let mut solution = Vec::with_capacity(k);
    for (id0, &(s, e)) in cover.endpoints.iter().enumerate() {
        let id = id0 + 1;
        let (sr, sc) = rc(n, s);
        let (er, ec) = rc(n, e);
        numbers.push(NumPair {
            id,
            positions: [[sr, sc], [er, ec]],
        });
        let path_idx = walk_path_for_id(n, &cover.cell_id, id, s);
        let path: Vec<[usize; 2]> = path_idx.iter().map(|&i| [i / n, i % n]).collect();
        solution.push(PathSolution { id, path });
    }
    let mut puzzle = Puzzle {
        id: String::new(),
        k,
        difficulty: 0,
        size: n,
        numbers,
        solution,
    };
    puzzle.difficulty = compute_difficulty(&puzzle);
    puzzle
}

fn apply_sym(n: usize, r: usize, c: usize, s: u8) -> (usize, usize) {
    let m = n - 1;
    match s {
        0 => (r, c),
        1 => (c, m - r),
        2 => (m - r, m - c),
        3 => (m - c, r),
        4 => (r, m - c),
        5 => (m - r, c),
        6 => (c, r),
        7 => (m - c, m - r),
        _ => unreachable!(),
    }
}

fn canonical_key(n: usize, numbers: &[NumPair]) -> Vec<usize> {
    let mut best: Option<Vec<usize>> = None;
    for s in 0..8u8 {
        let mut pairs: Vec<(usize, usize)> = numbers
            .iter()
            .map(|np| {
                let [[r1, c1], [r2, c2]] = np.positions;
                let (a1, a2) = apply_sym(n, r1, c1, s);
                let (b1, b2) = apply_sym(n, r2, c2, s);
                let a = a1 * n + a2;
                let b = b1 * n + b2;
                if a <= b {
                    (a, b)
                } else {
                    (b, a)
                }
            })
            .collect();
        pairs.sort();
        let key: Vec<usize> = pairs.iter().flat_map(|&(a, b)| [a, b]).collect();
        if best.as_ref().map_or(true, |cur| &key < cur) {
            best = Some(key);
        }
    }
    best.unwrap()
}


/// 未割当セル（cell_id==0）の連結成分数を返す。
fn count_components(n: usize, cell_id: &[usize]) -> usize {
    let total = n * n;
    let mut visited = vec![false; total];
    let mut count = 0;
    for start in 0..total {
        if cell_id[start] == 0 && !visited[start] {
            count += 1;
            let mut queue = vec![start];
            visited[start] = true;
            while let Some(v) = queue.pop() {
                for nb in neighbors(n, v).into_iter().flatten() {
                    if cell_id[nb] == 0 && !visited[nb] {
                        visited[nb] = true;
                        queue.push(nb);
                    }
                }
            }
        }
    }
    count
}

/// パス1の全完成状態（cell_id スナップショット + 端点ペア）を収集する逐次 DFS。
/// 収集した状態を rayon で並列展開してパス2以降を探索する。
fn enumerate_covers(n: usize, target_k: usize) -> Vec<Cover> {
    use rayon::prelude::*;

    let total = n * n;

    // k=1 は全セル Hamiltonian パスが対象。並列化の恩恵が小さいので逐次のまま。
    if target_k < 2 {
        let mut results = Vec::new();
        let mut cell_id = vec![0usize; total];
        let mut endpoints = Vec::new();
        dfs_cover(n, &mut cell_id, &mut endpoints, None, target_k, &mut results);
        return results;
    }

    // Phase 1 (逐次): パス1の全完成状態を seeds として収集
    let mut seeds: Vec<(Vec<usize>, (usize, usize))> = Vec::new();
    {
        let mut cell_id = vec![0usize; total];
        cell_id[0] = 1; // パス1は常にセル0から開始
        collect_path1_seeds(n, &mut cell_id, 0, target_k, &mut seeds);
    }

    // Phase 2 (並列): 各 seed からパス2以降を独立に探索
    seeds
        .into_par_iter()
        .flat_map_iter(|(mut cell_id, ep1)| {
            let next = (0..total).find(|&i| cell_id[i] == 0);
            let mut endpoints = vec![ep1];
            let mut out = Vec::new();
            if let Some(start2) = next {
                cell_id[start2] = 2;
                endpoints.push((start2, 0));
                if check_2x2_around_cell(n, &cell_id, start2) {
                    dfs_cover(n, &mut cell_id, &mut endpoints, Some(start2), target_k, &mut out);
                }
            }
            out
        })
        .collect()
}

/// パス1の全完成状態を収集する。
/// Option A（延長）→ Option B（閉じる）の順で探索する（dfs_cover と同じ順序）。
fn collect_path1_seeds(
    n: usize,
    cell_id: &mut Vec<usize>,
    tip: usize,
    target_k: usize,
    seeds: &mut Vec<(Vec<usize>, (usize, usize))>,
) {
    // Option A: パス1を隣接未割当セルへ延長
    for nb in neighbors(n, tip).into_iter().flatten() {
        if cell_id[nb] == 0 {
            cell_id[nb] = 1;
            if check_2x2_around_cell(n, cell_id, nb)
                && count_components(n, cell_id) <= target_k
            {
                collect_path1_seeds(n, cell_id, nb, target_k, seeds);
            }
            cell_id[nb] = 0;
        }
    }

    // Option B: パス1をここで閉じる（長さ≥2かつ端点が非隣接）
    let path_len = cell_id.iter().filter(|&&x| x == 1).count();
    if path_len >= 2 {
        let (rs, cs) = rc(n, 0); // パス1の開始は常にセル0
        let (rt, ct) = rc(n, tip);
        if rs.abs_diff(rt) + cs.abs_diff(ct) != 1 {
            // 未割当の連結成分数が残りパス数を超えるなら詰み
            let remaining = target_k - 1;
            if count_components(n, cell_id) <= remaining {
                seeds.push((cell_id.clone(), (0, tip)));
            }
        }
    }
}

fn dfs_cover(
    n: usize,
    cell_id: &mut Vec<usize>,
    endpoints: &mut Vec<(usize, usize)>,
    current_tip: Option<usize>,
    target_k: usize,
    out: &mut Vec<Cover>,
) {
    let total = n * n;
    let Some(tip) = current_tip else {
        let Some(start) = (0..total).find(|&i| cell_id[i] == 0) else {
            return;
        };
        let new_id = endpoints.len() + 1;
        if new_id > target_k {
            return;
        }
        cell_id[start] = new_id;
        endpoints.push((start, 0));
        if check_2x2_around_cell(n, cell_id, start) {
            dfs_cover(n, cell_id, endpoints, Some(start), target_k, out);
        }
        endpoints.pop();
        cell_id[start] = 0;
        return;
    };

    let k = endpoints.len();
    let current_id = k;

    // target_k - k + 1: 現在のパス(1) + 残りのパス(target_k-k)
    let max_components = target_k - k + 1;
    for nb in neighbors(n, tip).into_iter().flatten() {
        if cell_id[nb] == 0 {
            cell_id[nb] = current_id;
            if check_2x2_around_cell(n, cell_id, nb)
                && count_components(n, cell_id) <= max_components
            {
                dfs_cover(n, cell_id, endpoints, Some(nb), target_k, out);
            }
            cell_id[nb] = 0;
        }
    }

    let path_len = cell_id.iter().filter(|&&x| x == current_id).count();
    if path_len < 2 {
        return;
    }
    endpoints[k - 1].1 = tip;
    // 案B: 閉じた時点で両端点が隣接 → 全体フィルタより早く枝刈り
    let (rs, cs) = rc(n, endpoints[k - 1].0);
    let (rt, ct) = rc(n, tip);
    if rs.abs_diff(rt) + cs.abs_diff(ct) == 1 {
        return;
    }
    let next_unvisited = (0..total).find(|&i| cell_id[i] == 0);
    if let Some(next) = next_unvisited {
        if k < target_k {
            // 未割当の連結成分数が残りパス数を超えるなら詰み
            let remaining = target_k - k;
            if count_components(n, cell_id) > remaining {
                return;
            }
            let new_id = k + 1;
            cell_id[next] = new_id;
            endpoints.push((next, 0));
            if check_2x2_around_cell(n, cell_id, next) {
                dfs_cover(n, cell_id, endpoints, Some(next), target_k, out);
            }
            endpoints.pop();
            cell_id[next] = 0;
        }
    } else if k == target_k {
        out.push(Cover {
            n,
            cell_id: cell_id.clone(),
            endpoints: endpoints.clone(),
        });
    }
}

/// `from` から `to` へ、未割当セル (cell_id==0) を経由して到達できるか BFS で判定する。
/// `to` は番号マス（cell_id != 0）でもゴールとして扱う。
fn can_reach(n: usize, cell_id: &[usize], from: usize, to: usize) -> bool {
    if from == to {
        return true;
    }
    let total = n * n;
    let mut visited = vec![false; total];
    let mut queue = vec![from];
    visited[from] = true;
    while let Some(v) = queue.pop() {
        for nb in neighbors(n, v).into_iter().flatten() {
            if nb == to {
                return true;
            }
            if !visited[nb] && cell_id[nb] == 0 {
                visited[nb] = true;
                queue.push(nb);
            }
        }
    }
    false
}

fn check_2x2_around_cell(n: usize, cell_id: &[usize], i: usize) -> bool {
    let (r, c) = rc(n, i);
    for dr in 0..=1usize {
        for dc in 0..=1usize {
            if dr <= r && dc <= c && has_2x2_mono(n, cell_id, r - dr, c - dc) {
                return false;
            }
        }
    }
    true
}

fn count_solutions(n: usize, numbers: &[NumPair], limit: u64) -> usize {
    if numbers.is_empty() {
        return 0;
    }
    let mut cell_id = vec![0usize; n * n];
    for np in numbers {
        cell_id[idx(n, np.positions[0][0], np.positions[0][1])] = np.id;
        cell_id[idx(n, np.positions[1][0], np.positions[1][1])] = np.id;
    }
    let mut count: usize = 0;
    let start = idx(n, numbers[0].positions[0][0], numbers[0].positions[0][1]);
    solve_path(n, &mut cell_id, numbers, 0, start, &mut count, limit);
    count
}

/// まだルーティングしていない全ペアが未割当セルを通じて接続可能かチェック。
/// first_idx から numbers.len()-1 まで対象。
#[inline]
fn future_pairs_reachable(n: usize, cell_id: &[usize], numbers: &[NumPair], first_idx: usize) -> bool {
    for i in first_idx..numbers.len() {
        let s = idx(n, numbers[i].positions[0][0], numbers[i].positions[0][1]);
        let e = idx(n, numbers[i].positions[1][0], numbers[i].positions[1][1]);
        if !can_reach(n, cell_id, s, e) {
            return false;
        }
    }
    true
}

/// 未割当セルに孤立ポケットがあるか判定する。
/// tip（直前に割り当てたセル）および pair_idx 以降の全エンドポイントを起点に
/// 未割当セルへ BFS し、到達できない未割当セルがあれば true を返す。
fn has_pocket(
    n: usize,
    cell_id: &[usize],
    numbers: &[NumPair],
    pair_idx: usize,
    tip: usize,
) -> bool {
    let total = n * n;
    let mut visited = vec![false; total];
    let mut queue = Vec::new();

    // seeds: tip + pair_idx 以降の全エンドポイント
    let mut seeds = vec![tip];
    for np in &numbers[pair_idx..] {
        seeds.push(idx(n, np.positions[0][0], np.positions[0][1]));
        seeds.push(idx(n, np.positions[1][0], np.positions[1][1]));
    }
    for seed in seeds {
        for nb in neighbors(n, seed).into_iter().flatten() {
            if cell_id[nb] == 0 && !visited[nb] {
                visited[nb] = true;
                queue.push(nb);
            }
        }
    }

    while let Some(v) = queue.pop() {
        for nb in neighbors(n, v).into_iter().flatten() {
            if cell_id[nb] == 0 && !visited[nb] {
                visited[nb] = true;
                queue.push(nb);
            }
        }
    }

    (0..total).any(|i| cell_id[i] == 0 && !visited[i])
}

fn solve_path(
    n: usize,
    cell_id: &mut [usize],
    numbers: &[NumPair],
    pair_idx: usize,
    tip: usize,
    count: &mut usize,
    limit: u64,
) {
    if (*count as u64) >= limit {
        return;
    }
    let np = &numbers[pair_idx];
    let end_idx = idx(n, np.positions[1][0], np.positions[1][1]);
    let current_id = np.id;

    if tip == end_idx {
        if pair_idx + 1 == numbers.len() {
            *count += 1;
            return;
        }
        let next_idx = pair_idx + 1;
        // ペア遷移時: 残りの全ペアが接続可能か確認してから再帰
        if !future_pairs_reachable(n, cell_id, numbers, next_idx) {
            return;
        }
        let next_start = idx(
            n,
            numbers[next_idx].positions[0][0],
            numbers[next_idx].positions[0][1],
        );
        if has_pocket(n, cell_id, numbers, next_idx, next_start) {
            return;
        }
        solve_path(n, cell_id, numbers, next_idx, next_start, count, limit);
        return;
    }

    // 現在ペアの終点へ到達不可なら探索不要
    if !can_reach(n, cell_id, tip, end_idx) {
        return;
    }

    for nb in neighbors(n, tip).into_iter().flatten() {
        if (*count as u64) >= limit {
            return;
        }
        if nb == end_idx {
            solve_path(n, cell_id, numbers, pair_idx, nb, count, limit);
            continue;
        }
        if cell_id[nb] != 0 {
            continue;
        }
        cell_id[nb] = current_id;
        if check_2x2_around_cell(n, cell_id, nb)
            && future_pairs_reachable(n, cell_id, numbers, pair_idx + 1)
            && !has_pocket(n, cell_id, numbers, pair_idx, nb)
        {
            solve_path(n, cell_id, numbers, pair_idx, nb, count, limit);
        }
        cell_id[nb] = 0;
    }
}

fn walk_path_for_id(n: usize, cell_id: &[usize], id: usize, start: usize) -> Vec<usize> {
    let mut path = vec![start];
    let mut visited = vec![false; cell_id.len()];
    visited[start] = true;
    let mut cur = start;
    loop {
        let next = neighbors(n, cur)
            .into_iter()
            .flatten()
            .find(|&nb| cell_id[nb] == id && !visited[nb]);
        match next {
            Some(nb) => {
                path.push(nb);
                visited[nb] = true;
                cur = nb;
            }
            None => break,
        }
    }
    path
}

fn has_2x2_mono(n: usize, cell_id: &[usize], r: usize, c: usize) -> bool {
    if r + 1 >= n || c + 1 >= n {
        return false;
    }
    let a = cell_id[idx(n, r, c)];
    let b = cell_id[idx(n, r, c + 1)];
    let d = cell_id[idx(n, r + 1, c)];
    let e = cell_id[idx(n, r + 1, c + 1)];
    a != 0 && a == b && a == d && a == e
}

fn neighbors(n: usize, i: usize) -> [Option<usize>; 4] {
    let (r, c) = rc(n, i);
    [
        if r > 0 { Some(i - n) } else { None },
        if r + 1 < n { Some(i + n) } else { None },
        if c > 0 { Some(i - 1) } else { None },
        if c + 1 < n { Some(i + 1) } else { None },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── ヘルパー ──────────────────────────────────────────────────────────────

    fn make_dummy_puzzle(id_num: u64, difficulty: u64) -> Puzzle {
        Puzzle {
            id: id_num.to_string(),
            k: 1,
            difficulty,
            size: 4,
            numbers: vec![],
            solution: vec![],
        }
    }

    // ── 既存テスト ────────────────────────────────────────────────────────────

    #[test]
    fn rc_converts_index_to_row_col() {
        assert_eq!(rc(3, 0), (0, 0));
        assert_eq!(rc(3, 4), (1, 1));
        assert_eq!(rc(3, 8), (2, 2));
    }

    #[test]
    fn idx_converts_row_col_to_index() {
        assert_eq!(idx(3, 0, 0), 0);
        assert_eq!(idx(3, 1, 1), 4);
        assert_eq!(idx(3, 2, 2), 8);
    }

    fn sorted_neighbors(n: usize, i: usize) -> Vec<usize> {
        let mut nb: Vec<usize> = neighbors(n, i).into_iter().flatten().collect();
        nb.sort();
        nb
    }

    #[test]
    fn neighbors_corner_returns_two() {
        assert_eq!(sorted_neighbors(3, 0), vec![1, 3]);
    }

    #[test]
    fn neighbors_edge_returns_three() {
        assert_eq!(sorted_neighbors(3, 1), vec![0, 2, 4]);
    }

    #[test]
    fn neighbors_center_returns_four() {
        assert_eq!(sorted_neighbors(3, 4), vec![1, 3, 5, 7]);
    }

    #[test]
    fn has_2x2_mono_all_unassigned_is_false() {
        let cells = vec![0usize; 4];
        assert!(!has_2x2_mono(2, &cells, 0, 0));
    }

    #[test]
    fn has_2x2_mono_all_same_nonzero_is_true() {
        let cells = vec![1usize; 4];
        assert!(has_2x2_mono(2, &cells, 0, 0));
    }

    #[test]
    fn has_2x2_mono_mixed_is_false() {
        let cells = vec![1, 1, 1, 2];
        assert!(!has_2x2_mono(2, &cells, 0, 0));
    }

    #[test]
    fn has_2x2_mono_out_of_range_is_false() {
        let cells = vec![1usize; 9];
        assert!(!has_2x2_mono(3, &cells, 2, 2));
        assert!(!has_2x2_mono(3, &cells, 2, 0));
        assert!(!has_2x2_mono(3, &cells, 0, 2));
    }

    #[test]
    fn count_solutions_2x2_all_numbers_unique() {
        let numbers = vec![
            NumPair {
                id: 1,
                positions: [[0, 0], [0, 1]],
            },
            NumPair {
                id: 2,
                positions: [[1, 0], [1, 1]],
            },
        ];
        assert_eq!(count_solutions(2, &numbers, 1_000), 1);
    }

    #[test]
    fn count_solutions_2x2_diagonal_pair_two_routes() {
        let numbers = vec![NumPair {
            id: 1,
            positions: [[0, 0], [1, 1]],
        }];
        assert_eq!(count_solutions(2, &numbers, 1_000), 2);
    }

    fn has_adjacent_pair(numbers: &[NumPair]) -> bool {
        numbers.iter().any(|np| {
            let [[r1, c1], [r2, c2]] = np.positions;
            r1.abs_diff(r2) + c1.abs_diff(c2) == 1
        })
    }

    #[test]
    fn has_adjacent_pair_true_for_adjacent() {
        let numbers = vec![NumPair {
            id: 1,
            positions: [[0, 0], [0, 1]],
        }];
        assert!(has_adjacent_pair(&numbers));
    }

    #[test]
    fn has_adjacent_pair_false_for_non_adjacent() {
        let numbers = vec![NumPair {
            id: 1,
            positions: [[0, 0], [0, 2]],
        }];
        assert!(!has_adjacent_pair(&numbers));
    }

    #[test]
    fn can_reach_direct_path() {
        let cell_id = vec![0usize; 4];
        assert!(can_reach(2, &cell_id, 0, 3));
    }

    #[test]
    fn can_reach_blocked_by_assigned_cells() {
        let cell_id = vec![0usize, 99, 99, 0];
        assert!(!can_reach(2, &cell_id, 0, 3));
    }

    #[test]
    fn can_reach_adjacent_is_true() {
        let cell_id = vec![0usize; 9];
        assert!(can_reach(3, &cell_id, 0, 1));
    }

    #[test]
    fn enumerate_covers_4x4_k3_count_stable() {
        let covers = enumerate_covers(4, 3);
        assert_eq!(covers.len(), 72, "4x4 k=3 のカバー数が変わっている");
        for c in &covers {
            assert_eq!(c.cell_id.len(), 16);
            assert!(c.cell_id.iter().all(|&x| x > 0));
            assert_eq!(c.endpoints.len(), 3);
        }
    }

    #[test]
    fn enumerate_covers_no_adjacent_pairs() {
        for k in 3..=4 {
            for cover in enumerate_covers(3, k) {
                for (start, end) in &cover.endpoints {
                    let (rs, cs) = rc(3, *start);
                    let (re, ce) = rc(3, *end);
                    assert_ne!(
                        rs.abs_diff(re) + cs.abs_diff(ce),
                        1,
                        "k={k}: adjacent pair found at ({rs},{cs})-({re},{ce})"
                    );
                }
            }
        }
    }

    #[test]
    fn cover_to_puzzle_extracts_numbers_and_paths() {
        let cover = Cover {
            n: 2,
            cell_id: vec![1, 1, 2, 2],
            endpoints: vec![(0, 1), (2, 3)],
        };
        let puzzle = cover_to_puzzle(&cover);
        assert_eq!(puzzle.size, 2);
        assert_eq!(puzzle.numbers.len(), 2);
        assert_eq!(puzzle.solution.len(), 2);
        assert_eq!(puzzle.solution[0].path, vec![[0, 0], [0, 1]]);
        assert_eq!(puzzle.solution[1].path, vec![[1, 0], [1, 1]]);
    }

    #[test]
    fn canonical_key_id_permutation_invariant() {
        let n = 4;
        let abc = vec![
            NumPair { id: 1, positions: [[0, 0], [3, 3]] },
            NumPair { id: 2, positions: [[0, 3], [3, 0]] },
            NumPair { id: 3, positions: [[1, 0], [2, 3]] },
        ];
        let bca = vec![
            NumPair { id: 1, positions: [[0, 3], [3, 0]] },
            NumPair { id: 2, positions: [[1, 0], [2, 3]] },
            NumPair { id: 3, positions: [[0, 0], [3, 3]] },
        ];
        let cab = vec![
            NumPair { id: 1, positions: [[1, 0], [2, 3]] },
            NumPair { id: 2, positions: [[0, 0], [3, 3]] },
            NumPair { id: 3, positions: [[0, 3], [3, 0]] },
        ];
        assert_eq!(canonical_key(n, &abc), canonical_key(n, &bca));
        assert_eq!(canonical_key(n, &abc), canonical_key(n, &cab));
    }

    #[test]
    fn canonical_key_rotation_equivalent() {
        let original = vec![NumPair {
            id: 1,
            positions: [[0, 0], [0, 2]],
        }];
        let rotated = vec![NumPair {
            id: 1,
            positions: [[0, 0], [2, 0]],
        }];
        assert_eq!(canonical_key(3, &original), canonical_key(3, &rotated));
    }

    #[test]
    fn canonical_key_different_layouts_differ() {
        let a = vec![NumPair {
            id: 1,
            positions: [[0, 0], [0, 1]],
        }];
        let b = vec![NumPair {
            id: 1,
            positions: [[0, 0], [1, 1]],
        }];
        assert_ne!(canonical_key(3, &a), canonical_key(3, &b));
    }

    #[test]
    fn count_solutions_3x3_three_vertical_pairs_unique() {
        let numbers = vec![
            NumPair {
                id: 1,
                positions: [[0, 0], [2, 0]],
            },
            NumPair {
                id: 2,
                positions: [[0, 1], [2, 1]],
            },
            NumPair {
                id: 3,
                positions: [[0, 2], [2, 2]],
            },
        ];
        assert_eq!(count_solutions(3, &numbers, 1_000), 1);
    }

    #[test]
    fn has_pocket_false_when_all_cells_reachable() {
        let n = 3;
        let cell_id = vec![1usize, 1, 0, 0, 0, 0, 0, 0, 1];
        let numbers = vec![NumPair { id: 1, positions: [[0, 0], [2, 2]] }];
        assert!(!has_pocket(n, &cell_id, &numbers, 0, 1));
    }

    #[test]
    fn has_pocket_true_when_isolated_cell_exists() {
        let n = 3;
        let cell_id = vec![1usize, 1, 1, 1, 0, 1, 1, 1, 1];
        let numbers = vec![NumPair { id: 1, positions: [[0, 0], [2, 2]] }];
        assert!(has_pocket(n, &cell_id, &numbers, 0, 2));
    }

    #[test]
    fn key_to_string_produces_dash_separated_values() {
        assert_eq!(key_to_string(&[0, 5, 3, 12]), "0-5-3-12");
    }

    #[test]
    fn cover_to_puzzle_id_is_initially_empty() {
        let cover = Cover {
            n: 2,
            cell_id: vec![1, 1, 2, 2],
            endpoints: vec![(0, 1), (2, 3)],
        };
        let puzzle = cover_to_puzzle(&cover);
        assert_eq!(puzzle.id, "");
    }

    // ── 新規テスト ────────────────────────────────────────────────────────────

    #[test]
    fn compute_difficulty_直線パスは係数1を返す() {
        // (0,0)→(0,1)→(0,2)→(0,3): path_len=4, manhattan=3, factor=1
        let puzzle = Puzzle {
            id: String::new(),
            k: 1,
            difficulty: 0,
            size: 4,
            numbers: vec![NumPair { id: 1, positions: [[0, 0], [0, 3]] }],
            solution: vec![PathSolution { id: 1, path: vec![[0, 0], [0, 1], [0, 2], [0, 3]] }],
        };
        assert_eq!(compute_difficulty(&puzzle), 1);
    }

    #[test]
    fn compute_difficulty_迂回パスは係数3を返す() {
        // (0,0)→(1,0)→(1,1)→(0,1): path_len=4, manhattan=1, factor=3
        let puzzle = Puzzle {
            id: String::new(),
            k: 1,
            difficulty: 0,
            size: 2,
            numbers: vec![NumPair { id: 1, positions: [[0, 0], [0, 1]] }],
            solution: vec![PathSolution { id: 1, path: vec![[0, 0], [1, 0], [1, 1], [0, 1]] }],
        };
        assert_eq!(compute_difficulty(&puzzle), 3);
    }

    #[test]
    fn compute_difficulty_2パスの積を返す() {
        // pair1: 直線 factor=1, pair2: 迂回 factor=3 → 積=3
        let puzzle = Puzzle {
            id: String::new(),
            k: 2,
            difficulty: 0,
            size: 4,
            numbers: vec![
                NumPair { id: 1, positions: [[0, 0], [0, 3]] },
                NumPair { id: 2, positions: [[3, 0], [3, 1]] },
            ],
            solution: vec![
                PathSolution { id: 1, path: vec![[0, 0], [0, 1], [0, 2], [0, 3]] }, // factor=1
                PathSolution { id: 2, path: vec![[3, 0], [2, 0], [2, 1], [3, 1]] }, // factor=3
            ],
        };
        assert_eq!(compute_difficulty(&puzzle), 3);
    }

    #[test]
    fn select_top_n_n未満は全て返す() {
        let puzzles: Vec<Puzzle> = (0..500u64).map(|i| make_dummy_puzzle(i, i)).collect();
        assert_eq!(select_top_n_by_difficulty(puzzles, 1000).len(), 500);
    }

    #[test]
    fn select_top_n_上位nを選択する() {
        let puzzles: Vec<Puzzle> = (0..2000u64).map(|i| make_dummy_puzzle(i, i)).collect();
        let result = select_top_n_by_difficulty(puzzles, 1000);
        assert_eq!(result.len(), 1000);
        assert!(result.iter().all(|p| p.difficulty >= 1000));
    }

    #[test]
    fn select_top_n_同一難易度の端数を全て含む() {
        // 800問 difficulty=3, 400問 difficulty=2, n=1000 → cutoff=2 → 全1200問
        let mut puzzles: Vec<Puzzle> =
            (0..800u64).map(|i| make_dummy_puzzle(i, 3)).collect();
        puzzles.extend((800..1200u64).map(|i| make_dummy_puzzle(i, 2)));
        let result = select_top_n_by_difficulty(puzzles, 1000);
        assert_eq!(result.len(), 1200);
        assert!(result.iter().all(|p| p.difficulty >= 2));
    }

    #[test]
    fn generation_max_k_6は7を返す() {
        assert_eq!(generation_max_k(6), 7);
    }

    #[test]
    fn generation_max_k_4はmax_k_for_sizeと等しい() {
        assert_eq!(generation_max_k(4), max_k_for_size(4));
    }

    #[test]
    fn cover_to_puzzle_kとdifficulty_が設定される() {
        let cover = Cover {
            n: 2,
            cell_id: vec![1, 1, 2, 2],
            endpoints: vec![(0, 1), (2, 3)],
        };
        let puzzle = cover_to_puzzle(&cover);
        assert_eq!(puzzle.k, 2);
        // 両パスとも直線: difficulty = 1 * 1 = 1
        assert_eq!(puzzle.difficulty, 1);
    }
}
