<script lang="ts">
  import { browser } from '$app/environment';
  import {
    createInitialState,
    drawNumber,
    continueGame,
    getRanks,
    defaultConfig,
    defaultPlayerName,
    TOTAL_NUMBERS,
    GOALS,
    MIN_PLAYERS,
    MAX_PLAYERS,
    MIN_INTERVAL_MS,
    MAX_INTERVAL_MS,
    MAX_NAME_LENGTH,
  } from '$lib/bingo/logic';
  import { columnLabelOf, getBingoLines, getReachPositions, COLUMN_LABELS } from '$lib/bingo/card';
  import { loadLastConfig, saveLastConfig } from '$lib/bingo/storage';
  import type { Card, GameConfig, GameState, Goal, Player, PlayerType } from '$lib/bingo/types';

  type Screen = 'setup' | 'playing';

  const goalLabels: Record<Goal, string> = {
    single: '1ライン',
    triple: '3ライン',
    blackout: 'ブラックアウト',
  };

  const goalDescriptions: Record<Goal, string> = {
    single: '最初に1ライン揃えた人の勝ち',
    triple: '最初に3ライン揃えた人の勝ち',
    blackout: 'FREE以外の24マスを全て埋めた人の勝ち',
  };

  let screen: Screen = $state('setup');
  let game: GameState | null = $state(null);
  let autoDraw = $state(false);
  let showAllNumbers = $state(false);
  let toastDismissed = $state(false);

  const allNumbers = Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1);

  let ranks = $derived.by(() => {
    const current = game;
    return current === null ? new Map<number, number>() : getRanks(current.players);
  });

  /** 全員が目標を達成したか（継続プレイの終了） */
  let allAchieved = $derived.by(() => {
    const current = game;
    return current !== null && current.players.every((player) => player.achievedAt !== null);
  });

  let showToast = $derived.by(() => {
    const current = game;
    return current !== null && current.phase === 'finished' && !toastDismissed;
  });

  let winnerNames = $derived.by(() => {
    const current = game;
    if (current === null) return [];
    return current.winners.map(
      (id) => current.players.find((player) => player.id === id)?.name ?? '',
    );
  });
  let config: GameConfig = $state(browser ? loadLastConfig() : defaultConfig());

  /** 名前をユーザーが編集したかどうか（未編集なら種別変更に追従する） */
  let nameEdited: boolean[] = $state(config.playerNames.map(() => false));

  let playerCount = $derived(config.playerTypes.length);

  function setPlayerCount(count: number) {
    const types: PlayerType[] = [];
    const names: string[] = [];
    const edited: boolean[] = [];
    for (let i = 0; i < count; i++) {
      const type = config.playerTypes[i] ?? 'cpu';
      types.push(type);
      edited.push(nameEdited[i] ?? false);
      names.push(edited[i] ? config.playerNames[i] : defaultPlayerName(type, i));
    }
    config.playerTypes = types;
    config.playerNames = names;
    nameEdited = edited;
  }

  function setPlayerType(index: number, type: PlayerType) {
    config.playerTypes[index] = type;
    if (!nameEdited[index]) {
      config.playerNames[index] = defaultPlayerName(type, index);
    }
  }

  function handleNameInput(index: number) {
    nameEdited[index] = true;
  }

  function startGame() {
    // 空欄は既定名に戻す
    config.playerNames = config.playerNames.map((name, index) =>
      name.trim() === '' ? defaultPlayerName(config.playerTypes[index], index) : name.trim(),
    );
    if (browser) saveLastConfig(config);
    game = createInitialState($state.snapshot(config), Math.random);
    autoDraw = false;
    toastDismissed = false;
    screen = 'playing';
  }

  function restart() {
    if (game === null) return;
    game = createInitialState(game.config, Math.random);
    autoDraw = false;
    toastDismissed = false;
  }

  /** 決着後もそのまま抽選を続ける */
  function keepPlaying() {
    if (game === null || game.phase !== 'finished') return;
    game = continueGame(game);
    toastDismissed = false;
  }

  function draw() {
    if (game === null || game.phase !== 'playing') return;
    game = drawNumber(game, Math.random);
    if (game.phase === 'finished') autoDraw = false;
  }

  // 自動抽選: 一定間隔で抽選を進める（タイマーという外部との連携なので $effect を使う）
  // 依存は autoDraw と間隔のみ。game を参照するとタイマーが毎回張り直されてしまう
  $effect(() => {
    if (!autoDraw) return;
    const timer = setInterval(draw, config.autoDrawIntervalMs);
    return () => clearInterval(timer);
  });

  function handleKeydown(event: KeyboardEvent) {
    if (screen !== 'playing' || event.code !== 'Space') return;
    const target = event.target as HTMLElement | null;
    if (target?.tagName === 'INPUT' || target?.tagName === 'BUTTON') return;
    event.preventDefault();
    draw();
  }

  function backToSetup() {
    game = null;
    autoDraw = false;
    toastDismissed = false;
    screen = 'setup';
  }

  /** マスの位置を一意なキー（row * 5 + col）にする */
  function cellKey(row: number, col: number): number {
    return row * 5 + col;
  }

  /** 成立ライン上のマスのキー一覧 */
  function bingoCellKeys(card: Card): number[] {
    return getBingoLines(card).flatMap((line) =>
      line.positions.map(({ row, col }) => cellKey(row, col)),
    );
  }

  /** リーチで残っているマスのキー一覧 */
  function reachCellKeys(card: Card): number[] {
    return getReachPositions(card).map(({ row, col }) => cellKey(row, col));
  }

  function playerLabel(player: Player): string {
    return player.type === 'human' ? '🙂' : '🤖';
  }
