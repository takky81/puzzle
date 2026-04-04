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

<div class="container">
  <a href={resolve('/', {})} class="back">&larr; 戻る</a>
  <h1>2048</h1>

  <div class="scores">
    <div class="score-box">
      <span class="score-label">SCORE</span>
      <span class="score-value">{state.score}</span>
    </div>
    <div class="score-box">
      <span class="score-label">BEST</span>
      <span class="score-value">{state.bestScore}</span>
    </div>
  </div>

  <div class="difficulty">
    {#each difficulties as d (d.value)}
      <button
        class="diff-btn"
        class:active={state.difficulty === d.value}
        onclick={() => handleDifficulty(d.value)}
      >
        {d.label}
      </button>
    {/each}
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="grid" ontouchstart={handleTouchStart} ontouchend={handleTouchEnd}>
    {#each state.board as row, r (r)}
      {#each row as cell, c (r * 4 + c)}
        <div
          class="cell"
          class:pop={state.lastMerged?.[r]?.[c] === true}
          class:appear={state.lastNewTile?.[0] === r && state.lastNewTile?.[1] === c}
          style:background-color={cell === 0 ? '#cdc1b4' : tileColor(cell)}
          style:color={textColor(cell)}
          style:font-size={fontSize(cell)}
        >
          {cell !== 0 ? cell : ''}
        </div>
      {/each}
    {/each}

    {#if message}
      <div class="overlay">
        <span class="message">{message}</span>
      </div>
    {/if}
  </div>

  <div class="controls">
    <button onclick={handleUndo} disabled={state.history.length === 0}>Undo</button>
    <button onclick={newGame}>New Game</button>
    <button onclick={handleRedo} disabled={state.future.length === 0}>Redo</button>
  </div>
</div>

<style>
  .container {
    max-width: 400px;
    margin: 0 auto;
    padding: 1rem;
    user-select: none;
  }

  .back {
    display: inline-block;
    margin-bottom: 1rem;
    color: #2c3e50;
    text-decoration: none;
  }

  h1 {
    margin-bottom: 0.5rem;
    color: #776e65;
    font-size: 2rem;
  }

  .scores {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .score-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: #bbada0;
    border-radius: 6px;
    padding: 0.25rem 1rem;
    min-width: 80px;
  }

  .score-label {
    font-size: 0.75rem;
    color: #eee4da;
    text-transform: uppercase;
  }

  .score-value {
    font-size: 1.25rem;
    font-weight: bold;
    color: white;
  }

  .difficulty {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 0.75rem;
  }

  .diff-btn {
    padding: 0.25rem 0.75rem;
    border: 2px solid #bbada0;
    border-radius: 4px;
    background: white;
    color: #776e65;
    font-weight: bold;
    cursor: pointer;
  }

  .diff-btn.active {
    background: #8f7a66;
    color: white;
    border-color: #8f7a66;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    background: #bbada0;
    border-radius: 8px;
    padding: 8px;
    aspect-ratio: 1;
    position: relative;
    touch-action: none;
  }

  .cell {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    font-weight: bold;
    transition:
      background-color 0.1s,
      transform 0.1s;
  }

  .overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(238, 228, 218, 0.73);
    border-radius: 8px;
  }

  .message {
    font-size: 2rem;
    font-weight: bold;
    color: #776e65;
  }

  .controls {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
    justify-content: center;
  }

  .controls button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 6px;
    background: #8f7a66;
    color: white;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
  }

  .controls button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

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
