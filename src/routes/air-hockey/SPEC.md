# エアホッケー 仕様書

## 概要

長方形のフィールドでパックを弾き合い、相手ゴールにパックを入れるリアルタイムアクションゲーム。
Canvas で描画し、物理演算（跳ね返り・衝突）を JavaScript のゲームループで処理する。

## ゲームモード

- **vs AI**: プレイヤー1人対AI。ゲーム開始前に難易度（プリセット or カスタム）を選択
- **2人対戦**: 同一デバイスで2人がプレイ

## 勝利条件

- 先に **勝利点数** に達したプレイヤーの勝ち（デフォルト: 7点、カスタム設定で変更可能）

## 設定システム

### 設定方針

全パラメータは**カスタム設定**で自由に変更できる。
vs AI モードでは、難易度プリセット（イージー/ノーマル/ハード）をテンプレートとして選択し、
そのまま開始するか、値を調整してカスタムとして使うことができる。

任意の設定に名前を付けて**ユーザーテンプレート**として保存・呼び出しが可能。
起動時のデフォルトは前回使用した設定。

### 設定パラメータ一覧

#### 物理パラメータ

| 設定項目               | デフォルト値       | 設定範囲                                |
| ---------------------- | ------------------ | --------------------------------------- |
| パックサイズ（半径）   | 18 px              | フィールド幅の 2% 〜 ゴール幅の 40% ※1  |
| パドルサイズ（半径）   | 35 px              | フィールド幅の 5% 〜 フィールド幅の 20% |
| ゴール幅               | フィールド幅の 1/3 | フィールド幅の 1/4 〜 1/1（全幅）       |
| 反発係数               | 1.0                | 0.5 〜 1.2                              |
| 摩擦係数（減衰/frame） | 0.998              | 0.990 〜 1.000                          |
| パックの初速           | 250 px/s           | 100 〜 500 px/s                         |

※1 ゴール幅の設定に連動して上限が変わる

#### ルールパラメータ

| 設定項目                  | デフォルト値 | 設定範囲                 |
| ------------------------- | ------------ | ------------------------ |
| 勝利点数                  | 7 点         | 3 〜 100 点              |
| パックリセット最大角度 ※2 | 10°          | 0°（垂直）〜 90°（水平） |

※2 ゴール後のリセット時、パックを「得点された側へ向かう垂直方向」から最大この角度だけ左右にランダムにずらして発射する。デフォルトの 10° はほぼ垂直にやや点とられた側へ向かう軌道になる

#### AI パラメータ（vs AI モードのみ）

| 設定項目          | デフォルト値 | 設定範囲      |
| ----------------- | ------------ | ------------- |
| AI 移動速度       | 350 px/s     | 100〜600 px/s |
| AI 反射予測回数   | 1 回         | 0〜3 回       |
| AI 反応遅延       | 100 ms       | 0〜500 ms     |
| AI 狙いのばらつき | 30 px        | 0〜100 px     |

### 難易度プリセット（AI パラメータのテンプレート）

| 項目              | イージー | ノーマル |   ハード |
| ----------------- | -------: | -------: | -------: |
| AI 移動速度       | 200 px/s | 350 px/s | 500 px/s |
| AI 反射予測回数   |     0 回 |     1 回 |     2 回 |
| AI 反応遅延       |   300 ms |   100 ms |     0 ms |
| AI 狙いのばらつき |    60 px |    30 px |     0 px |

物理パラメータ・ルールパラメータはプリセットによらず共通のデフォルト値を使用する。

## フィールド設計

```text
┌────────────────────┐
│      [ゴール]      │  ← Player 2（上側）のゴール
│                    │
│-- センターライン --│
│                    │
│      [ゴール]      │  ← Player 1（下側）のゴール
└────────────────────┘
```

- フィールドサイズ（論理座標）: 400 × 600
- ゴール幅: `goalWidthRatio × 400`（デフォルト約 133 px）、中央配置
- ゴール奥行き: 30 px（壁の外側まで）
- センターライン: 視覚的なガイドのみ（物理的な壁なし）

## ゲームオブジェクト

### パック

