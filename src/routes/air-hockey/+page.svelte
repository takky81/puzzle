<script lang="ts">
  import { resolve } from '$app/paths';
  import { browser } from '$app/environment';
  import {
    defaultConfig,
    DIFFICULTY_PRESETS,
    createInitialState,
    updateGame,
  } from '$lib/air-hockey/logic';
  import { computeAITarget } from '$lib/air-hockey/ai';
  import type {
    GameConfig,
    GameMode,
    AIDifficulty,
    GameState,
    PlayerInput,
  } from '$lib/air-hockey/types';

  type Screen = 'mode' | 'difficulty' | 'settings' | 'game';

  let screen = $state<Screen>('mode');
  let gameMode = $state<GameMode>('vs-ai');
  let config = $state<GameConfig>(defaultConfig());

  // ゲーム状態
  let gameState = $state<GameState | null>(null);
  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let rafId = $state(0);

  // AI反応遅延用
  let aiTimeSinceUpdate = 0;
  let aiCurrentTarget = { x: 200, y: 150 };

  // プレイヤー入力（マウス/タッチ追跡）
  let p1Target = { x: 200, y: 450 };
  let p1Grabbing = false;

  function startGame() {
    gameState = createInitialState(gameMode, config);
    screen = 'game';
    aiTimeSinceUpdate = 0;
    if (browser) scheduleFrame();
  }

  function stopGame() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    gameState = null;
  }

  let lastTime = 0;

  function scheduleFrame() {
    rafId = requestAnimationFrame(tick);
  }

  function tick(now: number) {
    if (!gameState) return;
    const dt = lastTime === 0 ? 0.016 : Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    // AI入力の計算（vs-aiモードのみ）
    let p2Input: PlayerInput = { paddleTarget: aiCurrentTarget, grabbing: false };
    if (gameMode === 'vs-ai') {
      aiTimeSinceUpdate += dt * 1000;
      if (aiTimeSinceUpdate >= config.ai.reactionDelayMs || config.ai.reactionDelayMs === 0) {
        aiCurrentTarget = computeAITarget(gameState);
        aiTimeSinceUpdate = 0;
      }
      p2Input = { paddleTarget: aiCurrentTarget, grabbing: false };
    }

    const p1Input: PlayerInput = { paddleTarget: p1Target, grabbing: p1Grabbing };
    gameState = updateGame(gameState, dt, { p1: p1Input, p2: p2Input });

    if (canvasEl) drawFrame(canvasEl, gameState);

    if (gameState.phase !== 'finished') {
      scheduleFrame();
    }
  }

  // Canvas描画
  function drawFrame(canvas: HTMLCanvasElement, state: GameState) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const scaleX = W / 400;
    const scaleY = H / 600;

    // 背景
    ctx.fillStyle = '#0a1628';
    ctx.fillRect(0, 0, W, H);

    // センターライン（破線）
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    ctx.lineTo(W, H / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // ゴールエリア
    const goalW = state.config.goalWidthRatio * 400 * scaleX;
    const goalD = 30 * scaleY;
    const goalLeft = (W - goalW) / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(goalLeft, 0, goalW, goalD);
    ctx.fillRect(goalLeft, H - goalD, goalW, goalD);

    // パドル Player 1（赤）
    ctx.beginPath();
    ctx.arc(
      state.player1.pos.x * scaleX,
      state.player1.pos.y * scaleY,
      state.player1.radius * scaleX,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = '#e53e3e';
    ctx.fill();
    ctx.strokeStyle = '#fc8181';
    ctx.lineWidth = 2;
    ctx.stroke();

    // パドル Player 2 / AI（青）
    ctx.beginPath();
    ctx.arc(
      state.player2.pos.x * scaleX,
      state.player2.pos.y * scaleY,
      state.player2.radius * scaleX,
      0,
      Math.PI * 2,
    );
    ctx.fillStyle = '#3182ce';
    ctx.fill();
    ctx.strokeStyle = '#63b3ed';
    ctx.lineWidth = 2;
    ctx.stroke();

    // パック（白）、grabフェーズ中は半透明
    const puckAlpha = state.phase === 'grabbed' ? 0.4 : 1.0;
    ctx.globalAlpha = puckAlpha;
    if (state.phase !== 'goal') {
      ctx.beginPath();
      ctx.arc(
        state.puck.pos.x * scaleX,
        state.puck.pos.y * scaleY,
        state.puck.radius * scaleX,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // カウントダウン表示
    if (state.phase === 'countdown' && state.countdownValue > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${80 * scaleX}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(state.countdownValue), W / 2, H / 2);
    }

    // ゴール演出
    if (state.phase === 'goal') {
      ctx.fillStyle = 'rgba(255,255,100,0.2)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffff00';
      ctx.font = `bold ${40 * scaleX}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GOAL!', W / 2, H / 2);
    }

    // ポーズ表示
    if (state.phase === 'paused') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${36 * scaleX}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PAUSED', W / 2, H / 2);
    }
  }

  // キャンバスサイズ計算
  function canvasSize() {
    if (!browser) return { w: 300, h: 450 };
    const maxH = window.innerHeight - 120;
    const maxW = Math.min(window.innerWidth - 32, 400);
    const h = Math.min(maxH, (maxW * 3) / 2);
    const w = (h * 2) / 3;
    return { w: Math.floor(w), h: Math.floor(h) };
  }

  let cvSize = $state(canvasSize());

  // ポインター入力処理
  function getCanvasPos(e: PointerEvent) {
    if (!canvasEl) return { x: 200, y: 450 };
    const rect = canvasEl.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 400,
      y: ((e.clientY - rect.top) / rect.height) * 600,
    };
  }

  function onPointerMove(e: PointerEvent) {
    const pos = getCanvasPos(e);
    p1Target = pos;
  }

  function onPointerDown(e: PointerEvent) {
    e.preventDefault();
    const pos = getCanvasPos(e);
    p1Target = pos;
    if (gameState?.phase === 'playing') {
      const dx = pos.x - gameState.puck.pos.x;
      const dy = pos.y - gameState.puck.pos.y;
      if (Math.hypot(dx, dy) < gameState.puck.radius + 10) {
        p1Grabbing = true;
      }
    }
  }

  function onPointerUp() {
    p1Grabbing = false;
  }

  function togglePause() {
    if (!gameState) return;
    if (gameState.phase === 'playing' || gameState.phase === 'grabbed') {
      gameState = { ...gameState, phase: 'paused' };
    } else if (gameState.phase === 'paused') {
      gameState = { ...gameState, phase: 'countdown', countdownValue: 3, countdownTimer: 3 };
      if (!rafId) scheduleFrame();
    }
  }

  function goToMenu() {
    if (!gameState || gameState.phase === 'finished') {
      stopGame();
      screen = 'mode';
      return;
    }
    if (confirm('ゲームを終了しますか？')) {
      stopGame();
      screen = 'mode';
    }
  }

  $effect(() => {
    if (screen !== 'game') {
      stopGame();
      lastTime = 0;
    }
  });
</script>

<svelte:head>
  <title>エアホッケー</title>
</svelte:head>

<svelte:window
  onresize={() => {
    cvSize = canvasSize();
  }}
/>

<div class="flex min-h-screen flex-col items-center bg-gray-900 text-white">
  <div class="w-full max-w-sm px-4 py-6">
    <!-- ヘッダー -->
    <div class="mb-6 flex items-center gap-3">
      <a href={resolve('/', {})} class="text-gray-400 hover:text-white">← 戻る</a>
      <h1 class="text-xl font-bold">エアホッケー</h1>
    </div>

    {#if screen === 'mode'}
      <!-- モード選択画面 -->
      <div class="flex flex-col gap-4">
        <h2 class="text-center text-lg font-semibold">モードを選択</h2>
        <button
          class="rounded-xl bg-blue-600 px-6 py-4 text-lg font-bold hover:bg-blue-500"
          onclick={() => {
            gameMode = 'vs-ai';
            screen = 'difficulty';
          }}
        >
          vs AI
        </button>
        <button
          class="rounded-xl bg-green-600 px-6 py-4 text-lg font-bold hover:bg-green-500"
          onclick={() => {
            gameMode = '2p';
            config = defaultConfig();
            screen = 'settings';
          }}
        >
          2人対戦
        </button>
      </div>
    {:else if screen === 'difficulty'}
      <!-- 難易度選択画面 -->
      <div class="flex flex-col gap-4">
        <h2 class="text-center text-lg font-semibold">難易度を選択</h2>
        {#each ['easy', 'normal', 'hard'] as AIDifficulty[] as diff (diff)}
          <button
            class="rounded-xl bg-blue-600 px-6 py-4 text-lg font-bold hover:bg-blue-500"
            onclick={() => {
              config = {
                ...defaultConfig(),
                ai: DIFFICULTY_PRESETS[diff as Exclude<AIDifficulty, 'custom'>],
              };
              startGame();
            }}
          >
            {diff === 'easy' ? 'イージー' : diff === 'normal' ? 'ノーマル' : 'ハード'}
          </button>
        {/each}
        <button
          class="rounded-xl bg-purple-600 px-6 py-4 text-lg font-bold hover:bg-purple-500"
          onclick={() => {
            screen = 'settings';
          }}
        >
          カスタム
        </button>
        <button class="text-gray-400 hover:text-white" onclick={() => (screen = 'mode')}>
          ← 戻る
        </button>
      </div>
    {:else if screen === 'settings'}
      <!-- 設定画面 -->
      <div class="flex flex-col gap-5">
        <h2 class="text-center text-lg font-semibold">設定</h2>

        <!-- 物理パラメータ -->
        <section class="flex flex-col gap-3">
          <h3 class="text-sm font-semibold uppercase text-gray-400">物理</h3>
          <label class="flex flex-col gap-1">
            <span class="text-sm">反発係数: {config.restitution.toFixed(2)}</span>
            <input
              type="range"
              min="0.5"
              max="1.0"
              step="0.01"
              value={config.restitution}
              oninput={(e) => {
                config = { ...config, restitution: Number((e.target as HTMLInputElement).value) };
              }}
              class="w-full accent-blue-400"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-sm">摩擦: {config.friction.toFixed(4)}</span>
            <input
              type="range"
              min="0.990"
              max="1.000"
              step="0.001"
              value={config.friction}
              oninput={(e) => {
                config = { ...config, friction: Number((e.target as HTMLInputElement).value) };
              }}
              class="w-full accent-blue-400"
            />
          </label>
        </section>

        <!-- ルールパラメータ -->
        <section class="flex flex-col gap-3">
          <h3 class="text-sm font-semibold uppercase text-gray-400">ルール</h3>
          <label class="flex flex-col gap-1">
            <span class="text-sm">勝利点数: {config.winScore}</span>
            <input
              type="range"
              min="1"
              max="15"
              step="1"
              value={config.winScore}
              oninput={(e) => {
                config = { ...config, winScore: Number((e.target as HTMLInputElement).value) };
              }}
              class="w-full accent-blue-400"
            />
          </label>
        </section>

        <!-- AIパラメータ（vs AI モードのみ） -->
        {#if gameMode === 'vs-ai'}
          <section class="flex flex-col gap-3">
            <h3 class="text-sm font-semibold uppercase text-gray-400">AI</h3>
            <label class="flex flex-col gap-1">
              <span class="text-sm">AI速度: {config.ai.speed} px/s</span>
              <input
                type="range"
                min="100"
                max="600"
                step="10"
                value={config.ai.speed}
                oninput={(e) => {
                  config = {
                    ...config,
                    ai: { ...config.ai, speed: Number((e.target as HTMLInputElement).value) },
                  };
                }}
                class="w-full accent-blue-400"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm">反射予測: {config.ai.predictionBounces}回</span>
              <input
                type="range"
                min="0"
                max="3"
                step="1"
                value={config.ai.predictionBounces}
                oninput={(e) => {
                  config = {
                    ...config,
                    ai: {
                      ...config.ai,
                      predictionBounces: Number((e.target as HTMLInputElement).value),
                    },
                  };
                }}
                class="w-full accent-blue-400"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm">反応遅延: {config.ai.reactionDelayMs}ms</span>
              <input
                type="range"
                min="0"
                max="500"
                step="10"
                value={config.ai.reactionDelayMs}
                oninput={(e) => {
                  config = {
                    ...config,
                    ai: {
                      ...config.ai,
                      reactionDelayMs: Number((e.target as HTMLInputElement).value),
                    },
                  };
                }}
                class="w-full accent-blue-400"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-sm">狙いのばらつき: {config.ai.targetNoiseRadius}px</span>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={config.ai.targetNoiseRadius}
                oninput={(e) => {
                  config = {
                    ...config,
                    ai: {
                      ...config.ai,
                      targetNoiseRadius: Number((e.target as HTMLInputElement).value),
                    },
                  };
                }}
                class="w-full accent-blue-400"
              />
            </label>
          </section>
        {/if}

        <button
          class="mt-2 rounded-xl bg-gray-700 px-4 py-2 text-sm hover:bg-gray-600"
          onclick={() => {
            config = defaultConfig();
          }}
        >
          デフォルトに戻す
        </button>

        <button
          class="rounded-xl bg-blue-600 px-6 py-4 text-lg font-bold hover:bg-blue-500"
          onclick={startGame}
        >
          ゲーム開始
        </button>
        <button
          class="text-gray-400 hover:text-white"
          onclick={() => (screen = gameMode === 'vs-ai' ? 'difficulty' : 'mode')}
        >
          ← 戻る
        </button>
      </div>
    {:else if screen === 'game' && gameState}
      <!-- ゲーム画面 -->
      <div class="flex flex-col items-center gap-2">
        <!-- スコア上 (Player 2 / AI) -->
        <div class="flex w-full max-w-xs items-center justify-between px-2">
          <span class="text-sm text-blue-300">{gameMode === 'vs-ai' ? 'AI' : 'Player 2'}</span>
          <span class="text-2xl font-bold text-blue-300">{gameState.score.p2}</span>
        </div>

        <!-- Canvas -->
        <canvas
          bind:this={canvasEl}
          width={cvSize.w}
          height={cvSize.h}
          style="touch-action: none; cursor: crosshair; border-radius: 8px;"
          onpointermove={onPointerMove}
          onpointerdown={onPointerDown}
          onpointerup={onPointerUp}
          onpointerleave={onPointerUp}
        ></canvas>

        <!-- スコア下 (Player 1) -->
        <div class="flex w-full max-w-xs items-center justify-between px-2">
          <span class="text-sm text-red-300">Player 1</span>
          <span class="text-2xl font-bold text-red-300">{gameState.score.p1}</span>
        </div>

        <!-- コントロール -->
        <div class="flex gap-3">
          <button
            class="rounded-lg bg-gray-700 px-4 py-2 text-sm hover:bg-gray-600"
            onclick={togglePause}
          >
            {gameState.phase === 'paused' ? '再開' : '一時停止'}
          </button>
          <button
            class="rounded-lg bg-gray-700 px-4 py-2 text-sm hover:bg-gray-600"
            onclick={goToMenu}
          >
            もどる
          </button>
        </div>

        <!-- 結果オーバーレイ -->
        {#if gameState.phase === 'finished'}
          <div class="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
            <div class="rounded-2xl bg-gray-800 p-8 text-center">
              <p class="mb-2 text-2xl font-bold">
                {#if gameState.winner === 1}
                  {gameMode === 'vs-ai' ? 'あなたの勝ち！' : 'Player 1 の勝ち！'}
                {:else}
                  {gameMode === 'vs-ai' ? 'AI の勝ち！' : 'Player 2 の勝ち！'}
                {/if}
              </p>
              <p class="mb-6 text-lg text-gray-300">
                {gameState.score.p1} - {gameState.score.p2}
              </p>
              <button
                class="rounded-xl bg-blue-600 px-6 py-3 font-bold hover:bg-blue-500"
                onclick={() => {
                  stopGame();
                  screen = 'mode';
                }}
              >
                もう一度
              </button>
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
