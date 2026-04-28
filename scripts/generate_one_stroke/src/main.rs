//! Hamiltonian-cycle puzzle generator for one-stroke game.
//!
//! For each grid size n×n (4..=10):
//!   - Enumerate wall configurations (independent sets) in order of wall count.
//!   - After completing all patterns for a given wall count, stop if total ≥ 100.
//!   - Apply D4 symmetry pruning (rotation + reflection) so only canonical forms are checked.
//!   - Verify unique Hamiltonian cycle; output grid + solution edges as JSON.
//!
//! Usage:
//!   cargo run --release -- [output_dir]
//!   (default output_dir: ../../static/puzzles/one-stroke)

use rayon::prelude::*;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::time::Instant;

// ── Constants ─────────────────────────────────────────────────────────────────

const TARGET_PUZZLES: usize = 100;

fn node_limit(n: usize) -> u64 {
    match n {
        0..=7 => 5_000_000,
        8 | 9 => 500_000,
        _ => 100_000, // 10×10 and above
    }
}

// ── Bitmask type ──────────────────────────────────────────────────────────────

type Walls = u128;

#[inline]
fn is_wall(w: Walls, i: usize) -> bool {
    w >> i & 1 != 0
}

// ── Output types ──────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
struct Puzzle {
    grid: Vec<Vec<String>>,
    solution: Vec<[[usize; 2]; 2]>,
}

#[derive(Serialize)]
struct PuzzleFile {
    puzzles: Vec<Puzzle>,
}

// ── Grid helpers ──────────────────────────────────────────────────────────────

fn grid_nbrs(n: usize, i: usize) -> [Option<usize>; 4] {
    let (r, c) = (i / n, i % n);
    [
        if r > 0 { Some(i - n) } else { None },
        if r + 1 < n { Some(i + n) } else { None },
        if c > 0 { Some(i - 1) } else { None },
        if c + 1 < n { Some(i + 1) } else { None },
    ]
}

fn is_connected(n: usize, w: Walls) -> bool {
    let total = n * n;
    let start = match (0..total).find(|&i| !is_wall(w, i)) {
        Some(s) => s,
        None => return true,
    };
    let path_count = (0..total).filter(|&i| !is_wall(w, i)).count();
    let mut vis: u128 = 1 << start;
    let mut stack = vec![start];
    let mut count = 1usize;
    while let Some(cur) = stack.pop() {
        for nb in grid_nbrs(n, cur).into_iter().flatten() {
            if !is_wall(w, nb) && vis >> nb & 1 == 0 {
                vis |= 1 << nb;
                stack.push(nb);
                count += 1;
            }
        }
    }
    count == path_count
}

/// A Hamiltonian cycle on a bipartite graph requires equal black/white cell counts.
#[allow(dead_code)]
fn bipartite_balanced(n: usize, w: Walls) -> bool {
    let (mut black, mut white) = (0usize, 0usize);
    for i in 0..n * n {
        if !is_wall(w, i) {
            if (i / n + i % n) % 2 == 0 {
                black += 1;
            } else {
                white += 1;
            }
        }
    }
    black == white
}

// ── D4 symmetry ───────────────────────────────────────────────────────────────

fn apply_sym(n: usize, w: Walls, s: u8) -> Walls {
    let m = n - 1;
    let mut out = 0u128;
    for i in 0..n * n {
        if is_wall(w, i) {
            let (r, c) = (i / n, i % n);
            let (nr, nc) = match s {
                0 => (r, c),
                1 => (c, m - r),
                2 => (m - r, m - c),
                3 => (m - c, r),
                4 => (r, m - c),
                5 => (m - r, c),
                6 => (c, r),
                7 => (m - c, m - r),
                _ => unreachable!(),
            };
            out |= 1u128 << (nr * n + nc);
        }
    }
    out
}

fn is_canonical(n: usize, w: Walls) -> bool {
    (1u8..8).all(|s| apply_sym(n, w, s) >= w)
}

// ── Independent-set enumeration ───────────────────────────────────────────────

/// Enumerate all balanced independent sets with remaining budget (rem_b black, rem_w white),
/// starting at cell index `pos`, with walls already placed in `cur`.
fn bt_balanced(
    pos: usize,
    rem_b: usize,
    rem_w: usize,
    n: usize,
    total: usize,
    cur: Walls,
    cb: &mut impl FnMut(Walls),
) {
    if rem_b == 0 && rem_w == 0 {
        cb(cur);
        return;
    }
    let rem = rem_b + rem_w;
    if total - pos < rem {
        return;
    }
    for i in pos..total {
        let (r, c) = (i / n, i % n);
        let is_black = (r + c) % 2 == 0;
        if is_black && rem_b == 0 {
            continue;
        }
        if !is_black && rem_w == 0 {
            continue;
        }
        let ok = !(r > 0 && is_wall(cur, i - n)) && !(c > 0 && is_wall(cur, i - 1));
        if ok {
            let (nb, nw) = if is_black {
                (rem_b - 1, rem_w)
            } else {
                (rem_b, rem_w - 1)
            };
            bt_balanced(i + 1, nb, nw, n, total, cur | (1u128 << i), cb);
        }
    }
}

