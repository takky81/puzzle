<script lang="ts">
  import { resolve } from '$app/paths';
  import { createGame, placeStone, getValidMoves, getScore, getWinner } from '$lib/othello/logic';
  import { chooseRandomMove, chooseNormalMove, chooseHardMove } from '$lib/othello/ai';
  import type { Color, Difficulty, GameMode, Position } from '$lib/othello/types';

  let gameMode: GameMode = $state('pvp');
  let aiDifficulty: Difficulty = $state('normal');
  let aiDifficultyBlack: Difficulty = $state('normal');
  let aiDifficultyWhite: Difficulty = $state('normal');
  let playerColor: Color = $state('black');
  let game = $state(createGame());
  let aiThinking = $state(false);
  let eveInterval: ReturnType<typeof setInterval> | null = $state(null);
  let eveSpeed = $state(500);

  let validMoves = $derived(getValidMoves(game.board, game.currentColor));
  let score = $derived(getScore(game.board));
  let winner = $derived(game.gameOver ? getWinner(game.board) : null);

  let message = $derived.by(() => {
    if (game.gameOver) {
      if (winner === 'black') return '黒の勝ち!';
      if (winner === 'white') return '白の勝ち!';
      return '引き分け!';
    }
    if (game.passed) return `${game.currentColor === 'black' ? '白' : '黒'}はパスしました`;
    return '';
  });

  let turnLabel = $derived(game.currentColor === 'black' ? '黒の番' : '白の番');

  function isValidMove(row: number, col: number): boolean {
    return validMoves.some(([r, c]) => r === row && c === col);
  }

  function handleCellClick(row: number, col: number) {
    if (game.gameOver || aiThinking) return;
    if (gameMode === 'eve') return;
    if (gameMode === 'pve' && game.currentColor !== playerColor) return;
    if (!isValidMove(row, col)) return;

    const result = placeStone(game, row, col);
    if (result) {
      game = result;
      if (gameMode === 'pve' && !game.gameOver) {
        scheduleAiMove();
      }
    }
  }

  function scheduleAiMove() {
    if (game.gameOver) return;
    aiThinking = true;
    setTimeout(() => {
      if (game.gameOver) {
        aiThinking = false;
        return;
      }
      const move = getAiMove(aiDifficulty);
      if (move) {
        const result = placeStone(game, move[0], move[1]);
        if (result) game = result;
      }
      aiThinking = false;
    }, 300);
  }

  function getAiMove(difficulty: Difficulty): Position | null {
    const moves = getValidMoves(game.board, game.currentColor);
    if (moves.length === 0) return null;
    switch (difficulty) {
      case 'easy':
        return chooseRandomMove(game);
      case 'normal':
        return chooseNormalMove(game);
      case 'hard':
        return chooseHardMove(game);
    }
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

  function startEve() {
    stopEve();
    eveInterval = setInterval(() => {
      if (game.gameOver) {
        stopEve();
        return;
      }
      const diff = game.currentColor === 'black' ? aiDifficultyBlack : aiDifficultyWhite;
      const move = getAiMoveForEve(diff);
      if (move) {
        const result = placeStone(game, move[0], move[1]);
        if (result) game = result;
      }
    }, eveSpeed);
  }

  function getAiMoveForEve(difficulty: Difficulty): Position | null {
    const moves = getValidMoves(game.board, game.currentColor);
    if (moves.length === 0) return null;
    switch (difficulty) {
      case 'easy':
        return chooseRandomMove(game);
      case 'normal':
        return chooseNormalMove(game);
      case 'hard':
        return chooseHardMove(game);
    }
  }

  function stopEve() {
    if (eveInterval) {
      clearInterval(eveInterval);
      eveInterval = null;
    }
  }

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

<svelte:head>
  <title>オセロ - Puzzle & Games</title>
</svelte:head>

<div class="container">
  <a href={resolve('/', {})} class="back">&larr; 戻る</a>
  <h1>オセロ</h1>

  <div class="mode-selector">
    {#each modes as m (m.value)}
      <button
        class="mode-btn"
        class:active={gameMode === m.value}
        onclick={() => changeMode(m.value)}
      >
        {m.label}
      </button>
    {/each}
  </div>

  {#if gameMode === 'pve'}
    <div class="settings">
      <div class="setting-row">
        <span class="setting-label">あなたの色:</span>
        <button
          class="color-btn"
          class:active={playerColor === 'black'}
          onclick={() => changePlayerColor('black')}>黒</button
        >
        <button
          class="color-btn"
          class:active={playerColor === 'white'}
          onclick={() => changePlayerColor('white')}>白</button
        >
      </div>
      <div class="setting-row">
        <span class="setting-label">AI難易度:</span>
        {#each difficulties as d (d.value)}
          <button
            class="diff-btn"
            class:active={aiDifficulty === d.value}
            onclick={() => {
              aiDifficulty = d.value;
              resetGame();
            }}
          >
            {d.label}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  {#if gameMode === 'eve'}
    <div class="settings">
      <div class="setting-row">
        <span class="setting-label">黒AI:</span>
        {#each difficulties as d (d.value)}
          <button
            class="diff-btn"
            class:active={aiDifficultyBlack === d.value}
            onclick={() => {
              aiDifficultyBlack = d.value;
              resetGame();
            }}
          >
            {d.label}
          </button>
        {/each}
      </div>
      <div class="setting-row">
        <span class="setting-label">白AI:</span>
        {#each difficulties as d (d.value)}
          <button
            class="diff-btn"
            class:active={aiDifficultyWhite === d.value}
            onclick={() => {
              aiDifficultyWhite = d.value;
              resetGame();
            }}
          >
            {d.label}
          </button>
        {/each}
      </div>
      <div class="setting-row">
        <span class="setting-label">速度:</span>
        <input
          type="range"
          min="100"
          max="2000"
          step="100"
          bind:value={eveSpeed}
          onchange={() => {
            if (eveInterval) {
              startEve();
            }
          }}
        />
        <span>{eveSpeed}ms</span>
      </div>
    </div>
  {/if}

  <div class="info">
    <div class="score-area">
      <div class="score-box black-score">
        <span class="stone black-stone"></span>
        <span class="score-value">{score.black}</span>
      </div>
      <div class="turn-indicator">{turnLabel}</div>
      <div class="score-box white-score">
        <span class="stone white-stone"></span>
        <span class="score-value">{score.white}</span>
      </div>
    </div>
  </div>

  <div class="board">
    {#each game.board as row, r (r)}
      {#each row as cell, c (r * 8 + c)}
        <button
          class="cell"
          class:valid-move={!game.gameOver && !aiThinking && isValidMove(r, c)}
          class:last-move={game.lastMove?.[0] === r && game.lastMove?.[1] === c}
          onclick={() => handleCellClick(r, c)}
          disabled={game.gameOver}
        >
          {#if cell}
            <span
              class="disc"
              class:black-disc={cell === 'black'}
              class:white-disc={cell === 'white'}
              class:flip={game.flipped.some(([fr, fc]) => fr === r && fc === c)}
            ></span>
          {:else if !game.gameOver && !aiThinking && isValidMove(r, c)}
            <span class="hint"></span>
          {/if}
        </button>
      {/each}
    {/each}
  </div>

  {#if aiThinking}
    <div class="ai-thinking">AI思考中...</div>
  {/if}

  {#if message}
    <div class="message">{message}</div>
  {/if}

  <div class="controls">
    <button class="control-btn" onclick={resetGame}>リセット</button>
  </div>
</div>

<style>
  .container {
    max-width: 480px;
    margin: 0 auto;
    padding: 1rem;
    user-select: none;
  }

  .back {
    display: inline-block;
    margin-bottom: 0.5rem;
    color: #2c3e50;
    text-decoration: none;
  }

  h1 {
    margin-bottom: 0.5rem;
    color: #2c3e50;
    font-size: 1.75rem;
  }

  .mode-selector {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 0.75rem;
  }

  .mode-btn {
    padding: 0.375rem 0.75rem;
    border: 2px solid #2d8a4e;
    border-radius: 4px;
    background: white;
    color: #2d8a4e;
    font-weight: bold;
    cursor: pointer;
    font-size: 0.875rem;
  }

  .mode-btn.active {
    background: #2d8a4e;
    color: white;
  }

  .settings {
    margin-bottom: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .setting-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  .setting-label {
    font-size: 0.875rem;
    color: #555;
    min-width: 5rem;
  }

  .color-btn,
  .diff-btn {
    padding: 0.25rem 0.5rem;
    border: 2px solid #888;
    border-radius: 4px;
    background: white;
    color: #555;
    cursor: pointer;
    font-size: 0.8125rem;
  }

  .color-btn.active,
  .diff-btn.active {
    background: #555;
    color: white;
    border-color: #555;
  }

  .info {
    margin-bottom: 0.5rem;
  }

  .score-area {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .score-box {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 1.25rem;
    font-weight: bold;
  }

  .stone {
    display: inline-block;
    width: 24px;
    height: 24px;
    border-radius: 50%;
  }

  .black-stone {
    background: #333;
  }

  .white-stone {
    background: #fff;
    border: 2px solid #ccc;
  }

  .score-value {
    color: #333;
  }

  .turn-indicator {
    font-size: 1rem;
    font-weight: bold;
    color: #2d8a4e;
  }

  .board {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 1px;
    background: #111;
    border-radius: 4px;
    padding: 2px;
    aspect-ratio: 1;
    max-width: 480px;
  }

  .cell {
    background: #2d8a4e;
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
    background: radial-gradient(circle at 35% 35%, #555, #111);
  }

  .white-disc {
    background: radial-gradient(circle at 35% 35%, #fff, #ccc);
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

  .cell.valid-move:hover .hint {
    background: rgba(255, 255, 255, 0.5);
  }

  .ai-thinking {
    text-align: center;
    margin-top: 0.5rem;
    color: #888;
    font-size: 0.875rem;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .message {
    text-align: center;
    margin-top: 0.5rem;
    font-size: 1.25rem;
    font-weight: bold;
    color: #2c3e50;
  }

  .controls {
    display: flex;
    justify-content: center;
    margin-top: 0.75rem;
  }

  .control-btn {
    padding: 0.5rem 1.5rem;
    border: none;
    border-radius: 6px;
    background: #2d8a4e;
    color: white;
    font-size: 1rem;
    font-weight: bold;
    cursor: pointer;
  }

  .control-btn:hover {
    background: #246e3e;
  }
</style>
