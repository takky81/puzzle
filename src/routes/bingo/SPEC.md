# ビンゴ 仕様書

## 概要

最大4人（人間 / CPU を任意に組み合わせ）が5x5のビンゴカードを持ち、共通の抽選番号で
自動マークしながら目標（1ライン / 3ライン / ブラックアウト）の先取を競うゲーム。

抽選は全プレイヤー共通。カードは各プレイヤーごとにランダム生成される。

## ルール

### カード

- 5x5 の25マス
- 中央（row=2, col=2）は **FREE**（最初からマーク済み、番号なし）
- 列ごとに番号レンジが決まっている（標準ビンゴ）

| 列  | 見出し | 番号レンジ |
| --- | ------ | ---------- |
| 0   | B      | 1 〜 15    |
| 1   | I      | 16 〜 30   |
| 2   | N      | 31 〜 45   |
| 3   | G      | 46 〜 60   |
| 4   | O      | 61 〜 75   |

- 各列はそのレンジから重複なく5個（N列はFREEがあるので4個）を選び、ランダムに並べる
- 同一カード内に同じ番号は出現しない

### 抽選

- 1 〜 75 の番号を重複なく1つずつ抽選する
- 抽選された番号は **全プレイヤーのカードで自動的にマークされる**
- 抽選済み番号は履歴として表示される
- 抽選は「手動」（ボタンで1つずつ）と「自動」（一定間隔で連続抽選）を切り替えられる

### ライン

- 縦5本 + 横5本 + 斜め2本 = **12本**
- ラインを構成する全マスがマーク済みになった時点で「ビンゴ」成立
- **リーチ**: あと1マスでラインが成立する状態。リーチ本数を表示する

### 目標（勝利条件）

セットアップ画面で選択する。

| 目標            | 内容                                             |
| --------------- | ------------------------------------------------ |
| 1ライン（既定） | 最初に1ライン成立したプレイヤーの勝ち            |
| 3ライン         | 最初に3ライン同時保持したプレイヤーの勝ち        |
| ブラックアウト  | FREE以外の24マス全てをマークしたプレイヤーの勝ち |

- 目標達成者が出た抽選回でいったんゲーム終了（勝者確定）
- **同一の抽選回で複数プレイヤーが達成した場合は同着（引き分け）** とし、全員を勝者とする

#### 決着後の継続プレイ

勝者が決まった後も、そのまま抽選を続けて残りのプレイヤーの順位を確定させられる。

- 結果通知の「このまま続ける」で抽選を再開する（**継続モード**）
- 勝者（`winners`）は最初の達成者のまま変わらない
- 各プレイヤーには「何回目の抽選で目標を達成したか」（`achievedAt`）を記録し、順位表示に使う
- 継続モードでは **全員が目標を達成した時点** でゲーム終了とする
- 同じ抽選回で達成したプレイヤーは同順位とする

#### 決着の保証（不変条件）

カードの24マスは全て 1〜75 の範囲の番号であるため、75個を引き切った時点で
全プレイヤーが必ずブラックアウトに到達する。よって **どの目標でも遅くとも75回目の抽選までに必ず決着する**。

「未抽選番号が尽きたのに誰も目標を達成していない」状態は仕様上あり得ず、実装バグを意味する。
`drawNumber` は未抽選番号が空の状態で呼ばれた場合、または引き切っても `phase` が `finished` に
ならない場合に例外を投げ、バグを早期に検出する。

## ゲーム設定

| 設定項目         | デフォルト値       | 設定範囲                            |
| ---------------- | ------------------ | ----------------------------------- |
| プレイヤー人数   | 2人                | 1 〜 4人                            |
| 各プレイヤー種別 | P1=人間, 他=CPU    | 人間 / CPU（プレイヤーごとに選択）  |
| 各プレイヤー名   | 種別に応じた既定名 | 1 〜 12文字（プレイヤーごとに編集） |
| 目標             | 1ライン            | 1ライン / 3ライン / ブラックアウト  |
| 自動抽選間隔     | 1500 ms            | 500 〜 3000 ms                      |

- 1人（人間1人のみ）の場合はソロプレイとして成立する
- 設定は localStorage（キー `bingo:last-config`）に自動保存し、次回起動時の初期値とする