/// Collect all canonical, connected, balanced configurations for wall count k in parallel.
/// Parallelises over the first wall position so both enumeration and filtering are parallel.
fn collect_configs(n: usize, target_b: usize, target_w: usize) -> Vec<Walls> {
    let total = n * n;

    if target_b == 0 && target_w == 0 {
        // No walls: single configuration.
        let w: Walls = 0;
        return if is_canonical(n, w) && is_connected(n, w) {
            vec![w]
        } else {
            vec![]
        };
    }

    // Parallelise over the first wall position.
    // Each value of `first` spawns an independent subtree of the backtracking.
    (0..total)
        .into_par_iter()
        .flat_map_iter(|first| {
            let (r, c) = (first / n, first % n);
            let is_black = (r + c) % 2 == 0;
            let (rem_b, rem_w) = if is_black {
                if target_b == 0 {
                    return vec![];
                }
                (target_b - 1, target_w)
            } else {
                if target_w == 0 {
                    return vec![];
                }
                (target_b, target_w - 1)
            };
            let cur: Walls = 1u128 << first;
            let mut local = Vec::new();
            bt_balanced(first + 1, rem_b, rem_w, n, total, cur, &mut |w| {
                if is_canonical(n, w) && is_connected(n, w) {
                    local.push(w);
                }
            });
            local
        })
        .collect()
}

/// Returns (target_black, target_white) for a balanced configuration,
/// or None if no balanced configuration exists for this (n, k).
fn balanced_targets(n: usize, k: usize) -> Option<(usize, usize)> {
    let total = n * n;
    // black cells: (r+c)%2==0; count = ceil(n²/2)
    let black_total = (total + 1) / 2;
    let white_total = total / 2;
    // Need: black_total - a == white_total - b, a + b == k
    // → a - b = black_total - white_total = total % 2
    // For even n: total%2==0 → a==b==k/2 (only even k valid)
    // For odd n:  total%2==1 → a==b+1, so a=(k+1)/2, b=(k-1)/2 (only odd k valid)
    let diff = black_total - white_total; // 0 for even n, 1 for odd n
    // a = (k + diff) / 2, b = (k - diff) / 2; must be integers
    if (k + diff) % 2 != 0 {
        return None; // no integer solution → no valid puzzles for this k
    }
    let a = (k + diff) / 2;
    let b = (k - diff) / 2;
    if a > black_total || b > white_total {
        return None;
    }
    Some((a, b))
}

// ── Constraint-propagation solver ─────────────────────────────────────────────
//
// Models each path cell as needing exactly 2 connections from its neighbors.
//
//   options[v]   – bitmask: option bit i = edge to adj[v][i] is still possible
//   confirmed[v] – bitmask: bit i = edge to adj[v][i] is confirmed in the cycle
//
// Propagation rule: if confirmed[v] + options[v] == 2 → force all remaining options.
//                   if confirmed[v] == 2             → eliminate all remaining options.
//
// Backtracking branches on the first option of the cell with fewest remaining options.

#[derive(Clone)]
struct CpState {
    options: Vec<u8>,
    confirmed: Vec<u8>,
}

/// Returns `None` on timeout, `Some(None)` for 0 or ≥2 cycles, `Some(Some(path))` for unique.
fn solve_unique(n: usize, w: Walls, cells: &[usize]) -> Option<Option<Vec<usize>>> {
    let limit = node_limit(n);
    let num = cells.len();
    if num < 4 {
        return Some(None);
    }

    let mut cell_to_idx = vec![usize::MAX; n * n];
    for (i, &c) in cells.iter().enumerate() {
        cell_to_idx[c] = i;
    }

    let adj: Vec<Vec<usize>> = cells
        .iter()
        .map(|&c| {
            let mut a: Vec<usize> = grid_nbrs(n, c)
                .into_iter()
                .flatten()
                .filter(|&nb| !is_wall(w, nb))
                .map(|nb| cell_to_idx[nb])
                .collect();
            a.sort_unstable();
            a
        })
        .collect();

    if adj.iter().any(|a| a.len() < 2) {
        return Some(None);
    }

    // rev[v][i] = index of v in adj[adj[v][i]]  (reverse lookup)
    let rev: Vec<Vec<usize>> = (0..num)
        .map(|v| {
            adj[v]
                .iter()
                .map(|&u| adj[u].iter().position(|&x| x == v).unwrap())
                .collect()
        })
        .collect();

    let state = CpState {
        options: adj.iter().map(|a| (1u8 << a.len()) - 1).collect(),
        confirmed: vec![0u8; num],
    };

    let mut nodes = 0u64;
    let mut first: Option<CpState> = None;
    let dirty: Vec<usize> = (0..num).collect();

    let count = count_cp(&adj, &rev, num, state, dirty, 2, &mut nodes, limit, &mut first)?;

    if count == 1 {
        Some(Some(reconstruct_path(&adj, &first.unwrap(), num)))
    } else {
        Some(None)
    }
}