- 形状: 円
- 半径: `puckRadius`（デフォルト 18 px）
- 初期位置: フィールド中央
- 初期速度: `puckInitialSpeed`（デフォルト 250 px/s）
- **ファーストサービス（ゲーム開始時）**: ランダムに選ばれたプレイヤーのコート中央から、`puckResetAngleMax` と同じ角度範囲でランダム方向に発射
- **ゴール後のリセット**: 得点された側のコート中央に配置、0.5 秒待機後に再スタート
  - 発射方向: 得点された側へ向かう垂直方向から、`puckResetAngleMax` の範囲内でランダムにずらす
- **停止判定**: 速度が 20 px/s 以下になったとき「停止状態」とみなす（AI のつかみ動作のトリガーに使用）
- プレイヤーはパックの速度によらず常につかみ操作が可能（→ 操作方法を参照）

### パドル（マレット）

- 形状: 円
- 半径: `paddleRadius`（デフォルト 35 px）
- Player 1（下側）: フィールド下半分のみ移動可能
- Player 2 / AI（上側）: フィールド上半分のみ移動可能
- 各パドルは自コートの半分にのみ移動できるため、パドル同士が衝突することはない
- ゴールエリア（フィールド上下端の外側 30 px）にはパドルは侵入できない

## 物理演算

### パックの移動

- 毎フレーム `position += velocity × dt`
- `dt` の上限: 50 ms（タブ切り替え後などの大きな `dt` によるトンネリングを防止）
- 最大速度上限: 800 px/s（加速の暴走防止）
- 毎フレーム速度に `friction`（デフォルト 0.998）を乗算

### 壁との反射

- 左右の壁: `vx = -vx × restitution`
- 上下の壁（ゴール外エリア）: `vy = -vy × restitution`
- ゴール判定: パックの**中心**がゴール開口部の x 範囲内かつゴールラインの y 座標を通過した瞬間に得点・リセット

### パドルとの衝突

- パックとパドルが重なった場合、衝突法線方向に反射（`restitution` を適用）
- パドルの速度ベクトルをパックに加算（スマッシュ再現）
- 衝突後は重ならないようにパックを押し出す

### ゴールポストとの衝突

- ゴール開口部の両端（左右のポスト）を点として扱い、パックが接触した場合に反射する
- 反射法線: ポスト座標からパック中心へ向かう方向（円柱に当たる現実の挙動と同等）
- `restitution` を適用する

## 操作方法

### vs AI モード

| デバイス | Player 1 の操作                            |
| -------- | ------------------------------------------ |
| PC       | マウスドラッグ（フィールド内でマウス追従） |
| スマホ   | タッチドラッグ（指でパドルを直接移動）     |

### 2人対戦モード

| デバイス | Player 1（下）                   | Player 2（上）             |
| -------- | -------------------------------- | -------------------------- |
| PC       | マウス（フィールド下半分を追従） | WASD キー                  |
| スマホ   | 画面下半分をタッチドラッグ       | 画面上半分をタッチドラッグ |

#### キーボード操作（Player 2）

- W / A / S / D: 上 / 左 / 下 / 右 に移動
- 移動速度: 400 px/s（斜め移動時も速度ベクトルを正規化して 400 px/s を維持）

### パックをつかむ操作

自コートにあるパックの上にタッチ/クリックすることで、速度によらず常にパックを直接つかんで移動できる。
リアルのエアホッケーで上からパックを挟んで動かす操作に相当する。

| デバイス | 操作                           |
| -------- | ------------------------------ |
| スマホ   | パック上をタッチしてドラッグ   |
| PC       | パック上でクリックしてドラッグ |

- 判定: タッチ/クリック位置がパック中心から `puckRadius` 以内かつ自コートにあるとき発動
- ドラッグ中: パックがカーソル/タッチ位置に追従（自コートの範囲内に制限）。**パックは半透明**になりつかみ中であることを示す
- 解放時: ドラッグ速度をパックの初速として適用（最大速度上限 800 px/s 適用）
- AI はつかみ操作を行わない（停止状態への対応は AI 仕様を参照）
- PC 2 人対戦の Player 2（WASD 操作）はパックをつかめない（マウス操作がないため）

## AI 仕様

### パラメータによる動作

- **移動速度** (`aiSpeed`): AI パドルが目標座標へ向かう最大速度
- **反射予測回数** (`predictionBounces`):
  - 0 回: パックの現在位置に向かうだけ（軌道予測なし）
  - 1 回: 壁反射を 1 回先読みした着弾点へ移動
  - 2 回以上: 複数回の反射を先読みし、着弾点に先回りしてスマッシュを狙う
