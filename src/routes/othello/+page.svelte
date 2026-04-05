<script lang="ts">
  import {
    createGame,
    placeStone,
    getValidMoves,
    getScore,
    getWinner,
    opponent,
    passMove,
  } from '$lib/othello/logic';
  import { chooseRandomMove, chooseNormalMove, chooseHardMove, evaluate } from '$lib/othello/ai';
  import type { Color, Difficulty, GameMode, Position } from '$lib/othello/types';

  const colorLabel: Record<Color, string> = { black: '黒', white: '白' };

  let gameMode: GameMode = $state('pvp');
  let aiDifficulty: Difficulty = $state('normal');
  let aiDifficultyBlack: Difficulty = $state('normal');
  let aiDifficultyWhite: Difficulty = $state('normal');
  let playerColor: Color = $state('black');
  let aiMaxTimeSec = $state(3);
  let lastSearchDepth = $state(0);
  let game = $state(createGame());
  let aiThinking = $state(false);
  let aiTimeout: ReturnType<typeof setTimeout> | null = null;
  let eveTimeout: ReturnType<typeof setTimeout> | null = null;
  let eveSpeed = $state(500);

  let validMoveSet = $derived(
    new Set(getValidMoves(game.board, game.currentColor).map(([r, c]) => r * 8 + c)),
  );
  let flippedSet = $derived(new Set(game.flipped.map(([r, c]) => r * 8 + c)));
  let score = $derived(getScore(game.board));
  let winner = $derived(game.gameOver ? getWinner(game.board) : null);

  let blackAdvantage = $derived(
    Math.round(100 / (1 + Math.exp(-evaluate(game.board, 'black') / 100))),
  );
  let hasHardAI = $derived.by(() => {
    if (gameMode === 'pve') return aiDifficulty === 'hard';
    if (gameMode === 'eve') return aiDifficultyBlack === 'hard' || aiDifficultyWhite === 'hard';
    return false;
  });

  let message = $derived.by(() => {
    if (game.gameOver) {
      if (winner === 'black') return '黒の勝ち!';
      if (winner === 'white') return '白の勝ち!';
      return '引き分け!';
    }
    if (game.passed) return `${colorLabel[opponent(game.currentColor)]}はパスしました`;
    return '';
  });

  let turnLabel = $derived(`${colorLabel[game.currentColor]}の番`);

  function isValidMove(row: number, col: number): boolean {
    return validMoveSet.has(row * 8 + col);
  }

  function isFlipped(row: number, col: number): boolean {
    return flippedSet.has(row * 8 + col);
  }

  function handleCellClick(row: number, col: number) {
    if (game.gameOver || aiThinking) return;
    if (gameMode === 'eve') return;
    if (gameMode === 'pve' && game.currentColor !== playerColor) return;
    if (!isValidMove(row, col)) return;

    const result = placeStone(game, row, col);
    if (result) {
      game = result;
      if (gameMode === 'pve' && !game.gameOver && game.currentColor !== playerColor) {
        scheduleAiMove();
      }
    }
  }

  function applyPass(): boolean {
    const result = passMove(game);
    game = result;
    return !result.gameOver;
  }

  function chooseMove(difficulty: Difficulty): Position | null {
    const moves = getValidMoves(game.board, game.currentColor);
    if (moves.length === 0) return null;
    switch (difficulty) {
      case 'easy':
        return chooseRandomMove(game);
      case 'normal':
        return chooseNormalMove(game);
      case 'hard': {
        const result = chooseHardMove(game, { maxDepth: Infinity, maxTime: aiMaxTimeSec * 1000 });
        lastSearchDepth = result.depth;
        return result.move;
      }
    }
  }

  function scheduleAiMove() {
    if (game.gameOver) return;
    aiThinking = true;
    if (aiTimeout) clearTimeout(aiTimeout);
    aiTimeout = setTimeout(() => {
      if (game.gameOver) {
        aiThinking = false;
        return;
      }
      const move = chooseMove(aiDifficulty);
      if (move) {
        const result = placeStone(game, move[0], move[1]);
        if (result) {
          game = result;
          if (!game.gameOver && game.currentColor !== playerColor) {
            scheduleAiMove();
            return;
          }
        }
      } else {
        applyPass();
      }
      aiThinking = false;
    }, 300);
  }

  function resetGame() {
    stopEve();
    game = createGame();
    aiThinking = false;
    if (gameMode === 'pve' && playerColor !== 'black') {
      scheduleAiMove();
    }
    if (gameMode === 'eve') {
      startEve();
    }
  }

  function changeMode(mode: GameMode) {
    stopEve();
    gameMode = mode;
    resetGame();
  }

  function changePlayerColor(color: Color) {
    playerColor = color;
    resetGame();
  }

  function scheduleEveTurn() {
    eveTimeout = setTimeout(() => {
      if (game.gameOver) {
        stopEve();
        return;
      }
      const diff = game.currentColor === 'black' ? aiDifficultyBlack : aiDifficultyWhite;
      const move = chooseMove(diff);
      if (move) {
        const result = placeStone(game, move[0], move[1]);
        if (result) game = result;
      } else if (!applyPass()) {
        stopEve();
        return;
      }
      if (eveTimeout !== null) scheduleEveTurn();
    }, eveSpeed);
  }

  function startEve() {
    stopEve();
    scheduleEveTurn();
  }

  function stopEve() {
    if (eveTimeout) {
      clearTimeout(eveTimeout);
      eveTimeout = null;
    }
  }

  $effect(() => {
    return () => {
      stopEve();
      if (aiTimeout) clearTimeout(aiTimeout);
    };
  });

  const difficulties: { value: Difficulty; label: string }[] = [
    { value: 'easy', label: '弱い' },
    { value: 'normal', label: '普通' },
    { value: 'hard', label: '強い' },
  ];

  const modes: { value: GameMode; label: string }[] = [
    { value: 'pvp', label: '対人戦' },
    { value: 'pve', label: '対AI' },
    { value: 'eve', label: 'AI観戦' },
  ];