fn count_cp(
    adj: &[Vec<usize>],
    rev: &[Vec<usize>],
    num: usize,
    mut state: CpState,
    dirty: Vec<usize>,
    max_count: usize,
    nodes: &mut u64,
    limit: u64,
    first: &mut Option<CpState>,
) -> Option<usize> {
    *nodes += 1;
    if *nodes > limit {
        return None;
    }

    let mut dirty = dirty;
    if !propagate_cp(adj, rev, &mut state, &mut dirty) {
        return Some(0);
    }

    if has_premature_cycle(adj, &state, num) {
        return Some(0);
    }

    // Complete solution: all cells have exactly 2 confirmed edges and no remaining options.
    if (0..num).all(|v| state.options[v] == 0 && state.confirmed[v].count_ones() == 2) {
        if first.is_none() {
            *first = Some(state);
        }
        return Some(1);
    }

    // MRV heuristic: pick the cell with the fewest remaining options.
    let branch = match (0..num)
        .filter(|&v| state.options[v] != 0)
        .min_by_key(|&v| state.options[v].count_ones())
    {
        Some(b) => b,
        None => return Some(0), // options depleted but not complete → contradiction
    };

    let bit = state.options[branch].trailing_zeros() as usize;
    let u = adj[branch][bit];
    let j = rev[branch][bit];
    let mut total = 0usize;

    // Branch A: force edge (branch → u)
    {
        let mut sa = state.clone();
        sa.options[branch] &= !(1 << bit);
        sa.confirmed[branch] |= 1 << bit;
        sa.options[u] &= !(1 << j);
        sa.confirmed[u] |= 1 << j;
        let n = count_cp(adj, rev, num, sa, vec![branch, u], max_count, nodes, limit, first)?;
        total += n;
    }
    if total >= max_count {
        return Some(total);
    }

    // Branch B: eliminate edge (branch → u)
    {
        let mut sb = state;
        sb.options[branch] &= !(1 << bit);
        sb.options[u] &= !(1 << j);
        let remaining = max_count - total;
        let n = count_cp(adj, rev, num, sb, vec![branch, u], remaining, nodes, limit, first)?;
        total += n;
    }

    Some(total)
}

/// Propagates degree-2 constraints. Returns false on contradiction.
fn propagate_cp(
    adj: &[Vec<usize>],
    rev: &[Vec<usize>],
    state: &mut CpState,
    dirty: &mut Vec<usize>,
) -> bool {
    while let Some(v) = dirty.pop() {
        let conf = state.confirmed[v].count_ones() as usize;
        let opts = state.options[v].count_ones() as usize;

        if conf + opts < 2 || conf > 2 {
            return false;
        }

        if conf == 2 {
            // v is fully satisfied; eliminate all remaining options.
            let mut mask = state.options[v];
            state.options[v] = 0;
            while mask != 0 {
                let i = mask.trailing_zeros() as usize;
                mask &= mask - 1;
                let u = adj[v][i];
                let j = rev[v][i];
                if state.options[u] >> j & 1 != 0 {
                    state.options[u] &= !(1 << j);
                    dirty.push(u);
                }
            }
        } else if conf + opts == 2 {
            // v needs all its remaining options; force them all.
            let mask = state.options[v];
            let mut m = mask;
            while m != 0 {
                let i = m.trailing_zeros() as usize;
                m &= m - 1;
                let u = adj[v][i];
                let j = rev[v][i];
                // Force edge (v → u).
                state.options[v] &= !(1 << i);
                state.confirmed[v] |= 1 << i;
                if state.options[u] >> j & 1 != 0 {
                    state.options[u] &= !(1 << j);
                    state.confirmed[u] |= 1 << j;
                    dirty.push(u);
                } else if state.confirmed[u] >> j & 1 == 0 {
                    return false; // u already excluded this edge → contradiction
                }
            }
            dirty.push(v); // re-check v with updated confirmed count
        }
    }
    true
}