- **反応遅延** (`reactionDelayMs`): 目標座標の再計算間隔。大きいほど反応が鈍くなる
- **狙いのばらつき** (`targetNoiseRadius`): 着弾点に加えるランダム誤差の半径（px）。
  大きいほど狙いが外れやすくなる

### 守備行動

- `predictionBounces >= 1` かつパックが Player 1 側コートにある場合、自ゴール前の守備ポジションに戻る
- `predictionBounces >= 2` の場合、パックが遠いときは攻撃ポジション（センターやや自陣寄り）を維持

### 停止パックへの対応

- パックが AI コート内で停止状態になった場合、AI は自動でパックの位置へ移動する
- パドルがパックに到達したら、`puckInitialSpeed` の速度でプレイヤー側へプッシュする（角度は `puckResetAngleMax` に従う）

## 画面フロー

```text
トップ（ゲーム一覧）
  └→ モード選択画面
        ├→ vs AI → 難易度選択（イージー / ノーマル / ハード / カスタム）
        │           ├→ イージー / ノーマル / ハード → ゲーム画面
        │           └→ カスタム → 設定画面 → ゲーム画面
        └→ 2人対戦 → 設定画面（AI パラメータは非表示）→ ゲーム画面
                              └→ 結果画面（勝利点数達成時）
                                    └→ もう一度（モード選択に戻る）
```

## UI 仕様

### モード選択画面

- 「vs AI」「2人対戦」の選択ボタン
- vs AI 選択後に難易度選択（イージー / ノーマル / ハード / カスタム）を表示

### 設定画面

- 難易度プリセット選択時: そのプリセットの AI パラメータを初期値として各スライダーに反映
- 各パラメータをスライダーまたは数値入力で変更できる
- vs AI モード: 物理パラメータ・ルールパラメータ・AI パラメータの全項目を表示
- 2 人対戦モード: 物理パラメータ・ルールパラメータのみ表示（AI パラメータは非表示）
- 「デフォルトに戻す」ボタンで全項目をデフォルト値にリセット
- 「ゲーム開始」ボタンで現在の設定値を確定してゲーム画面へ（設定は自動保存）

#### テンプレート管理

- 現在の設定を名前付きで保存できる（「テンプレートとして保存」ボタン）
- 既存と同じ名前で保存しようとした場合は上書き確認ダイアログを表示（「上書きする」「キャンセル」）
- 保存済みテンプレートを選択して設定を一括読み込みできる
- テンプレートは削除可能
- ビルトインプリセット（イージー/ノーマル/ハード）は削除不可・名前変更不可
- 保存先: localStorage（キー `air-hockey:templates`）
- 起動時のデフォルト: 前回使用した設定（`air-hockey:last-config` に自動保存）

### ゲーム画面

- **Canvas 上部**: Player 2（またはAI）のスコア
- **Canvas**: フィールド描画（センターライン、ゴールエリア、パドル、パック）
- **Canvas 下部**: Player 1 のスコア
- 一時停止ボタン（ポーズ / 再開）
- 「もどる」ボタン（モード選択へ）: `finished` 以外の状態では確認ダイアログを表示（「終了する」「続ける」）。`finished` 状態では確認なしで即遷移

### フィールド描画

- 背景: 濃い青（エアホッケーらしい配色）
- センターライン: 白の破線
- ゴールエリア: 半透明の白で強調
- パドル Player 1: 赤系
- パドル Player 2 / AI: 青系
- パック: 白

### 結果画面（Canvas 上にオーバーレイ）

- 「Player 1 の勝ち！」または「Player 2 の勝ち！」（vs AI 時は「あなたの勝ち！」「AI の勝ち！」）
- 最終スコア表示
- 「もう一度」ボタン

### 演出

- **カウントダウン**: ゲーム開始時・一時停止解除時に「3・2・1・Go!」を各 1 秒で表示してから再開（カウントダウン中もパドルは操作可能）
- ゴール時: パック消滅 → フラッシュ演出 → スコア更新 → リセット（`goal` フェーズ中もパドルは操作可能）
- 一時停止時: 半透明オーバーレイ + 「PAUSED」表示

## 画面サイズ・レスポンシブ対応

- 常に短辺がゴール側（縦長レイアウト固定）
- Canvas はウィンドウ高さを基準にフィールドのアスペクト比（400:600 = 2:3）を維持してリサイズ
- 最大幅: 400 px（PC）、スマホでは画面幅いっぱいに表示
- スマホでブラウザの慣性スクロールを無効化（`touch-action: none`）
- スマホ横向き時: 「縦向きにしてください」メッセージを表示してゲームを一時停止