</script>

{#snippet thinkingTimeSlider()}
  <div class="flex flex-wrap items-center gap-1.5">
    <span class="min-w-20 text-sm text-gray-600">思考時間:</span>
    <input type="range" min="1" max="10" step="1" bind:value={aiMaxTimeSec} />
    <span class="text-sm text-gray-600">{aiMaxTimeSec}秒</span>
  </div>
{/snippet}

<svelte:head>
  <title>オセロ - Puzzle & Games</title>
</svelte:head>

<div class="othello mx-auto max-w-[480px] select-none">
  <h1 class="mb-2 text-3xl font-bold text-primary">オセロ</h1>

  <div class="mb-3 flex gap-1">
    {#each modes as m (m.value)}
      <button
        class="cursor-pointer rounded border-2 border-[var(--c-board)] px-3 py-1.5 text-sm font-bold {gameMode ===
        m.value
          ? 'bg-[var(--c-board)] text-white'
          : 'bg-white text-[var(--c-board)]'}"
        onclick={() => changeMode(m.value)}
      >
        {m.label}
      </button>
    {/each}
  </div>

  {#if gameMode === 'pve'}
    <div class="mb-3 flex flex-col gap-1.5">
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="min-w-20 text-sm text-gray-600">あなたの色:</span>
        <button
          class="cursor-pointer rounded border-2 px-2 py-1 text-sm {playerColor === 'black'
            ? 'border-gray-600 bg-gray-600 text-white'
            : 'border-gray-400 bg-white text-gray-600'}"
          onclick={() => changePlayerColor('black')}>黒</button
        >
        <button
          class="cursor-pointer rounded border-2 px-2 py-1 text-sm {playerColor === 'white'
            ? 'border-gray-600 bg-gray-600 text-white'
            : 'border-gray-400 bg-white text-gray-600'}"
          onclick={() => changePlayerColor('white')}>白</button
        >
      </div>
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="min-w-20 text-sm text-gray-600">AI難易度:</span>
        {#each difficulties as d (d.value)}
          <button
            class="cursor-pointer rounded border-2 px-2 py-1 text-sm {aiDifficulty === d.value
              ? 'border-gray-600 bg-gray-600 text-white'
              : 'border-gray-400 bg-white text-gray-600'}"
            onclick={() => {
              aiDifficulty = d.value;
              resetGame();
            }}
          >
            {d.label}
          </button>
        {/each}
      </div>
      {#if aiDifficulty === 'hard'}
        {@render thinkingTimeSlider()}
      {/if}
    </div>
  {/if}

  {#if gameMode === 'eve'}
    <div class="mb-3 flex flex-col gap-1.5">
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="min-w-20 text-sm text-gray-600">黒AI:</span>
        {#each difficulties as d (d.value)}
          <button
            class="cursor-pointer rounded border-2 px-2 py-1 text-sm {aiDifficultyBlack === d.value
              ? 'border-gray-600 bg-gray-600 text-white'
              : 'border-gray-400 bg-white text-gray-600'}"
            onclick={() => {
              aiDifficultyBlack = d.value;
              resetGame();
            }}
          >
            {d.label}
          </button>
        {/each}
      </div>
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="min-w-20 text-sm text-gray-600">白AI:</span>
        {#each difficulties as d (d.value)}
          <button
            class="cursor-pointer rounded border-2 px-2 py-1 text-sm {aiDifficultyWhite === d.value
              ? 'border-gray-600 bg-gray-600 text-white'
              : 'border-gray-400 bg-white text-gray-600'}"
            onclick={() => {
              aiDifficultyWhite = d.value;
              resetGame();
            }}
          >
            {d.label}
          </button>
        {/each}
      </div>
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="min-w-20 text-sm text-gray-600">速度:</span>
        <input
          type="range"
          min="100"
          max="2000"
          step="100"
          bind:value={eveSpeed}
          onchange={() => {
            if (eveTimeout) {
              startEve();
            }
          }}
        />
        <span class="text-sm text-gray-600">{eveSpeed}ms</span>
      </div>
      {#if aiDifficultyBlack === 'hard' || aiDifficultyWhite === 'hard'}
        {@render thinkingTimeSlider()}
      {/if}
    </div>
  {/if}

  <div class="mb-2">
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-1.5 text-xl font-bold">
        <span class="inline-block size-6 rounded-full bg-[var(--c-disc-black)]"></span>
        <span class="text-[var(--c-score-text)]">{score.black}</span>
      </div>
      <div class="text-base font-bold text-[var(--c-board)]">{turnLabel}</div>
      <div class="flex items-center gap-1.5 text-xl font-bold">
        <span class="inline-block size-6 rounded-full border-2 border-gray-300 bg-white"></span>
        <span class="text-[var(--c-score-text)]">{score.white}</span>
      </div>
    </div>
    <div class="advantage-bar mt-1.5">
      <div class="advantage-black" style="width: {blackAdvantage}%">
        {#if blackAdvantage >= 15}
          <span>{blackAdvantage}%</span>
        {/if}
      </div>
      <div class="advantage-white" style="width: {100 - blackAdvantage}%">
        {#if blackAdvantage <= 85}
          <span>{100 - blackAdvantage}%</span>
        {/if}
      </div>
    </div>
  </div>

  <div class="board">
    {#each game.board as row, r (r)}
      {#each row as cell, c (r * 8 + c)}
        <button
          class="cell"
          class:last-move={game.lastMove?.[0] === r && game.lastMove?.[1] === c}
          onclick={() => handleCellClick(r, c)}
          disabled={game.gameOver}
        >
          {#if cell}
            <span
              class="disc"
              class:black-disc={cell === 'black'}
              class:white-disc={cell === 'white'}
              class:flip={isFlipped(r, c)}
            ></span>
          {:else if !game.gameOver && !aiThinking && isValidMove(r, c)}
            <span class="hint"></span>
          {/if}
        </button>
      {/each}
    {/each}
  </div>

  {#if aiThinking}
    <div class="mt-2 animate-pulse text-center text-sm text-gray-500">AI思考中...</div>
  {:else if lastSearchDepth > 0 && hasHardAI}
    <div class="mt-2 text-center text-xs text-gray-400">{lastSearchDepth}手先まで読みました</div>
  {/if}

  {#if message}
    <div class="mt-2 text-center text-xl font-bold text-primary">{message}</div>
  {/if}

  <div class="mt-3 flex justify-center">
    <button
      class="cursor-pointer rounded-md bg-[var(--c-board)] px-6 py-2 text-base font-bold text-white hover:bg-[var(--c-board-hover)]"
      onclick={resetGame}
    >
      リセット
    </button>
  </div>
</div>

<style>
  .othello {
    --c-board: #2d8a4e;
    --c-board-hover: #246e3e;
    --c-board-line: #111;
    --c-score-text: #333;
    --c-disc-black-hi: #555;
    --c-disc-white-lo: #ccc;
    --c-disc-black: #333;
  }

  .advantage-bar {
    display: flex;
    height: 20px;
    border-radius: 4px;
    overflow: hidden;
    font-size: 11px;
    font-weight: bold;
  }

  .advantage-black {
    background: var(--c-disc-black);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0 4px;
    transition: width 0.3s ease;
  }

  .advantage-white {
    background: #eee;
    color: #333;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 0 4px;
    transition: width 0.3s ease;
  }

  .board {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 1px;
    background: var(--c-board-line);
    border-radius: 4px;
    padding: 2px;
    aspect-ratio: 1;
  }

  .cell {
    background: var(--c-board);
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    border: none;
    cursor: pointer;
    padding: 0;
    position: relative;
  }

  .cell.last-move {
    box-shadow: inset 0 0 0 2px rgba(255, 255, 0, 0.6);
  }

  .disc {
    width: 80%;
    height: 80%;
    border-radius: 50%;
    transition: transform 0.3s ease;
  }

  .black-disc {
    background: radial-gradient(circle at 35% 35%, var(--c-disc-black-hi), var(--c-board-line));
  }

  .white-disc {
    background: radial-gradient(circle at 35% 35%, #fff, var(--c-disc-white-lo));
  }

  .disc.flip {
    animation: flipDisc 0.4s ease;
  }

  @keyframes flipDisc {
    0% {
      transform: scaleX(1);
    }
    50% {
      transform: scaleX(0);
    }
    100% {
      transform: scaleX(1);
    }
  }

  .hint {
    width: 30%;
    height: 30%;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
  }

  .cell:hover .hint {
    background: rgba(255, 255, 255, 0.5);
  }
</style>