/// Returns true if confirmed edges form a closed sub-cycle that doesn't span all cells.
fn has_premature_cycle(adj: &[Vec<usize>], state: &CpState, num: usize) -> bool {
    let mut visited = vec![false; num];
    for start in 0..num {
        if visited[start] || state.confirmed[start] == 0 {
            visited[start] = true;
            continue;
        }
        let mut comp = Vec::new();
        let mut stack = vec![start];
        visited[start] = true;
        while let Some(v) = stack.pop() {
            comp.push(v);
            for i in 0..adj[v].len() {
                if state.confirmed[v] >> i & 1 != 0 {
                    let u = adj[v][i];
                    if !visited[u] {
                        visited[u] = true;
                        stack.push(u);
                    }
                }
            }
        }
        // Premature cycle: every cell in component has degree 2 in confirmed edges,
        // but the component doesn't include all cells.
        if comp.len() < num && comp.iter().all(|&v| state.confirmed[v].count_ones() == 2) {
            return true;
        }
    }
    false
}

/// Trace the Hamiltonian cycle from cell 0 using confirmed edges.
fn reconstruct_path(adj: &[Vec<usize>], state: &CpState, num: usize) -> Vec<usize> {
    let mut path = vec![0usize];
    let mut prev = usize::MAX;
    let mut cur = 0usize;
    for _ in 1..num {
        let next = (0..adj[cur].len()).find_map(|i| {
            if state.confirmed[cur] >> i & 1 != 0 && adj[cur][i] != prev {
                Some(adj[cur][i])
            } else {
                None
            }
        });
        match next {
            Some(nb) => {
                path.push(nb);
                prev = cur;
                cur = nb;
            }
            None => break,
        }
    }
    path
}

// ── Puzzle assembly ───────────────────────────────────────────────────────────

fn make_puzzle(n: usize, w: Walls, cells: &[usize], path: &[usize]) -> Puzzle {
    let grid: Vec<Vec<String>> = (0..n)
        .map(|r| {
            (0..n)
                .map(|c| {
                    if is_wall(w, r * n + c) {
                        "wall".into()
                    } else {
                        "path".into()
                    }
                })
                .collect()
        })
        .collect();

    let m = path.len();
    let solution: Vec<[[usize; 2]; 2]> = (0..m)
        .map(|k| {
            let a = cells[path[k]];
            let b = cells[path[(k + 1) % m]];
            [[a / n, a % n], [b / n, b % n]]
        })
        .collect();

    Puzzle { grid, solution }
}

// ── Per-size generation ───────────────────────────────────────────────────────

fn generate(n: usize) -> Vec<Puzzle> {
    let mut puzzles: Vec<Puzzle> = Vec::new();
    let total = n * n;
    let max_k = total / 2;

    'wall_loop: for k in 0..=max_k {
        // Skip k values where no balanced configuration exists (e.g., odd k on even-n grid).
        let (target_b, target_w) = match balanced_targets(n, k) {
            Some(t) => t,
            None => continue,
        };

        // Enumerate canonical connected balanced configurations in parallel.
        let configs = collect_configs(n, target_b, target_w);
        let num_configs = configs.len();
        eprintln!("  k={k} ({target_b}B+{target_w}W): {num_configs} configs to check ...");

        let new_puzzles: Vec<Puzzle> = configs
            .into_par_iter()
            .filter_map(|w| {
                let cells: Vec<usize> = (0..total).filter(|&i| !is_wall(w, i)).collect();
                match solve_unique(n, w, &cells) {
                    Some(Some(path)) => Some(make_puzzle(n, w, &cells, &path)),
                    _ => None,
                }
            })
            .collect();

        let added = new_puzzles.len();
        puzzles.extend(new_puzzles);

        eprintln!("  k={k}: +{added} puzzles (total {})", puzzles.len());

        if puzzles.len() >= TARGET_PUZZLES {
            break 'wall_loop;
        }
    }

    puzzles
}

// ── Main ──────────────────────────────────────────────────────────────────────

fn main() {
    let out_dir = std::env::args()
        .nth(1)
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("../../static/puzzles/one-stroke"));

    fs::create_dir_all(&out_dir).expect("cannot create output directory");

    for n in 4..=10 {
        let t = Instant::now();
        eprintln!("=== {}×{} ===", n, n);

        let puzzles = generate(n);

        eprintln!(
            "→ {} puzzles  ({:.1}s)",
            puzzles.len(),
            t.elapsed().as_secs_f64()
        );

        let json = serde_json::to_string_pretty(&PuzzleFile { puzzles }).unwrap();
        let file = out_dir.join(format!("{}x{}.json", n, n));
        fs::write(&file, &json).unwrap();
        eprintln!("  written: {}", file.display());
    }
}
