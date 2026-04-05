<script lang="ts">
  import { resolve } from '$app/paths';
  import { browser } from '$app/environment';
  import { initGame, moveAndAddTile, undo, redo, changeDifficulty } from '$lib/game2048/logic';
  import type { Difficulty, Direction } from '$lib/game2048/types';

  function loadBestScore(): number {
    if (!browser) return 0;
    return Number(localStorage.getItem('game2048-best-score') ?? '0');
  }

  const initialState = initGame();
  initialState.bestScore = loadBestScore();
  let state = $state(initialState);

  const tileColors: Record<number, string> = {
    2: '#eee4da',
    4: '#ede0c8',
    8: '#f2b179',
    16: '#f59563',
    32: '#f67c5f',
    64: '#f65e3b',
    128: '#edcf72',
    256: '#edcc61',
    512: '#edc850',
    1024: '#edc53f',
    2048: '#edc22e',
  };

  function tileColor(value: number): string {
    return tileColors[value] ?? '#3c3a32';
  }

  function textColor(value: number): string {
    return value <= 4 ? '#776e65' : '#f9f6f2';
  }

  function fontSize(value: number): string {
    if (value >= 1024) return '1.5rem';
    if (value >= 128) return '1.75rem';
    return '2rem';
  }

  function handleKeydown(e: KeyboardEvent) {
    const keyMap: Record<string, Direction> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      w: 'up',
      s: 'down',
      a: 'left',
      d: 'right',
    };
    const direction = keyMap[e.key];
    if (direction) {
      e.preventDefault();
      move(direction);
    }
  }

  function move(direction: Direction) {
    if (state.isGameOver) return;
    state = moveAndAddTile(state, direction);
    if (browser && state.bestScore > loadBestScore()) {
      localStorage.setItem('game2048-best-score', String(state.bestScore));
    }
  }

  function newGame() {
    const { difficulty, bestScore } = state;
    state = { ...changeDifficulty(initGame(), difficulty), bestScore };
  }

  function handleUndo() {
    state = undo(state);
  }

  function handleRedo() {
    state = redo(state);
  }

  function handleDifficulty(d: Difficulty) {
    state = changeDifficulty(state, d);
  }

  // スワイプ対応
  let touchStartX = 0;
  let touchStartY = 0;

  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }

  function handleTouchEnd(e: TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) < 30) return;

    if (absDx > absDy) {
      move(dx > 0 ? 'right' : 'left');
    } else {
      move(dy > 0 ? 'down' : 'up');
    }
  }

  const difficulties: { value: Difficulty; label: string }[] = [
    { value: 'easy', label: 'Easy' },
    { value: 'random', label: 'Random' },
    { value: 'hard', label: 'Hard' },
  ];

  let message = $derived(state.isWin ? '2048達成!' : state.isGameOver ? 'Game Over' : '');
</script>

<svelte:head>
  <title>2048 - Puzzle & Games</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="mx-auto max-w-[400px] select-none p-4">
  <a href={resolve('/', {})} class="mb-2 inline-block text-primary no-underline">&larr; 戻る</a>
  <h1 class="mb-2 text-3xl font-bold text-[#776e65]">2048</h1>

  <div class="mb-3 flex gap-2">
    <div class="score-box flex min-w-20 flex-col items-center rounded-md bg-[#bbada0] px-4 py-1">
      <span class="score-label text-xs uppercase text-[#eee4da]">SCORE</span>
      <span class="score-value text-xl font-bold text-white">{state.score}</span>
    </div>
    <div class="score-box flex min-w-20 flex-col items-center rounded-md bg-[#bbada0] px-4 py-1">
      <span class="score-label text-xs uppercase text-[#eee4da]">BEST</span>
      <span class="score-value text-xl font-bold text-white">{state.bestScore}</span>
    </div>
  </div>

  <div class="mb-3 flex gap-1">
    {#each difficulties as d (d.value)}
      <button
        class="diff-btn cursor-pointer rounded border-2 px-3 py-1 font-bold {state.difficulty ===
        d.value
          ? 'active border-[#8f7a66] bg-[#8f7a66] text-white'
          : 'border-[#bbada0] bg-white text-[#776e65]'}"
        onclick={() => handleDifficulty(d.value)}
      >
        {d.label}
      </button>
    {/each}
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="grid aspect-square grid-cols-4 gap-2 rounded-lg bg-[#bbada0] p-2 touch-none relative"
    ontouchstart={handleTouchStart}
    ontouchend={handleTouchEnd}
  >
    {#each state.board as row, r (r)}
      {#each row as cell, c (r * 4 + c)}
        <div
          class="cell flex items-center justify-center rounded-md font-bold transition-all duration-100
            {state.lastMerged?.[r]?.[c] === true ? 'pop' : ''}
            {state.lastNewTile?.[0] === r && state.lastNewTile?.[1] === c ? 'appear' : ''}"
          style:background-color={cell === 0 ? '#cdc1b4' : tileColor(cell)}
          style:color={textColor(cell)}
          style:font-size={fontSize(cell)}
        >
          {cell !== 0 ? cell : ''}
        </div>
      {/each}
    {/each}

    {#if message}
      <div
        class="overlay absolute inset-0 flex items-center justify-center rounded-lg bg-[rgba(238,228,218,0.73)]"
      >
        <span class="message text-3xl font-bold text-[#776e65]">{message}</span>
      </div>
    {/if}
  </div>

  <div class="mt-3 flex justify-center gap-2">
    <button
      class="rounded-md bg-[#8f7a66] px-4 py-2 text-base font-bold text-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      onclick={handleUndo}
      disabled={state.history.length === 0}
    >
      Undo
    </button>
    <button
      class="rounded-md bg-[#8f7a66] px-4 py-2 text-base font-bold text-white cursor-pointer"
      onclick={newGame}
    >
      New Game
    </button>
    <button
      class="rounded-md bg-[#8f7a66] px-4 py-2 text-base font-bold text-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      onclick={handleRedo}
      disabled={state.future.length === 0}
    >
      Redo
    </button>
  </div>
</div>

<style>
  .cell.pop {
    animation: pop 0.2s ease;
  }

  .cell.appear {
    animation: appear 0.2s ease;
  }

  @keyframes pop {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1);
    }
  }

  @keyframes appear {
    0% {
      transform: scale(0);
      opacity: 0;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
</style>
