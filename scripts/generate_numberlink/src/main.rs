//! Numberlink puzzle generator.
//!
//! Produces puzzles where:
//!   - K simple paths cover all n×n cells
//!   - Each path connects its number pair endpoints
//!   - No 2×2 monochromatic block
//!   - Solution is unique
//!
//! Usage:
//!   cargo run --release -- [output_dir]
//!   (default output_dir: ../../static/puzzles/numberlink)

const TARGET_PUZZLES: usize = 100;

fn max_k_for_size(n: usize) -> usize {
    (n * n) / 2
}

fn has_adjacent_pair(numbers: &[NumPair]) -> bool {
    numbers.iter().any(|np| {
        let [[r1, c1], [r2, c2]] = np.positions;
        r1.abs_diff(r2) + c1.abs_diff(c2) == 1
    })
}

fn generate_for_size(n: usize) -> Vec<Puzzle> {
    use rayon::prelude::*;
    use std::collections::HashSet;
    let mut puzzles: Vec<Puzzle> = Vec::new();
    let mut seen: HashSet<Vec<usize>> = HashSet::new();
    let limit: u64 = 5_000_000;

    for k in 2..=max_k_for_size(n) {
        if puzzles.len() >= TARGET_PUZZLES {
            break;
        }
        eprintln!("  n={n}, k={k}: enumerating covers...");
        let covers = enumerate_covers(n, k);
        eprintln!("    {} raw covers", covers.len());

        // Canonical key (dedupe) is serial; uniqueness check (expensive) is parallel.
        let mut new_keys: Vec<(Vec<usize>, Puzzle)> = Vec::new();
        for cover in covers {
            let puzzle = cover_to_puzzle(&cover);
            if has_adjacent_pair(&puzzle.numbers) {
                continue;
            }
            let key = canonical_key(n, &puzzle.numbers);
            if seen.insert(key.clone()) {
                new_keys.push((key, puzzle));
            }
        }
        let unique: Vec<Puzzle> = new_keys
            .into_par_iter()
            .filter_map(|(_, puzzle)| {
                if count_solutions(n, &puzzle.numbers, limit) == 1 {
                    Some(puzzle)
                } else {
                    None
                }
            })
            .collect();

        for puzzle in unique {
            if puzzles.len() >= TARGET_PUZZLES {
                break;
            }
            puzzles.push(puzzle);
        }
        eprintln!("    accepted total = {}", puzzles.len());
    }
    puzzles
}

fn main() {
    use std::fs;
    use std::path::PathBuf;
    use std::time::Instant;

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
        None => (4..=9).collect(),
    };

    for n in size_range {
        let t = Instant::now();
        eprintln!("=== {}×{} ===", n, n);

        let puzzles = generate_for_size(n);
        eprintln!(
            "→ {} puzzles ({:.1}s)",
            puzzles.len(),
            t.elapsed().as_secs_f64()
        );
        if puzzles.is_empty() {
            eprintln!("  no puzzles for n={n}, skipping.");
            continue;
        }
        let json = serde_json::to_string_pretty(&PuzzleFile { puzzles }).expect("serialize puzzles");
        let file = out_dir.join(format!("{}x{}.json", n, n));
        fs::write(&file, &json).expect("write puzzles file");
        eprintln!("  written: {}", file.display());
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
    Puzzle {
        size: n,
        numbers,
        solution,
    }
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


fn enumerate_covers(n: usize, target_k: usize) -> Vec<Cover> {
    let total = n * n;
    let mut results: Vec<Cover> = Vec::new();
    let mut cell_id = vec![0usize; total];
    let mut endpoints: Vec<(usize, usize)> = Vec::with_capacity(target_k);
    dfs_cover(n, &mut cell_id, &mut endpoints, None, target_k, &mut results);
    results
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

    for nb in neighbors(n, tip).into_iter().flatten() {
        if cell_id[nb] == 0 {
            cell_id[nb] = current_id;
            if check_2x2_around_cell(n, cell_id, nb) {
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
    let next_unvisited = (0..total).find(|&i| cell_id[i] == 0);
    if let Some(next) = next_unvisited {
        if k < target_k {
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
        // プレイヤーのクリア条件は「全ペア接続」のみ。被覆は求めない。
        // 全ペアがつながれば解として1つカウントする。
        if pair_idx + 1 == numbers.len() {
            *count += 1;
            return;
        }
        let next_idx = pair_idx + 1;
        let next_start = idx(
            n,
            numbers[next_idx].positions[0][0],
            numbers[next_idx].positions[0][1],
        );
        solve_path(n, cell_id, numbers, next_idx, next_start, count, limit);
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
        if check_2x2_around_cell(n, cell_id, nb) {
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
        // 3×3 グリッドで (r=2, c=2) 起点の2×2はグリッド外
        let cells = vec![1usize; 9];
        assert!(!has_2x2_mono(3, &cells, 2, 2));
        assert!(!has_2x2_mono(3, &cells, 2, 0));
        assert!(!has_2x2_mono(3, &cells, 0, 2));
    }

    #[test]
    fn count_solutions_2x2_all_numbers_unique() {
        // 2×2 に 2 ペア全て番号マス。唯一の自明解。
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
        // 2×2 の対角ペアは (0,1) 経由 と (1,0) 経由の2通り。
        // 解の条件は全ペア接続のみなので、どちらも有効解。
        let numbers = vec![NumPair {
            id: 1,
            positions: [[0, 0], [1, 1]],
        }];
        assert_eq!(count_solutions(2, &numbers, 1_000), 2);
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
    fn enumerate_covers_2x2_k2_returns_nonempty() {
        let covers = enumerate_covers(2, 2);
        // 2×2 に K=2 のパスカバーは少なくとも存在する（横2本・縦2本など）
        assert!(!covers.is_empty());
        // 各カバーは cell_id が全マス非ゼロ、endpoints が K 組
        for c in &covers {
            assert_eq!(c.cell_id.len(), 4);
            assert!(c.cell_id.iter().all(|&x| x > 0));
            assert_eq!(c.endpoints.len(), 2);
        }
    }

    #[test]
    fn cover_to_puzzle_extracts_numbers_and_paths() {
        // 2×2 の 2 ペア横並び: cell_id=[1,1,2,2], endpoints=[(0,1),(2,3)]
        let cover = Cover {
            n: 2,
            cell_id: vec![1, 1, 2, 2],
            endpoints: vec![(0, 1), (2, 3)],
        };
        let puzzle = cover_to_puzzle(&cover);
        assert_eq!(puzzle.size, 2);
        assert_eq!(puzzle.numbers.len(), 2);
        assert_eq!(puzzle.solution.len(), 2);
        // ID 1 のパスは (0,0) から (0,1) の 2 マス
        assert_eq!(puzzle.solution[0].path, vec![[0, 0], [0, 1]]);
        // ID 2 のパスは (1,0) から (1,1) の 2 マス
        assert_eq!(puzzle.solution[1].path, vec![[1, 0], [1, 1]]);
    }

    #[test]
    fn canonical_key_rotation_equivalent() {
        // 90°回転したペア配置は同じ canonical key
        // 元: 3×3, pair at (0,0)-(0,2)
        // 90°回転後: (0,0)-(2,0)
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
        // 全く異なる配置は異なる key
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
        // 3×3 の縦3ペア: 唯一解は各列がそれぞれ同じID
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
}
