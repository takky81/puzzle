<script lang="ts">
  import { browser } from '$app/environment';
  import { decideAction, decideDiscards } from '$lib/poker/ai';
  import { describeHand, evaluateHand, rankLabel } from '$lib/poker/hand';
  import {
    AI_LEVELS,
    anteOptions,
    applyAction,
    BET_STRUCTURES,
    CHIP_OPTIONS,
    createInitialState,
    defaultConfig,
    exchangeCards,
    getLegalActions,
    nextDrawer,
    nextHand,
    resolveShowdown,
    startHand,
  } from '$lib/poker/logic';
  import { loadLastConfig, saveLastConfig } from '$lib/poker/storage';
  import type {
    Action,
    AiLevel,
    BetStructure,
    Card,
    GameConfig,
    LegalActions,
    Phase,
    Suit,
  } from '$lib/poker/types';

  type Screen = 'setup' | 'playing';

  const betStructureLabels: Record<BetStructure, string> = {
    fixedLimit: 'フィックスドリミット',
    noLimit: 'ノーリミット',
  };

  const betStructureDescriptions: Record<BetStructure, string> = {
    fixedLimit: 'ベット額は固定。1ラウンド4ベットまで',
    noLimit: '好きな額をベットできる。オールインもあり',
  };

  const aiLevelLabels: Record<AiLevel, string> = {
    weak: '弱い',
    normal: '通常',
    strong: '強い',
    cheat: '最強',
  };

  const aiLevelDescriptions: Record<AiLevel, string> = {
    weak: '大まかにしか判断しない。気まぐれに降りたり攻めたりする',
    normal: '役の強さで判断し、定石どおりに交換する',
    strong: '勝率とポットオッズを計算し、たまにブラフもする',
    cheat: '相手の手札と山札が見えるチートAI。負ける手なら即降りる',
  };

  const phaseLabels: Record<Phase, string> = {
    bet1: '第1ベッティング',
    draw: 'カード交換',
    bet2: '第2ベッティング',
    showdown: 'ショーダウン',
    handEnd: 'ハンド終了',
    gameEnd: 'ゲーム終了',
  };

  const suitSymbols: Record<Suit, string> = {
    spade: '♠',
    heart: '♥',
    diamond: '♦',
    club: '♣',
  };

  const noLegalActions: LegalActions = {
    canCheck: false,
    canCall: false,
    callAmount: 0,
    canFold: false,
    canBet: false,
    canRaise: false,
    minRaiseTo: 0,
    maxRaiseTo: 0,
  };

  /** AIの思考中に見せる待ち時間（ミリ秒） */
  const AI_THINK_MS = 700;

  const rng = () => Math.random();

  let screen: Screen = $state('setup');
  let config: GameConfig = $state(browser ? loadLastConfig() : defaultConfig());
  let game = $state(createInitialState(browser ? loadLastConfig() : defaultConfig()));
  let selected: number[] = $state([]);
  let aiMessage = $state('');
  /** ノーリミットのベット額（合法な範囲に丸めて使う） */
  let betTo = $state(0);

  let anteChoices = $derived(anteOptions(config.initialChips));
  let legal = $derived(game.turn === 'human' ? getLegalActions(game) : noLegalActions);
  let isHumanTurn = $derived(game.turn === 'human');
  let canExchange = $derived(nextDrawer(game) === 'human');
  let potTotal = $derived(game.pot + game.players.human.bet + game.players.ai.bet);
  let betAmount = $derived(Math.min(Math.max(betTo, legal.minRaiseTo), legal.maxRaiseTo));
  let phaseLabel = $derived(phaseLabels[game.phase]);
  let revealAi = $derived(
    game.phase === 'showdown' || (game.lastResult !== null && !game.lastResult.byFold),
  );
  let humanRankText = $derived(
    game.players.human.hand.length === 0
      ? ''
      : describeHand(evaluateHand([...game.players.human.hand])),
  );
  let resultText = $derived.by(() => {
    const result = game.lastResult;
    if (result === null) return '';
    const delta = result.delta.human;
    const sign = delta > 0 ? `+${delta}` : `${delta}`;
    if (result.byFold) {
      return result.winner === 'human'
        ? `AIがフォールド。あなたの勝ち（${sign}）`
        : `あなたがフォールド（${sign}）`;
    }
    if (result.winner === null) return `引き分け（${sign}）`;
    const hands = `あなた: ${describeHand(result.humanRank!)} / AI: ${describeHand(result.aiRank!)}`;
    return result.winner === 'human'
      ? `あなたの勝ち！ ${hands}（${sign}）`
      : `AIの勝ち… ${hands}（${sign}）`;
  });

  function isRed(card: Card): boolean {
    return card.suit === 'heart' || card.suit === 'diamond';
  }

  function cardLabel(card: Card): string {
    return `${rankLabel(card.rank)}${suitSymbols[card.suit]}`;
  }

  function actionMessage(action: Action): string {
    switch (action.type) {
      case 'check':
        return 'AIはチェック';
      case 'call':
        return 'AIはコール';
      case 'fold':
        return 'AIはフォールド';
      case 'bet':
        return `AIはベット ${action.amount}`;
      case 'raise':
        return `AIはレイズ ${action.amount}`;
    }
  }

  function setInitialChips(chips: number) {
    config.initialChips = chips;
    const choices = anteOptions(chips);
    if (!choices.includes(config.ante)) {
      config.ante = choices[Math.min(1, choices.length - 1)];
    }
  }

  function startGame() {
    saveLastConfig($state.snapshot(config));
    restart();
    screen = 'playing';
  }

  function restart() {
    game = startHand(createInitialState($state.snapshot(config)), rng);
    selected = [];
    aiMessage = '';
    betTo = 0;
  }

  function backToSetup() {
    screen = 'setup';
  }

  function act(action: Action) {
    aiMessage = '';
    betTo = 0;
    game = applyAction($state.snapshot(game), action);
  }

  function toggleCard(index: number) {
    selected = selected.includes(index)
      ? selected.filter((i) => i !== index)
      : [...selected, index];
  }

  function exchange() {
    game = exchangeCards($state.snapshot(game), 'human', $state.snapshot(selected));
    selected = [];
  }

  function goNextHand() {
    aiMessage = '';
    betTo = 0;
    game = nextHand($state.snapshot(game), rng);
  }

  // AIの手番・交換・ショーダウンを一定間隔で自動的に進める
  $effect(() => {
    const current = $state.snapshot(game);
    let run: (() => void) | null = null;

    if (current.turn === 'ai') {
      run = () => {
        const action = decideAction(current, rng);
        aiMessage = actionMessage(action);
        game = applyAction(current, action);
      };
    } else if (nextDrawer(current) === 'ai') {
      run = () => {
        const discards = decideDiscards(current, rng);
        aiMessage = discards.length === 0 ? 'AIは交換しなかった' : `AIは${discards.length}枚交換`;
        game = exchangeCards(current, 'ai', discards);
      };
    } else if (current.phase === 'showdown') {
      run = () => {
        game = resolveShowdown(current);
      };
    }

    if (run === null) return;
    const timer = setTimeout(run, AI_THINK_MS);
    return () => clearTimeout(timer);
  });