## 画面フロー

```text
トップ（ゲーム一覧）
  └→ セットアップ画面（人数 / 各プレイヤー種別 / 目標 / 抽選間隔）
        └→ ゲーム画面
              └→ 結果画面（オーバーレイ）
                    ├→ もう一度（同じ設定で再戦）
                    └→ 設定を変える（セットアップ画面へ）
```

## UI仕様

### セットアップ画面

- プレイヤー人数の選択（1 / 2 / 3 / 4）
- 人数分のプレイヤー行を表示し、各行で「人間 / CPU」のトグルと**名前入力欄**を表示
- **プレイヤー名**
  - ゲーム設定を開いた時点で種別に応じた既定名を自動で入れる（人間: `プレイヤー1`、CPU: `CPU1`）
  - 入力欄を編集すると以降その名前が保持される
  - 未編集の行は、種別を切り替えたときに既定名も切り替わる（編集済みの行は保持する）
  - 空欄のままゲームを開始した場合は既定名に戻す
  - 最大12文字。同名が複数いてもよい（表示は入力どおり）
- 目標の選択（1ライン / 3ライン / ブラックアウト）
- 自動抽選間隔のスライダー
- 「ゲーム開始」ボタン

### ゲーム画面

#### 抽選エリア（画面上部）

- **現在の抽選番号**: 大きなボール表示（例: `B 7`）。列見出しに応じて色分け
- 「抽選する」ボタン（手動モード時）
- 「自動」トグル（ON で一定間隔の連続抽選、ゲーム中いつでも切替可能）
- **抽選回数**: `12 / 75` のように表示
- **履歴**: 直近の抽選番号を横並びで表示（新しいものが左）
  - 「すべて表示」で 1〜75 の全番号グリッドを開閉でき、抽選済みは強調表示

#### カードエリア

- 人間プレイヤーのカードを大きく表示
- CPU および他プレイヤーのカードは縮小表示（番号は読める大きさを維持）
- 各カードに表示するもの:
  - プレイヤー名（セットアップ画面で設定した名前）と種別アイコン（人間 / CPU）
  - ビンゴ本数 / リーチ本数のバッジ
  - 列見出し `B I N G O`
- **マーク済みセル**: 背景を塗りつぶし + マーク印
- **FREE セル**: 「FREE」と表示し、常にマーク済み扱い
- **成立ライン**: ライン上のセットを強調表示（線を重ねる）
- **リーチ**: リーチラインの未マスをハイライト表示

#### 操作

- **スマホ**: 抽選ボタンをタップ。カードは縦スクロール
- **PC**: 抽選ボタンをクリック、またはスペースキーで抽選

### 演出

- 抽選時: ボールがめくれるアニメーション（0.3秒程度）
- マーク時: 該当セルがポップするアニメーション
- ビンゴ成立時: カード全体をフラッシュ + 「BINGO!」表示
- リーチ到達時: 該当プレイヤーのカードに「リーチ!」バッジを表示

### 結果通知（トースト）

盤面全体を隠さないよう、モーダルダイアログではなく画面下部のトースト通知で表示する。

- 勝者名（同着時は「〇〇 と 〇〇 の同着！」）
- 何回目の抽選で決着したか
- 「このまま続ける」「もう一度」「設定を変える」ボタン
- 閉じるボタンでトーストを消せる（盤面をゆっくり確認できる）
- 継続モードで全員が達成したら、最終結果のトーストを表示する（「このまま続ける」は表示しない）

### 順位表示

- 目標を達成したプレイヤーのカードに順位バッジ（`1位` など）を表示する
- 順位は `achievedAt`（達成した抽選回）の昇順。同じ抽選回のプレイヤーは同順位

## レイアウト

- モバイルファースト
- 抽選エリアは画面上部に固定（スクロールしてもボールと抽選ボタンが見える）
- カードは 1人=1列、2人=2列、3〜4人=2x2 グリッド（スマホでは1列 or 2列）
- 各カードは正方形のアスペクト比を維持

## ルート

- URL: `/bingo`
- ファイル: `src/routes/bingo/+page.svelte`
- トップページのゲーム一覧に追加（emoji: 🎱）

