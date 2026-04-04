<script lang="ts">
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';
  import {
    createGame,
    createGrid,
    toggleEdge,
    endStroke,
    undo,
    redo,
    resetGame,
    getVisitedCount,
    getPathCount,
    getMessage,
    posKey,
  } from '$lib/one-stroke/logic';
  import { SvelteSet } from 'svelte/reactivity';
  import type { Stage, Position } from '$lib/one-stroke/types';

  let gridSize = $state(6);
  let loading = $state(true);

  const emptyGrid = createGrid(6, 6);
  let stage = $state({ grid: emptyGrid, solution: [] as [Position, Position][] });
  let game = $state(createGame(emptyGrid, []));
  let showSolution = $state(false);
  let isDragging = $state(false);
  let lastCell: Position | null = $state(null);
  let nextStage: Stage | null = $state(null);
  let nextAttempt = $state(0);
  let preparingNext = $state(false);
  let currentWorker: Worker | null = null;
  let nextWorker: Worker | null = null;
  let generatingAttempt = $state(0);

  function createWorker(): Worker {
    return new Worker(new URL('$lib/one-stroke/generator.worker.ts', import.meta.url), {
      type: 'module',
    });
  }

  function generateAsync(
    rows: number,
    cols: number,
    onDone: (s: Stage) => void,
    onProgress?: (attempt: number) => void,
  ): Worker {
    const w = createWorker();
    w.onmessage = (e) => {
      const msg = e.data;
      if (msg?.type === 'progress') {
        onProgress?.(msg.attempt);
      } else if (msg?.type === 'done' && msg.stage?.grid) {
        onDone(msg.stage);
      }
    };
    w.postMessage({ rows, cols });
    return w;
  }

  function loadStage() {
    loading = true;
    generatingAttempt = 0;
    currentWorker?.terminate();
    nextWorker?.terminate();
    nextStage = null;
    preparingNext = false;
    nextAttempt = 0;
    currentWorker = generateAsync(
      gridSize,
      gridSize,
      (s) => {
        stage = s;
        game = createGame(s.grid, s.solution);
        loading = false;
        prepareNextStage();
      },
      (attempt) => {
        generatingAttempt = attempt;
      },
    );
  }

  onMount(() => {
    loadStage();
    return () => {
      currentWorker?.terminate();
      nextWorker?.terminate();
    };
  });

  let visitedCount = $derived(getVisitedCount(game));
  let pathCount = $derived(getPathCount(game.grid));
  let message = $derived(getMessage(game, visitedCount, pathCount));

  let visitedSet = $derived.by(() => {
    const s = new SvelteSet<string>();
    for (const e of game.edges) {
      s.add(posKey(e[0]));
      s.add(posKey(e[1]));
    }
    return s;
  });

  function edgeKey(a: Position, b: Position): string {
    const [r1, c1] = a;
    const [r2, c2] = b;
    if (r1 < r2 || (r1 === r2 && c1 <= c2)) return `${r1},${c1}-${r2},${c2}`;
    return `${r2},${c2}-${r1},${c1}`;
  }

  let edgeSet = $derived.by(() => {
    const s = new SvelteSet<string>();
    for (const e of game.edges) {
      s.add(edgeKey(e[0], e[1]));
    }
    return s;
  });

  let solutionEdgeSet = $derived.by(() => {
    const s = new SvelteSet<string>();
    for (const e of stage.solution) {
      s.add(edgeKey(e[0], e[1]));
    }
    return s;
  });

  function prepareNextStage() {
    nextStage = null;
    nextAttempt = 0;
    preparingNext = true;
    nextWorker?.terminate();
    nextWorker = generateAsync(
      gridSize,
      gridSize,
      (s) => {
        nextStage = s;
        preparingNext = false;
      },
      (attempt) => {
        nextAttempt = attempt;
      },
    );
  }

  function showNextStage() {
    if (nextStage) {
      stage = nextStage;
      game = createGame(stage.grid, stage.solution);
      showSolution = false;
      nextStage = null;
      prepareNextStage();
    }
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
    loadStage();
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
    isDragging = true;
    lastCell = pos;
    e.preventDefault();
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDragging || game.isCleared || showSolution) return;
    const pos = getCellPos(e);
    if (!pos) return;
    if (lastCell && pos[0] === lastCell[0] && pos[1] === lastCell[1]) return;

    if (lastCell) {
      game = toggleEdge(game, lastCell, pos);
    }
    lastCell = pos;
  }

  function handlePointerUp() {
    if (!isDragging) return;
    isDragging = false;
    lastCell = null;
    game = endStroke(game);
  }

  function hasEdgeBetween(a: Position, b: Position): boolean {
    return edgeSet.has(edgeKey(a, b));
  }

  function hasSolutionEdge(a: Position, b: Position): boolean {
    return solutionEdgeSet.has(edgeKey(a, b));
  }

  const sizes = [4, 6, 8];
