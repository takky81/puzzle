<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import { base } from '$app/paths';
  import {
    createGame,
    startStroke,
    extend,
    endStroke,
    undo,
    redo,
    resetGame,
    getConnectedCount,
    getTotalPairs,
    canUndo,
    canRedo,
  } from '$lib/numberlink/logic';
  import { pickRandomStage, type PuzzleFile } from '$lib/numberlink/stageLoader';
  import type { GameState, Position, Stage } from '$lib/numberlink/types';

  let gridSize = $state(4);
  let loading = $state(true);
  let loadError = $state<string | null>(null);

  const placeholderStage: Stage = { size: 4, numbers: [], solution: [] };
  let game = $state<GameState>(createGame(placeholderStage));
  let showSolution = $state(false);
  let isDragging = $state(false);
  let lastCell: Position | null = $state(null);
  let puzzleFile: PuzzleFile | null = null;

  const palette = [
    '#ef4444',
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#8b5cf6',
    '#ec4899',
    '#06b6d4',
    '#84cc16',
    '#f97316',
    '#a855f7',
  ];

  function colorFor(id: number): string {
    return palette[(id - 1) % palette.length];
  }

  function lightColorFor(id: number): string {
    const c = colorFor(id);
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0.25)`;
  }

  const cellKey = (r: number, c: number) => `${r},${c}`;
  const edgeKey = (r1: number, c1: number, r2: number, c2: number) =>
    r1 < r2 || (r1 === r2 && c1 <= c2) ? `${r1},${c1}-${r2},${c2}` : `${r2},${c2}-${r1},${c1}`;

  async function loadPuzzles() {
    loading = true;
    loadError = null;
    puzzleFile = null;
    try {
      const res = await fetch(`${base}/puzzles/numberlink/${gridSize}x${gridSize}.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      puzzleFile = (await res.json()) as PuzzleFile;
      const s = pickRandomStage(puzzleFile);
      game = createGame(s);
      loading = false;
    } catch (err) {
      loadError = err instanceof Error ? err.message : String(err);
      loading = false;
    }
  }

  onMount(() => {
    loadPuzzles();
  });

  let stage = $derived(game.stage);
  let connectedCount = $derived(getConnectedCount(game));
  let totalPairs = $derived(getTotalPairs(game));
  let indices = $derived(Array.from({ length: gridSize }, (_, i) => i));

  // 描画ホットパス用の事前計算: O(1) ルックアップで毎セル毎レンダーの走査を回避
  let numberCellMap = $derived.by(() => {
    const m = new SvelteMap<string, number>();
    for (const pair of stage.numbers) {
      for (const p of pair.positions) m.set(cellKey(p[0], p[1]), pair.id);
    }
    return m;
  });
  let ownerMap = $derived.by(() => {
    const m = new SvelteMap(numberCellMap);
    for (const path of game.paths) {
      for (const c of path.cells) {
        const k = cellKey(c[0], c[1]);
        if (!m.has(k)) m.set(k, path.id);
      }
    }
    return m;
  });
  let edgeMap = $derived.by(() => {
    const m = new SvelteMap<string, number>();
    for (const path of game.paths) {
      for (let k = 0; k < path.cells.length - 1; k++) {
        const [r1, c1] = path.cells[k];
        const [r2, c2] = path.cells[k + 1];
        m.set(edgeKey(r1, c1, r2, c2), path.id);
      }
    }
    return m;
  });
  let solutionEdgeMap = $derived.by(() => {
    const m = new SvelteMap<string, number>();
    for (const sol of stage.solution) {
      for (let k = 0; k < sol.path.length - 1; k++) {
        const [r1, c1] = sol.path[k];
        const [r2, c2] = sol.path[k + 1];
        m.set(edgeKey(r1, c1, r2, c2), sol.id);
      }
    }
    return m;
  });

  function showNextStage() {
    if (!puzzleFile) return;
    const s = pickRandomStage(puzzleFile);
    game = createGame(s);
    showSolution = false;
  }

  function handleReset() {
    showSolution = false;
    game = resetGame(game);
  }

  function handleUndo() {
    game = undo(game);
  }

  function handleRedo() {
    game = redo(game);
  }

  function handleGiveUp() {
    showSolution = true;
  }

  function handleChangeSize(size: number) {
    gridSize = size;
    showSolution = false;
    loadPuzzles();
  }

  function getCellPos(e: PointerEvent): Position | null {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return null;
    const cell = el.closest('[data-row]') as HTMLElement | null;
    if (!cell) return null;
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    if (isNaN(row) || isNaN(col)) return null;
    return [row, col];
  }

  function handlePointerDown(e: PointerEvent) {
    if (game.isCleared || showSolution) return;
    const pos = getCellPos(e);
    if (!pos) return;
    game = startStroke(game, pos);
    if (game.activeId !== null) {
      isDragging = true;
      lastCell = pos;
      e.preventDefault();
    }
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDragging || game.isCleared || showSolution) return;
    const pos = getCellPos(e);
    if (!pos) return;
    if (lastCell && pos[0] === lastCell[0] && pos[1] === lastCell[1]) return;

    game = extend(game, pos);
    lastCell = pos;
  }

  function handlePointerUp() {
    if (!isDragging) return;
    isDragging = false;
    lastCell = null;
    game = endStroke(game);
  }

  const sizes = [4, 5, 6, 7, 8, 9];