## ロジック層の設計

```text
src/lib/bingo/
  types.ts        ← 型定義
  card.ts         ← カード生成・マーク・ライン判定
  card.test.ts
  logic.ts        ← ゲーム状態管理（抽選・勝敗判定）
  logic.test.ts
  storage.ts      ← 設定の保存/読込（UI層から呼び出す）
  storage.test.ts
```

### 乱数の扱い

カード生成・抽選はテスト可能にするため、乱数生成器を引数で注入する。

```typescript
type Rng = () => number; // [0, 1) を返す
```

UI層では `Math.random` を渡す。テストではシード付き擬似乱数または固定値を返す関数を渡す。

### 主要な型

```typescript
type Cell = {
  value: number | null; // null = FREE
  marked: boolean;
};

type Card = {
  cells: Cell[][]; // [row][col] の 5x5
};

type Line = {
  kind: 'row' | 'col' | 'diag';
  index: number; // row/col は 0-4、diag は 0（左上→右下）/ 1（右上→左下）
  positions: { row: number; col: number }[];
};

type PlayerType = 'human' | 'cpu';

type Player = {
  id: number;
  name: string;
  type: PlayerType;
  card: Card;
  bingoLines: number;
  reachLines: number;
  /** 目標を達成した抽選回（1始まり）。未達成は null */
  achievedAt: number | null;
};

type Goal = 'single' | 'triple' | 'blackout';

type GameConfig = {
  playerTypes: PlayerType[]; // 長さ 1〜4
  playerNames: string[]; // playerTypes と同じ長さ
  goal: Goal;
  autoDrawIntervalMs: number;
};

type GameState = {
  players: Player[];
  drawn: number[]; // 抽選済み番号（抽選順）
  remaining: number[]; // 未抽選番号
  lastDrawn: number | null;
  phase: 'playing' | 'finished';
  winners: number[]; // 勝者の player id（同着時は複数）
  continued: boolean; // 決着後に継続プレイ中か
  config: GameConfig;
};
```

### 主要な関数

```typescript
// card.ts
export const COLUMN_RANGES: readonly [number, number][]; // [[1,15],[16,30],...]
export function createCard(rng: Rng): Card;
export function markCard(card: Card, value: number): Card;
export function getAllLines(): Line[]; // 12本（静的）
export function countBingoLines(card: Card): number;
export function countReachLines(card: Card): number;
export function isBlackout(card: Card): boolean;
export function columnLabelOf(value: number): string; // 抽選ボールの列ラベル
export function getBingoLines(card: Card): Line[]; // 成立ラインの強調表示用
export function getReachPositions(card: Card): Position[]; // リーチマスのハイライト用

// logic.ts
export function defaultConfig(): GameConfig;
export function defaultPlayerName(type: PlayerType, index: number): string;
export function createInitialState(config: GameConfig, rng: Rng): GameState;
export function drawNumber(state: GameState, rng: Rng): GameState;
export function continueGame(state: GameState): GameState; // 決着後に抽選を再開する
export function getRanks(players: Player[]): Map<number, number>; // player id → 順位
export function isGoalAchieved(card: Card, goal: Goal): boolean;

// storage.ts（ロジック層には含めない）
export const LAST_CONFIG_KEY: string;
export function loadLastConfig(): GameConfig; // 不正な値が保存されていた場合はデフォルトを返す
export function saveLastConfig(config: GameConfig): void;
```

## E2Eテスト観点

- トップページから `/bingo` へ遷移できる
- セットアップ画面で人数・種別・目標を選択してゲーム開始できる
- セットアップ画面でプレイヤー名を編集すると、ゲーム画面のカードにその名前が表示される
- 抽選ボタンを押すと番号が表示され、履歴と抽選回数が増える
- 抽選された番号が各カードでマークされる
- 自動抽選トグルで連続抽選が進む / 止まる
- 目標達成時に結果トーストが表示され、盤面が隠れない
- 「このまま続ける」で抽選を再開でき、全員達成すると最終結果が表示される
- 「もう一度」で再戦できる
- スマホ幅でカードが崩れずに表示される