</script>

<svelte:head>
  <title>ポーカー - Puzzle & Games</title>
</svelte:head>

{#snippet cardView(
  card: Card,
  faceUp: boolean,
  selectable: boolean,
  isSelected: boolean,
  onSelect: () => void,
)}
  <button
    type="button"
    class="flex h-16 w-11 flex-col items-center justify-center rounded-md border-2 text-lg font-bold transition-transform sm:h-20 sm:w-14"
    class:bg-white={faceUp}
    class:bg-primary={!faceUp}
    class:border-gray-300={!isSelected}
    class:border-red-500={isSelected}
    class:-translate-y-2={isSelected}
    class:text-red-600={faceUp && isRed(card)}
    disabled={!selectable}
    onclick={onSelect}
    aria-label={faceUp ? cardLabel(card) : '裏向きのカード'}
    aria-pressed={isSelected}
  >
    {#if faceUp}
      <span>{rankLabel(card.rank)}</span>
      <span>{suitSymbols[card.suit]}</span>
    {:else}
      <span class="text-2xl text-white">◆</span>
    {/if}
  </button>
{/snippet}

<h1 class="mb-4 text-2xl font-bold">ポーカー</h1>

{#if screen === 'setup'}
  <section class="mx-auto max-w-[520px] rounded-xl bg-white p-5 shadow-md">
    <h2 class="mb-4 text-lg font-bold">ゲーム設定</h2>

    <div class="mb-5">
      <span class="mb-2 block text-sm font-bold">初期チップ</span>
      <div class="flex gap-2">
        {#each CHIP_OPTIONS as chips (chips)}
          <button
            type="button"
            class="flex-1 rounded-lg border-2 px-2 py-2 font-bold transition-colors"
            class:border-primary={config.initialChips === chips}
            class:bg-primary={config.initialChips === chips}
            class:text-white={config.initialChips === chips}
            class:border-gray-200={config.initialChips !== chips}
            onclick={() => setInitialChips(chips)}
            aria-pressed={config.initialChips === chips}
          >
            {chips}
          </button>
        {/each}
      </div>
    </div>

    <div class="mb-5">
      <span class="mb-2 block text-sm font-bold">アンティ（毎ハンドの参加費）</span>
      <div class="flex gap-2">
        {#each anteChoices as ante (ante)}
          <button
            type="button"
            class="flex-1 rounded-lg border-2 px-2 py-2 font-bold transition-colors"
            class:border-primary={config.ante === ante}
            class:bg-primary={config.ante === ante}
            class:text-white={config.ante === ante}
            class:border-gray-200={config.ante !== ante}
            onclick={() => (config.ante = ante)}
            aria-pressed={config.ante === ante}
          >
            {ante}
          </button>
        {/each}
      </div>
    </div>

    <div class="mb-5">
      <span class="mb-2 block text-sm font-bold">ベット構造</span>
      <div class="flex flex-col gap-2">
        {#each BET_STRUCTURES as structure (structure)}
          <button
            type="button"
            class="rounded-lg border-2 px-3 py-2 text-left transition-colors"
            class:border-primary={config.betStructure === structure}
            class:border-gray-200={config.betStructure !== structure}
            onclick={() => (config.betStructure = structure)}
            aria-pressed={config.betStructure === structure}
          >
            <span class="block font-bold">{betStructureLabels[structure]}</span>
            <span class="block text-xs text-base-muted">
              {betStructureDescriptions[structure]}
            </span>
          </button>
        {/each}
      </div>
    </div>

    <div class="mb-6">
      <span class="mb-2 block text-sm font-bold">AIの強さ</span>
      <div class="flex flex-col gap-2">
        {#each AI_LEVELS as level (level)}
          <button
            type="button"
            class="rounded-lg border-2 px-3 py-2 text-left transition-colors"
            class:border-primary={config.aiLevel === level}
            class:border-gray-200={config.aiLevel !== level}
            onclick={() => (config.aiLevel = level)}
            aria-pressed={config.aiLevel === level}
          >
            <span class="block font-bold">{aiLevelLabels[level]}</span>
            <span class="block text-xs text-base-muted">{aiLevelDescriptions[level]}</span>
          </button>
        {/each}
      </div>
    </div>

    <button
      type="button"
      class="w-full rounded-lg bg-primary px-4 py-3 text-lg font-bold text-white"
      onclick={startGame}
    >
      ゲーム開始
    </button>
  </section>
{:else}
  <section class="mx-auto flex max-w-[520px] flex-col gap-3">
    <!-- AIエリア -->
    <div class="rounded-xl bg-white p-3 shadow-md">
      <div class="mb-2 flex items-center justify-between">
        <span class="font-bold">
          🤖 AI（{aiLevelLabels[game.config.aiLevel]}）
          {#if game.dealer === 'ai'}
            <span class="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-white">D</span>
          {/if}
        </span>
        <span class="text-sm font-bold" data-testid="ai-chips">
          {game.players.ai.chips} チップ
        </span>
      </div>
      <div class="flex justify-center gap-1" data-testid="ai-hand">
        {#each game.players.ai.hand as card, i (i)}
          {@render cardView(card, revealAi, false, false, () => {})}
        {/each}
      </div>
      {#if game.players.ai.bet > 0}
        <p class="mt-2 text-center text-sm">ベット {game.players.ai.bet}</p>
      {/if}
      {#if aiMessage !== ''}
        <p class="mt-2 text-center text-sm font-bold text-primary" data-testid="ai-message">
          {aiMessage}
        </p>
      {/if}
    </div>

    <!-- ポットエリア -->
    <div class="rounded-xl bg-green-800 p-3 text-center text-white shadow-md">
      <p class="text-xs opacity-80">{phaseLabel}</p>
      <p class="text-2xl font-bold" data-testid="pot">ポット {game.pot}</p>
      {#if game.lastResult !== null}
        <p class="mt-1 text-sm" data-testid="result-text">{resultText}</p>
      {/if}
    </div>

    <!-- プレイヤーエリア -->
    <div class="rounded-xl bg-white p-3 shadow-md">
      <div class="mb-2 flex items-center justify-between">
        <span class="font-bold">
          🙂 あなた
          {#if game.dealer === 'human'}
            <span class="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-white">D</span>
          {/if}
        </span>
        <span class="text-sm font-bold" data-testid="human-chips">
          {game.players.human.chips} チップ
        </span>
      </div>
      <div class="flex justify-center gap-1" data-testid="human-hand">
        {#each game.players.human.hand as card, i (i)}
          {@render cardView(card, true, canExchange, selected.includes(i), () => toggleCard(i))}
        {/each}
      </div>
      <p class="mt-2 text-center text-sm font-bold" data-testid="human-rank">{humanRankText}</p>
      {#if game.players.human.bet > 0}
        <p class="text-center text-sm">ベット {game.players.human.bet}</p>
      {/if}
    </div>

    <!-- 操作エリア -->
    <div class="flex flex-col gap-2">
      {#if canExchange}
        <button
          type="button"
          class="w-full rounded-lg bg-primary px-4 py-3 font-bold text-white"
          onclick={exchange}
        >
          {selected.length === 0 ? '交換しない' : `${selected.length}枚を交換する`}
        </button>
        <p class="text-center text-xs text-base-muted">交換したいカードをタップして選ぶ</p>
      {:else if isHumanTurn}
        {#if game.config.betStructure === 'noLimit' && (legal.canBet || legal.canRaise)}
          <div class="rounded-lg bg-white p-3 shadow-md">
            <label class="mb-1 block text-sm font-bold" for="bet-amount">
              ベット額: {betAmount}
            </label>
            <input
              id="bet-amount"
              type="range"
              class="w-full"
              min={legal.minRaiseTo}
              max={legal.maxRaiseTo}
              bind:value={betTo}
            />
            <div class="mt-2 flex gap-2">
              <button
                type="button"
                class="flex-1 rounded-lg border-2 border-gray-200 px-2 py-1 text-sm font-bold"
                onclick={() => (betTo = Math.floor(potTotal / 2))}
              >
                1/2ポット
              </button>
              <button
                type="button"
                class="flex-1 rounded-lg border-2 border-gray-200 px-2 py-1 text-sm font-bold"
                onclick={() => (betTo = potTotal)}
              >
                ポット
              </button>
              <button
                type="button"
                class="flex-1 rounded-lg border-2 border-gray-200 px-2 py-1 text-sm font-bold"
                onclick={() => (betTo = legal.maxRaiseTo)}
              >
                オールイン
              </button>
            </div>
          </div>
        {/if}
        <div class="flex gap-2">
          {#if legal.canFold}
            <button
              type="button"
              class="flex-1 rounded-lg bg-gray-500 px-3 py-3 font-bold text-white"
              onclick={() => act({ type: 'fold' })}
            >
              フォールド
            </button>
          {/if}
          {#if legal.canCheck}
            <button
              type="button"
              class="flex-1 rounded-lg bg-primary px-3 py-3 font-bold text-white"
              onclick={() => act({ type: 'check' })}
            >
              チェック
            </button>
          {/if}
          {#if legal.canCall}
            <button
              type="button"
              class="flex-1 rounded-lg bg-primary px-3 py-3 font-bold text-white"
              onclick={() => act({ type: 'call' })}
            >
              コール {legal.callAmount}
            </button>
          {/if}
          {#if legal.canBet}
            <button
              type="button"
              class="flex-1 rounded-lg bg-red-600 px-3 py-3 font-bold text-white"
              onclick={() => act({ type: 'bet', amount: betAmount })}
            >
              ベット {betAmount}
            </button>
          {/if}
          {#if legal.canRaise}
            <button
              type="button"
              class="flex-1 rounded-lg bg-red-600 px-3 py-3 font-bold text-white"
              onclick={() => act({ type: 'raise', amount: betAmount })}
            >
              レイズ {betAmount}
            </button>
          {/if}
        </div>
      {:else if game.phase === 'handEnd'}
        <button
          type="button"
          class="w-full rounded-lg bg-primary px-4 py-3 font-bold text-white"
          onclick={goNextHand}
        >
          次のハンドへ
        </button>
      {:else if game.phase !== 'gameEnd'}
        <p class="py-3 text-center text-sm text-base-muted">AIが考えています…</p>
      {/if}
    </div>

    <p class="text-center text-xs text-base-muted">
      ハンド {game.handNumber} / アンティ {game.config.ante} /
      {betStructureLabels[game.config.betStructure]}
    </p>
  </section>

  {#if game.phase === 'gameEnd'}
    <div
      class="fixed inset-0 z-10 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="ゲーム終了"
    >
      <div class="w-full max-w-[360px] rounded-xl bg-white p-5 text-center shadow-lg">
        <h2 class="mb-2 text-xl font-bold" data-testid="game-result">
          {game.players.human.chips > 0 ? 'あなたの勝ち！' : 'あなたの負け…'}
        </h2>
        <p class="mb-4 text-sm text-base-muted">
          {game.handNumber} ハンドで決着 / 残りチップ {game.players.human.chips}
        </p>
        <div class="flex flex-col gap-2">
          <button
            type="button"
            class="w-full rounded-lg bg-primary px-4 py-3 font-bold text-white"
            onclick={restart}
          >
            もう一度
          </button>
          <button
            type="button"
            class="w-full rounded-lg border-2 border-gray-200 px-4 py-3 font-bold"
            onclick={backToSetup}
          >
            設定を変える
          </button>
        </div>
      </div>
    </div>
  {/if}
{/if}