</script>

<svelte:head>
  <title>一筆書き - Puzzle & Games</title>
</svelte:head>

<div class="one-stroke mx-auto max-w-[480px] select-none p-4">
  <a href={resolve('/', {})} class="mb-2 inline-block text-primary no-underline">&larr; 戻る</a>
  <h1 class="mb-2 text-3xl font-bold text-primary">一筆書き</h1>

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
    <span class="font-bold text-gray-700">{visitedCount}/{pathCount} マス通過</span>
    {#if message}
      <span class="font-bold {game.isCleared ? 'text-[var(--c-clear)]' : 'text-[var(--c-hint)]'}">
        {message}
      </span>
    {/if}
  </div>

  {#if loading}
    <div
      class="board"
      style="grid-template-columns: repeat({gridSize}, 1fr); grid-template-rows: repeat({gridSize}, 1fr);"
    ></div>
    <p class="mt-2 text-center text-sm text-gray-500">
      生成中...{#if generatingAttempt > 0}（{generatingAttempt}回試行）{/if}
    </p>
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
      {#each game.grid as row, r (r)}
        {#each row as cell, c (r * gridSize + c)}
          <div
            class="cell"
            class:wall={cell === 'wall'}
            class:visited={cell === 'path' && visitedSet.has(posKey([r, c]))}
            data-row={r}
            data-col={c}
          >
            {#if cell === 'path'}
              {#if c < gridSize - 1 && hasEdgeBetween([r, c], [r, c + 1])}
                <div class="edge edge-right"></div>
              {/if}
              {#if c > 0 && hasEdgeBetween([r, c], [r, c - 1])}
                <div class="edge edge-left"></div>
              {/if}
              {#if r < gridSize - 1 && hasEdgeBetween([r, c], [r + 1, c])}
                <div class="edge edge-down"></div>
              {/if}
              {#if r > 0 && hasEdgeBetween([r, c], [r - 1, c])}
                <div class="edge edge-up"></div>
              {/if}
              {#if showSolution}
                {#if c < gridSize - 1 && hasSolutionEdge([r, c], [r, c + 1])}
                  <div class="solution-edge edge-right"></div>
                {/if}
                {#if c > 0 && hasSolutionEdge([r, c], [r, c - 1])}
                  <div class="solution-edge edge-left"></div>
                {/if}
                {#if r < gridSize - 1 && hasSolutionEdge([r, c], [r + 1, c])}
                  <div class="solution-edge edge-down"></div>
                {/if}
                {#if r > 0 && hasSolutionEdge([r, c], [r - 1, c])}
                  <div class="solution-edge edge-up"></div>
                {/if}
              {/if}
              <div class="dot" class:dot-visited={visitedSet.has(posKey([r, c]))}></div>
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
      disabled={game.history.length === 0}
    >
      戻す
    </button>
    <button
      class="cursor-pointer rounded-md bg-[var(--c-accent)] px-4 py-2 text-sm font-bold text-white hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
      onclick={handleRedo}
      disabled={game.future.length === 0}
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
    {#if nextStage}
      <button
        class="cursor-pointer rounded-md bg-[var(--c-clear)] px-4 py-2 text-sm font-bold text-white hover:opacity-80"
        onclick={showNextStage}
      >
        次のステージ
      </button>
    {:else if preparingNext}
      <button
        class="cursor-pointer rounded-md bg-[var(--c-clear)] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
        disabled
      >
        次のステージ作成中{#if nextAttempt > 0}（{nextAttempt}回試行）{/if}
      </button>
    {/if}
  </div>
</div>

<style>
  .one-stroke {
    --c-accent: #3b82f6;
    --c-wall: #374151;
    --c-path: #e5e7eb;
    --c-visited: #93c5fd;
    --c-edge: #2563eb;
    --c-solution: #ef4444;
    --c-clear: #16a34a;
    --c-hint: #ea580c;
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
    background: var(--c-path);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    border-radius: 2px;
    transition: background-color 0.15s ease;
  }

  .cell.wall {
    background: var(--c-wall);
  }

  .cell.visited {
    background: var(--c-visited);
  }

  .dot {
    width: 20%;
    height: 20%;
    border-radius: 50%;
    background: #9ca3af;
    z-index: 1;
    pointer-events: none;
  }

  .dot-visited {
    background: #1d4ed8;
  }

  .edge,
  .solution-edge {
    position: absolute;
    border-radius: 2px;
    pointer-events: none;
  }

  .edge {
    background: var(--c-edge);
    z-index: 0;
  }

  .solution-edge {
    background: var(--c-solution);
    opacity: 0.6;
    z-index: 2;
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