</script>

<svelte:head>
  <title>ビンゴ - Puzzle & Games</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<h1 class="mb-4 text-2xl font-bold">ビンゴ</h1>

{#if screen === 'setup'}
  <section class="mx-auto max-w-[520px] rounded-xl bg-white p-5 shadow-md">
    <h2 class="mb-4 text-lg font-bold">ゲーム設定</h2>

    <div class="mb-5">
      <span class="mb-2 block text-sm font-bold">プレイヤー人数</span>
      <div class="flex gap-2">
        {#each Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => i + MIN_PLAYERS) as count (count)}
          <button
            type="button"
            class="flex-1 rounded-lg border-2 px-3 py-2 font-bold transition-colors"
            class:border-primary={playerCount === count}
            class:bg-primary={playerCount === count}
            class:text-white={playerCount === count}
            class:border-gray-200={playerCount !== count}
            onclick={() => setPlayerCount(count)}
            aria-pressed={playerCount === count}
          >
            {count}人
          </button>
        {/each}
      </div>
    </div>

    <div class="mb-5">
      <span class="mb-2 block text-sm font-bold">プレイヤー</span>
      <ul class="flex flex-col gap-2">
        {#each config.playerTypes as type, index (index)}
          <li class="flex items-center gap-2">
            <input
              type="text"
              class="min-w-0 flex-1 rounded-lg border-2 border-gray-200 px-3 py-2"
              maxlength={MAX_NAME_LENGTH}
              aria-label={`プレイヤー${index + 1}の名前`}
              bind:value={config.playerNames[index]}
              oninput={() => handleNameInput(index)}
            />
            <div class="flex shrink-0 overflow-hidden rounded-lg border-2 border-gray-200">
              <button
                type="button"
                class="px-3 py-2 text-sm font-bold transition-colors"
                class:bg-primary={type === 'human'}
                class:text-white={type === 'human'}
                onclick={() => setPlayerType(index, 'human')}
                aria-pressed={type === 'human'}
              >
                人間
              </button>
              <button
                type="button"
                class="px-3 py-2 text-sm font-bold transition-colors"
                class:bg-primary={type === 'cpu'}
                class:text-white={type === 'cpu'}
                onclick={() => setPlayerType(index, 'cpu')}
                aria-pressed={type === 'cpu'}
              >
                CPU
              </button>
            </div>
          </li>
        {/each}
      </ul>
    </div>

    <div class="mb-5">
      <span class="mb-2 block text-sm font-bold">目標</span>
      <div class="flex flex-col gap-2">
        {#each GOALS as goal (goal)}
          <button
            type="button"
            class="rounded-lg border-2 px-3 py-2 text-left transition-colors"
            class:border-primary={config.goal === goal}
            class:border-gray-200={config.goal !== goal}
            onclick={() => (config.goal = goal)}
            aria-pressed={config.goal === goal}
          >
            <span class="block font-bold">{goalLabels[goal]}</span>
            <span class="block text-xs text-base-muted">{goalDescriptions[goal]}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="mb-6">
      <label class="mb-2 block text-sm font-bold" for="auto-interval">
        自動抽選の間隔: {config.autoDrawIntervalMs} ms
      </label>
      <input
        id="auto-interval"
        type="range"
        class="w-full"
        min={MIN_INTERVAL_MS}
        max={MAX_INTERVAL_MS}
        step="100"
        bind:value={config.autoDrawIntervalMs}
      />
    </div>

    <button
      type="button"
      class="w-full rounded-lg bg-primary px-4 py-3 text-lg font-bold text-white"
      onclick={startGame}
    >
      ゲーム開始
    </button>
  </section>
{:else if game !== null}
  <section class="mx-auto max-w-[720px]">
    <div class="sticky top-0 z-[5] mb-4 rounded-xl bg-white p-4 shadow-md">
      <div class="flex items-center gap-4">
        <div
          class="ball flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-full border-4 border-primary bg-white"
          data-testid="current-ball"
        >
          {#if game.lastDrawn === null}
            <span class="text-sm text-base-muted">--</span>
          {:else}
            <span class="text-xs font-bold text-primary">{columnLabelOf(game.lastDrawn)}</span>
            <span class="text-3xl font-bold leading-none">{game.lastDrawn}</span>
          {/if}
        </div>

        <div class="min-w-0 flex-1">
          <p class="mb-2 text-sm text-base-muted">
            抽選回数 <span data-testid="draw-count">{game.drawn.length}</span> / {TOTAL_NUMBERS}
          </p>
          <div class="flex gap-2">
            <button
              type="button"
              class="flex-1 rounded-lg bg-primary px-4 py-3 font-bold text-white disabled:opacity-40"
              onclick={draw}
              disabled={game.phase !== 'playing'}
            >
              抽選する
            </button>
            <button
              type="button"
              class="shrink-0 rounded-lg border-2 px-4 py-3 font-bold disabled:opacity-40"
              class:border-primary={autoDraw}
              class:bg-primary={autoDraw}
              class:text-white={autoDraw}
              class:border-gray-200={!autoDraw}
              onclick={() => (autoDraw = !autoDraw)}
              disabled={game.phase !== 'playing'}
              aria-pressed={autoDraw}
            >
              自動
            </button>
          </div>
        </div>
      </div>

      {#if game.drawn.length > 0}
        <ul class="mt-3 flex flex-wrap gap-1" data-testid="draw-history">
          {#each [...game.drawn].reverse() as value (value)}
            <li
              class="rounded bg-gray-100 px-2 py-1 text-xs font-bold tabular-nums text-base-muted"
            >
              {columnLabelOf(value)}{value}
            </li>
          {/each}
        </ul>
      {/if}

      <button
        type="button"
        class="mt-2 text-xs font-bold text-primary underline"
        onclick={() => (showAllNumbers = !showAllNumbers)}
        aria-expanded={showAllNumbers}
      >
        {showAllNumbers ? '一覧を閉じる' : 'すべて表示'}
      </button>

      {#if showAllNumbers}
        {@const drawnNumbers = game.drawn}
        <ul
          class="mt-2 grid grid-cols-[repeat(15,minmax(0,1fr))] gap-[2px]"
          data-testid="all-numbers"
        >
          {#each allNumbers as value (value)}
            <li
              class="number flex aspect-square items-center justify-center rounded-[2px] text-[10px] font-bold tabular-nums"
              class:drawn={drawnNumbers.includes(value)}
            >
              {value}
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    <ul class="grid gap-4" class:sm:grid-cols-2={game.players.length > 1} data-testid="card-list">
      {#each game.players as player (player.id)}
        {@const bingoKeys = bingoCellKeys(player.card)}
        {@const reachKeys = reachCellKeys(player.card)}
        <li
          class="rounded-xl bg-white p-3 shadow-md"
          class:is-cpu={player.type === 'cpu'}
          data-testid="player-card"
        >
          <div class="mb-2 flex items-center justify-between gap-2">
            <span class="truncate font-bold">
              {playerLabel(player)}
              {player.name}
            </span>
            <span class="flex shrink-0 items-center gap-1 text-xs font-bold">
              {#if ranks.has(player.id)}
                <span class="rounded bg-primary px-1.5 py-0.5 text-white" data-testid="rank-badge">
                  {ranks.get(player.id)}位
                </span>
              {/if}
              {#if player.bingoLines > 0}
                <span class="rounded bg-amber-500 px-1.5 py-0.5 text-white">
                  BINGO {player.bingoLines}
                </span>
              {:else if player.reachLines > 0}
                <span class="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">
                  リーチ {player.reachLines}
                </span>
              {/if}
              <span class="text-base-muted">{player.bingoLines} / {player.reachLines}</span>
            </span>
          </div>

          <div class="grid grid-cols-5 gap-1">
            {#each COLUMN_LABELS as label (label)}
              <span class="text-center text-sm font-bold text-primary">{label}</span>
            {/each}
          </div>

          <div class="mt-1 grid grid-cols-5 gap-1">
            {#each player.card.cells as cells, row (row)}
              {#each cells as cell, col (col)}
                <span
                  class="cell flex aspect-square items-center justify-center rounded text-sm font-bold tabular-nums"
                  class:marked={cell.marked}
                  class:bingo={bingoKeys.includes(cellKey(row, col))}
                  class:reach={reachKeys.includes(cellKey(row, col))}
                  class:just-marked={cell.value !== null && cell.value === game.lastDrawn}
                >
                  {cell.value === null ? 'FREE' : cell.value}
                </span>
              {/each}
            {/each}
          </div>
        </li>
      {/each}
    </ul>

    <button
      type="button"
      class="mt-4 w-full rounded-lg border-2 border-gray-200 px-4 py-2 font-bold"
      onclick={backToSetup}
    >
      設定を変える
    </button>
  </section>

  {#if showToast}
    <div
      class="toast fixed inset-x-0 bottom-0 z-10 flex justify-center p-3"
      role="status"
      aria-live="polite"
      data-testid="result-toast"
    >
      <div class="w-full max-w-[480px] rounded-xl bg-white p-4 shadow-lg ring-2 ring-amber-400">
        <div class="flex items-start gap-2">
          <div class="min-w-0 flex-1">
            <p class="text-lg font-bold" data-testid="result-title">
              {#if allAchieved && game.continued}
                全員が達成しました
              {:else if winnerNames.length > 1}
                {winnerNames.join(' と ')} の同着！
              {:else}
                {winnerNames[0]} の勝ち！
              {/if}
            </p>
            <p class="text-xs text-base-muted">{game.drawn.length}回目の抽選で決着</p>
          </div>
          <button
            type="button"
            class="shrink-0 rounded px-2 py-1 text-lg leading-none text-base-muted"
            onclick={() => (toastDismissed = true)}
            aria-label="結果を閉じる"
          >
            ×
          </button>
        </div>

        <div class="mt-3 flex flex-wrap gap-2">
          {#if !allAchieved}
            <button
              type="button"
              class="flex-1 rounded-lg bg-primary px-4 py-2 font-bold text-white"
              onclick={keepPlaying}
            >
              このまま続ける
            </button>
          {/if}
          <button
            type="button"
            class="flex-1 rounded-lg border-2 border-gray-200 px-4 py-2 font-bold"
            onclick={restart}
          >
            もう一度
          </button>
          <button
            type="button"
            class="flex-1 rounded-lg border-2 border-gray-200 px-4 py-2 font-bold"
            onclick={backToSetup}
          >
            設定を変える
          </button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .cell {
    background: #f3f4f6;
    color: #374151;
  }
  .cell.marked {
    background: var(--color-primary);
    color: white;
  }
  .cell.bingo {
    background: #f59e0b;
    color: white;
  }
  .cell.reach {
    outline: 2px solid #f59e0b;
    outline-offset: -2px;
  }
  .ball {
    box-shadow: inset 0 -4px 8px rgb(0 0 0 / 0.08);
    animation: ball-in 0.3s ease-out;
  }
  .number {
    background: #f3f4f6;
    color: #9ca3af;
  }
  .number.drawn {
    background: var(--color-primary);
    color: white;
  }
  .is-cpu .cell {
    font-size: 0.75rem;
  }
  .just-marked {
    animation: pop 0.3s ease-out;
  }

  @keyframes pop {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.25);
    }
    100% {
      transform: scale(1);
    }
  }

  @keyframes ball-in {
    0% {
      transform: rotateX(90deg);
      opacity: 0;
    }
    100% {
      transform: rotateX(0);
      opacity: 1;
    }
  }

  .toast {
    animation: toast-in 0.25s ease-out;
  }

  @keyframes toast-in {
    0% {
      transform: translateY(100%);
      opacity: 0;
    }
    100% {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ball,
    .just-marked,
    .toast {
      animation: none;
    }
  }
</style>