## ルート

- URL: `/air-hockey`
- ファイル: `src/routes/air-hockey/+page.svelte`

## ロジック層の設計

```text
src/lib/air-hockey/
  types.ts         ← 型定義（GameState, GameConfig, Puck, Paddle, Vec2 など）
  physics.ts       ← 物理演算（移動、壁反射、衝突判定）
  physics.test.ts  ← 物理演算の単体テスト
  ai.ts            ← AI（各パラメータに基づく移動目標計算）
  ai.test.ts       ← AI の単体テスト
  logic.ts         ← ゲーム状態管理（初期化・更新・スコア判定）
  logic.test.ts    ← ゲームロジックの単体テスト
```

### 主要な型

```typescript
type Vec2 = { x: number; y: number };

type Rect = { x: number; y: number; width: number; height: number };

type Field = {
  width: number; // 400
  height: number; // 600
  goalWidth: number; // goalWidthRatio × width
  goalDepth: number; // 30
};

type GameMode = 'vs-ai' | '2p';

type PlayerInput = {
  paddleTarget: Vec2; // パドルの目標座標（論理座標）
  grabbing: boolean; // パックをつかんでいるか
};

type AIConfig = {
  speed: number; // AI 移動速度 (px/s)
  predictionBounces: number; // 反射予測回数
  reactionDelayMs: number; // 反応遅延 (ms)
  targetNoiseRadius: number; // 狙いのばらつき (px)
};

type GameConfig = {
  puckRadius: number; // パックサイズ（半径）
  paddleRadius: number; // パドルサイズ（半径）
  goalWidthRatio: number; // ゴール幅（フィールド幅に対する比率）
  restitution: number; // 反発係数
  friction: number; // 摩擦係数（速度減衰/frame）
  puckInitialSpeed: number; // パックの初速 (px/s)
  winScore: number; // 勝利点数
  puckResetAngleMax: number; // リセット時の最大発射角度 (deg, 0=垂直, 90=水平)
  ai: AIConfig;
};

type ConfigTemplate = {
  name: string;
  config: GameConfig;
};

type AIDifficulty = 'easy' | 'normal' | 'hard' | 'custom';

type Puck = {
  pos: Vec2;
  vel: Vec2;
  radius: number;
};

type Paddle = {
  pos: Vec2;
  vel: Vec2; // 衝突時の速度転写に使用
  radius: number;
};

type GameState = {
  puck: Puck;
  player1: Paddle;
  player2: Paddle;
  score: { p1: number; p2: number };
  phase: 'countdown' | 'playing' | 'grabbed' | 'goal' | 'paused' | 'finished';
  countdownValue: 3 | 2 | 1 | 0; // 0 = 'Go!'
  winner: 1 | 2 | null;
  config: GameConfig;
};
```

### 主要な関数

```typescript
// physics.ts
export function movePuck(puck: Puck, dt: number, config: GameConfig): Puck;
export function reflectWalls(
  puck: Puck,
  field: Field,
  config: GameConfig,
): { puck: Puck; goal: 1 | 2 | null };
export function collidePaddlePuck(
  paddle: Paddle,
  puck: Puck,
  config: GameConfig,
): { paddle: Paddle; puck: Puck };
export function clampPaddleToZone(paddle: Paddle, zone: Rect): Paddle;

// logic.ts
export function createInitialState(mode: GameMode, config: GameConfig): GameState;
export function updateGame(
  state: GameState,
  dt: number,
  inputs: { p1: PlayerInput; p2: PlayerInput },
): GameState;
export function resetPuck(state: GameState, scoredBy: 1 | 2): GameState;
export function defaultConfig(): GameConfig;
export const DIFFICULTY_PRESETS: Record<Exclude<AIDifficulty, 'custom'>, AIConfig>;

// storage.ts（UI層から呼び出す、ロジック層には含めない）
export function loadLastConfig(): GameConfig;
export function saveLastConfig(config: GameConfig): void;
export function loadTemplates(): ConfigTemplate[];
export function saveTemplate(template: ConfigTemplate): void;
export function deleteTemplate(name: string): void;

// ai.ts
export function computeAITarget(state: GameState): Vec2;
```