</script>

<svelte:head>
  <title>ナンバーリンク - Puzzle & Games</title>
</svelte:head>

<div class="numberlink mx-auto max-w-[480px] select-none">
  <h1 class="mb-2 text-3xl font-bold text-primary">ナンバーリンク</h1>

  <div class="mb-3 flex items-center gap-2">
    <span class="text-sm text-gray-600">サイズ:</span>
    {#each sizes as s (s)}
      <button
        class="cursor-pointer rounded border-2 border-[var(--c-accent)] px-3 py-1 text-sm font-bold {gridSize ===
        s
          ? 'bg-[var(--c-accent)] text-white'
          : 'bg-white text-[var(--c-accent)]'}"
        onclick={() => handleChangeSize(s)}
      >
        {s}x{s}
      </button>
    {/each}
  </div>

  <div class="mb-2 flex items-center justify-between text-sm">
    <span class="font-bold text-gray-700">{connectedCount}/{totalPairs} ペア接続</span>
    {#if game.isCleared}
      <span class="font-bold text-[var(--c-clear)]">クリア！</span>
    {/if}
  </div>

  {#if loading}
    <div
      class="board"
      style="grid-template-columns: repeat({gridSize}, 1fr); grid-template-rows: repeat({gridSize}, 1fr);"
    ></div>
    <p class="mt-2 text-center text-sm text-gray-500">読み込み中...</p>
  {:else if loadError}
    <div
      class="board"
      style="grid-template-columns: repeat({gridSize}, 1fr); grid-template-rows: repeat({gridSize}, 1fr);"
    ></div>
    <p class="mt-2 text-center text-sm text-red-600">読み込みに失敗しました: {loadError}</p>
  {:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="board"
      class:cleared={game.isCleared}
      style="grid-template-columns: repeat({gridSize}, 1fr);"
      onpointerdown={handlePointerDown}
      onpointermove={handlePointerMove}
      onpointerup={handlePointerUp}
      onpointerleave={handlePointerUp}
    >
      {#each indices as r (r)}
        {#each indices as c (r * gridSize + c)}
          {@const numberId = numberCellMap.get(cellKey(r, c))}
          {@const ownerId = ownerMap.get(cellKey(r, c))}
          {@const rightEdgeId = edgeMap.get(edgeKey(r, c, r, c + 1))}
          {@const leftEdgeId = edgeMap.get(edgeKey(r, c - 1, r, c))}
          {@const downEdgeId = edgeMap.get(edgeKey(r, c, r + 1, c))}
          {@const upEdgeId = edgeMap.get(edgeKey(r - 1, c, r, c))}
          {@const rightSolId = showSolution
            ? solutionEdgeMap.get(edgeKey(r, c, r, c + 1))
            : undefined}
          {@const leftSolId = showSolution
            ? solutionEdgeMap.get(edgeKey(r, c - 1, r, c))
            : undefined}
          {@const downSolId = showSolution
            ? solutionEdgeMap.get(edgeKey(r, c, r + 1, c))
            : undefined}
          {@const upSolId = showSolution ? solutionEdgeMap.get(edgeKey(r - 1, c, r, c)) : undefined}
          <div
            class="cell"
            class:number-cell={numberId !== undefined}
            style:background={numberId !== undefined
              ? colorFor(numberId)
              : ownerId !== undefined
                ? lightColorFor(ownerId)
                : undefined}
            data-row={r}
            data-col={c}
          >
            {#if numberId !== undefined}
              <span class="number">
                {numberId}
              </span>
            {/if}
            {#if numberId === undefined && c < gridSize - 1 && rightEdgeId !== undefined}
              <div class="edge edge-right" style:background={colorFor(rightEdgeId)}></div>
            {/if}
            {#if numberId === undefined && c > 0 && leftEdgeId !== undefined}
              <div class="edge edge-left" style:background={colorFor(leftEdgeId)}></div>
            {/if}
            {#if numberId === undefined && r < gridSize - 1 && downEdgeId !== undefined}
              <div class="edge edge-down" style:background={colorFor(downEdgeId)}></div>
            {/if}
            {#if numberId === undefined && r > 0 && upEdgeId !== undefined}
              <div class="edge edge-up" style:background={colorFor(upEdgeId)}></div>
            {/if}
            {#if numberId === undefined && c < gridSize - 1 && rightSolId !== undefined}
              <div class="solution-edge edge-right" style:background={colorFor(rightSolId)}></div>
            {/if}
            {#if numberId === undefined && c > 0 && leftSolId !== undefined}
              <div class="solution-edge edge-left" style:background={colorFor(leftSolId)}></div>
            {/if}
            {#if numberId === undefined && r < gridSize - 1 && downSolId !== undefined}
              <div class="solution-edge edge-down" style:background={colorFor(downSolId)}></div>
            {/if}
            {#if numberId === undefined && r > 0 && upSolId !== undefined}
              <div class="solution-edge edge-up" style:background={colorFor(upSolId)}></div>
            {/if}
          </div>
        {/each}
      {/each}
    </div>
  {/if}

  <div class="mt-3 flex flex-wrap justify-center gap-2">
    <button
      class="cursor-pointer rounded-md bg-[var(--c-accent)] px-4 py-2 text-sm font-bold text-white hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
      onclick={handleUndo}
      disabled={!canUndo(game)}
    >
      戻す
    </button>
    <button
      class="cursor-pointer rounded-md bg-[var(--c-accent)] px-4 py-2 text-sm font-bold text-white hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
      onclick={handleRedo}
      disabled={!canRedo(game)}
    >
      やり直し
    </button>
    <button
      class="cursor-pointer rounded-md bg-gray-500 px-4 py-2 text-sm font-bold text-white hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
      onclick={handleReset}
      disabled={loading}
    >
      リセット
    </button>
    <button
      class="cursor-pointer rounded-md bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
      onclick={handleGiveUp}
      disabled={loading}
    >
      ギブアップ
    </button>
    <button
      class="cursor-pointer rounded-md bg-[var(--c-clear)] px-4 py-2 text-sm font-bold text-white hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
      onclick={showNextStage}
      disabled={loading || !!loadError}
    >
      次のステージ
    </button>
  </div>
</div>

<style>
  .numberlink {
    --c-accent: #3b82f6;
    --c-clear: #16a34a;
  }

  .board {
    display: grid;
    gap: 2px;
    background: #9ca3af;
    border-radius: 4px;
    padding: 2px;
    aspect-ratio: 1;
    touch-action: none;
  }

  .board.cleared {
    animation: flash-border 1.5s ease-out;
  }

  @keyframes flash-border {
    0% {
      box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.8);
    }
    20% {
      box-shadow: 0 0 20px 8px rgba(22, 163, 74, 0.8);
    }
    50% {
      box-shadow: 0 0 30px 12px rgba(59, 130, 246, 0.6);
    }
    80% {
      box-shadow: 0 0 15px 4px rgba(22, 163, 74, 0.4);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(22, 163, 74, 0);
    }
  }

  .cell {
    background: #f3f4f6;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    border-radius: 2px;
    transition: background-color 0.15s ease;
  }

  .cell.number-cell {
    font-weight: 900;
    color: white;
  }

  .number {
    font-size: min(1.5rem, 5vw);
    font-weight: 900;
    z-index: 2;
    position: relative;
  }

  .edge,
  .solution-edge {
    position: absolute;
    border-radius: 2px;
    pointer-events: none;
  }

  .edge {
    z-index: 0;
  }

  .solution-edge {
    opacity: 0.5;
    z-index: 1;
  }

  .edge-right,
  .edge-left {
    top: 50%;
    transform: translateY(-50%);
    width: calc(50% + 6px);
    height: 4px;
  }

  .edge-right {
    right: -4px;
  }

  .edge-left {
    left: -4px;
  }

  .edge-down,
  .edge-up {
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: calc(50% + 6px);
  }

  .edge-down {
    bottom: -4px;
  }

  .edge-up {
    top: -4px;
  }
</style>
