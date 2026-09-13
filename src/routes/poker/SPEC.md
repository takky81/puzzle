# ポーカー 仕様書

## 概要

ファイブカード・ドロー（5枚交換ポーカー）を **人間1人 vs AI1人のヘッズアップ** で対戦するゲーム。

ゲーム開始時に持ち金（チップ）を決め、AIも同額を持つ。1ハンドごとに
「配札 → 第1ベッティング → 1回だけの交換（ドロー）→ 第2ベッティング → ショーダウン」を繰り返し、
**どちらかのチップが0になった時点で決着**する。

## ルール

### カードと役

- 標準52枚（ジョーカーなし）。スート4種 × ランク13種
- ランクの強さ: 2 < 3 < ... < 10 < J < Q < K < A
- 役は5枚で判定する。強い順:

| 順位 | 役                   | 内容                      |
| ---- | -------------------- | ------------------------- |
| 9    | ストレートフラッシュ | 同スートの連続5枚         |
| 8    | フォーカード         | 同ランク4枚               |
| 7    | フルハウス           | 同ランク3枚 + 同ランク2枚 |
| 6    | フラッシュ           | 同スート5枚               |
| 5    | ストレート           | 連続する5枚               |
| 4    | スリーカード         | 同ランク3枚               |
| 3    | ツーペア             | 同ランク2枚 × 2組         |
| 2    | ワンペア             | 同ランク2枚               |
| 1    | ハイカード           | 上記いずれにも該当しない  |

- **ロイヤルフラッシュ**は「ストレートフラッシュ（Aハイ）」として扱い、独立した役にはしない
- **A-2-3-4-5** は最弱のストレート（5ハイ）として成立する。A-K-Q-J-10 が最強
- **Q-K-A-2-3** のような回り込みは成立しない
- 同じ役どうしは **タイブレーク（キッカー）** を上位から順に比較する
  - 例: ワンペア同士 → ペアのランク → 残り3枚を降順に比較
- 全て同値なら **引き分け**（スプリット）。ポットを折半し、奇数チップは非ディーラー側に渡す

### 1ハンドの流れ

1. **アンティ**: 両者が同額のアンティを支払い、ポットを作る
   - チップがアンティ額に満たない場合は残り全額を支払う（オールイン）
2. **配札**: 各自に5枚。人間の手札のみ表向き（AIの手札はショーダウンまで伏せる）
3. **第1ベッティングラウンド**（プリドロー）
4. **ドロー**: 両者とも **1回だけ**、0〜5枚を選んで交換する
   - 非ディーラー側 → ディーラー側の順に交換する
   - 捨て札は山札に戻さない（ヘッズアップなら最大20枚なので52枚で足りる）
   - AIの交換枚数は表示するが、交換したカードの中身は見せない
5. **第2ベッティングラウンド**（ポストドロー）
6. **ショーダウン**: 両者の手札を公開し、強い方がポットを獲得（引き分けなら折半）
   - 途中でフォールドが出た場合はショーダウンせず、残った側がポットを獲得する
     （フォールド勝ちの場合、勝者の手札は公開しない）
7. **ディーラーボタンを交代**して次のハンドへ

なお、アンティを払った時点でどちらかがオールインになった場合はベッティングを行わず、
交換フェーズを経てそのままショーダウンする。交換後にオールインが絡む場合も第2ベッティングは行わない。

### ベッティングルール

#### 共通

- アクションは **チェック / ベット / コール / レイズ / フォールド**
- **アクション順**: 各ラウンドとも **非ディーラー側が先**、ディーラー側が後（ディーラーがポジション有利）
- **初回のディーラーはAI**（＝人間が先に行動する）。以降は毎ハンド交代する
- 誰もベットしていない場面ではフォールドを選べない（チェックできるため）
- ラウンドは「両者のベット額が揃い、かつ両者が1回以上アクションした」時点で終了する
- どちらかがオールインし、相手がコールした場合は以降のベッティングをスキップして
  ショーダウン（ドロー前ならドローを行ってから）へ進む
- **オールイン超過分の返却**: 相手のチップが足りずコール額に届かない場合、
  超過分は賭けた側に返却する（ヘッズアップなのでサイドポットは発生しない）

#### フィックスドリミット（設定で選択）

- 1回のベット / レイズの額は **固定額 = アンティ × 2**
- 1ラウンドあたり **ベット1回 + レイズ3回** まで（キャップ4）。キャップ到達後はコールかフォールドのみ
- チップが固定額に満たない場合はオールインとして残り全額を出せる

#### ノーリミット（設定で選択）

- ベット額は **最小 = アンティ × 2**、最大 = 自分の残りチップ全額（オールイン）
- レイズは **最小レイズ幅 = 直前のベット/レイズの上乗せ額以上**（下回る額はオールイン時のみ許容）
- レイズ回数の上限はなし（チップが尽きるまで）

### 決着

- どちらかのチップが **0** になったハンドの終了時点でゲーム終了
- 勝者・プレイしたハンド数・最終チップを結果表示する

## AIの強さ

設定画面で4段階から選ぶ。

| 強さ | 情報                 | 行動方針                                                                                                                        |
| ---- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 弱い | 自分の手札のみ       | 役の有無だけで大まかに判断。基本はチェック/コール、まれにランダムでレイズ・フォールドする。交換も雑（ペア以外を残すことがある） |
| 通常 | 自分の手札のみ       | 手札強度を段階評価し、閾値でアクションを決める。交換は定石どおり（ペア・ドロー残し）。ブラフはしない                            |
| 強い | 自分の手札のみ       | 交換後の手札をモンテカルロでシミュレートして勝率を推定し、ポットオッズと比較して判断。低頻度でブラフを混ぜる                    |
| 最強 | **チート（全情報）** | 相手の手札と山札の並びが見える。交換結果とショーダウン結果を完全に知った上で最善手を選ぶ                                        |

### 「最強」の挙動（チート）

- 交換: 山札の並びが見えるため、**交換後に最も強くなる捨て方**を全通り（2^5 = 32通り）評価して選ぶ
- ベット: 相手の交換後の手札まで確定的に分かるため、
  - **勝ちが確定**していれば、相手を降ろさない範囲で最大限に引き出す（バリューベット / レイズ）
  - **負けが確定**していれば、これ以上のチップを失わないよう即フォールドする
  - **引き分け確定**ならチェック/コールで進める
- 相手が第2ベッティング前にフォールドする可能性があるため「必ず勝つ」わけではないが、
  情報上の不利は一切ない状態になる（仕様どおりの想定挙動）

## ゲーム設定

| 設定項目   | デフォルト値         | 設定範囲                                 |
| ---------- | -------------------- | ---------------------------------------- |
| 初期チップ | 1000                 | 100 / 500 / 1000 / 5000                  |
| アンティ   | 10                   | 初期チップの 0.5% / 1% / 2% 相当から選択 |
| ベット構造 | フィックスドリミット | フィックスドリミット / ノーリミット      |
| AIの強さ   | 通常                 | 弱い / 通常 / 強い / 最強                |

- 人間とAIは同額の初期チップを持つ
- 設定は localStorage（キー `poker:last-config`）に自動保存し、次回起動時の初期値とする

## 画面フロー

```text
トップ（ゲーム一覧）
  └→ セットアップ画面（初期チップ / アンティ / ベット構造 / AIの強さ）
        └→ ゲーム画面（ハンドを繰り返す）
              └→ 結果画面（オーバーレイ）
                    ├→ もう一度（同じ設定で再戦）
                    └→ 設定を変える（セットアップ画面へ）
```

## UI仕様

### セットアップ画面

- 初期チップの選択
- アンティの選択
- ベット構造の選択（フィックスドリミット / ノーリミット）
- AIの強さの選択（弱い / 通常 / 強い / 最強）
  - 「最強」には「相手の手札と山札が見えるチートAIです」と注記を表示する
- 「ゲーム開始」ボタン

### ゲーム画面

#### 上部: AIエリア

- AIのチップ残高、ディーラーボタン表示
- AIの手札（裏面5枚）。ショーダウン時のみ表向きにする
- 直前のAIのアクション（「レイズ 20」「2枚交換」など）を吹き出しで表示

#### 中央: ポットエリア

- ポット額を大きく表示
- 現在のフェーズ（第1ベット / 交換 / 第2ベット / ショーダウン）を表示
- ショーダウン時は両者の役名と勝敗を表示

#### 下部: プレイヤーエリア

- 自分のチップ残高、ディーラーボタン表示
- 自分の手札5枚（表向き）
- 現在の役名を常時表示（例: 「ワンペア（K）」）
- **交換フェーズ**: カードをタップ/クリックで選択（選択中は浮き上がる）。「交換する」ボタンで確定
  - 0枚選択のまま確定すれば「交換しない（スタンドパット）」
- **ベッティングフェーズ**: 実行可能なアクションのボタンのみ活性化する
  - フィックスドリミット: `フォールド` `チェック/コール` `ベット/レイズ（固定額表示）`
  - ノーリミット: 上記に加え、ベット額のスライダーと `1/2ポット` `ポット` `オールイン` のショートカット
- ハンド終了後は「次のハンドへ」ボタンで進む

### 演出

- 配札: カードが1枚ずつ配られるアニメーション（0.1秒間隔程度）
- 交換: 捨てたカードがフェードアウトし、新しいカードがスライドインする
- ベット: チップがポットへ移動するアニメーション
- ショーダウン: AIの手札を1枚ずつめくる
- 勝敗確定: 勝者側のカードと役名をハイライト

### 結果通知

- ハンド終了ごとに「勝敗 / 役 / 増減チップ」をトーストで表示（盤面は隠さない）
- ゲーム終了時はオーバーレイで最終結果（勝者 / ハンド数 / 最終チップ）と
  「もう一度」「設定を変える」ボタンを表示する

## レイアウト

- モバイルファースト
- AIエリア / ポット / プレイヤーエリアを縦3段に配置
- カードは5枚が横一列に収まるサイズを維持し、スマホ幅でも重ならないよう調整
- アクションボタンは画面下部に固定して親指で届く位置に置く

## ルート

- URL: `/poker`
- ファイル: `src/routes/poker/+page.svelte`
- トップページのゲーム一覧に追加（emoji: 🃏）

## ロジック層の設計

```text
src/lib/poker/
  types.ts      ← 型定義
  deck.ts       ← デッキ生成・シャッフル・ドロー
  deck.test.ts
  hand.ts       ← 役判定・手札比較
  hand.test.ts
  logic.ts      ← ハンド進行のステートマシン（ベット・交換・ショーダウン・チップ精算）
  logic.test.ts
  ai.ts         ← AI（4段階のアクション決定・交換判断）
  ai.test.ts
  storage.ts    ← 設定の永続化（localStorage）
  storage.test.ts
```

### 乱数の扱い

シャッフル・AIのランダム要素はテスト可能にするため、乱数生成器を引数で注入する。

```typescript
type Rng = () => number; // [0, 1) を返す
```

UI層では `Math.random` を渡す。テストではシード付き擬似乱数または固定値を返す関数を渡す。

### 主要な型

```typescript
type Suit = 'spade' | 'heart' | 'diamond' | 'club';
/** 2〜14（11=J, 12=Q, 13=K, 14=A） */
type Rank = number;
type Card = { suit: Suit; rank: Rank };

type HandCategory =
  | 'highCard'
  | 'onePair'
  | 'twoPair'
  | 'threeOfAKind'
  | 'straight'
  | 'flush'
  | 'fullHouse'
  | 'fourOfAKind'
  | 'straightFlush';

type HandRank = {
  category: HandCategory;
  /** 同カテゴリ内の比較用。上位から順に並べたランク列 */
  tiebreak: Rank[];
};

type PlayerId = 'human' | 'ai';

type BetStructure = 'fixedLimit' | 'noLimit';
type AiLevel = 'weak' | 'normal' | 'strong' | 'cheat';

type GameConfig = {
  initialChips: number;
  ante: number;
  betStructure: BetStructure;
  aiLevel: AiLevel;
};

type Action =
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'fold' }
  | { type: 'bet'; amount: number }
  | { type: 'raise'; amount: number }; // amount は「合計で幾らまで賭けるか」

type LegalActions = {
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canFold: boolean;
  canBet: boolean;
  canRaise: boolean;
  /** ベット/レイズ時の合計額の下限・上限 */
  minRaiseTo: number;
  maxRaiseTo: number;
};

type Phase =
  | 'bet1' // 第1ベッティング
  | 'draw' // 交換
  | 'bet2' // 第2ベッティング
  | 'showdown' // 手札公開
  | 'handEnd' // ハンド終了（次のハンド待ち）
  | 'gameEnd'; // どちらかが破産

type PlayerState = {
  id: PlayerId;
  chips: number;
  hand: Card[];
  /** このラウンドで既に賭けている額 */
  bet: number;
  folded: boolean;
  allIn: boolean;
  /** このハンドで交換した枚数（未交換は null） */
  drawCount: number | null;
};

type HandResult = {
  winner: PlayerId | null; // null = 引き分け
  bySplit: boolean;
  byFold: boolean;
  humanRank: HandRank | null;
  aiRank: HandRank | null;
  /** 各プレイヤーのチップ増減 */
  delta: Record<PlayerId, number>;
};

type GameState = {
  config: GameConfig;
  deck: Card[];
  players: Record<PlayerId, PlayerState>;
  pot: number;
  phase: Phase;
  /** 手番のプレイヤー（ベッティングフェーズ以外は null） */
  turn: PlayerId | null;
  dealer: PlayerId;
  /** 現ラウンドのベット/レイズ回数（フィックスドリミットのキャップ判定用） */
  raiseCount: number;
  handNumber: number;
  lastResult: HandResult | null;
};
```

### 主要な関数

```typescript
// deck.ts
export function createDeck(): Card[];
export function shuffle(deck: Card[], rng: Rng): Card[];
export function drawCards(deck: Card[], n: number): { cards: Card[]; rest: Card[] };

// hand.ts
export function evaluateHand(cards: Card[]): HandRank; // 5枚を渡す
export function compareHands(a: HandRank, b: HandRank): number; // 正=a勝ち, 0=引き分け
export function handCategoryName(category: HandCategory): string;
export function describeHand(rank: HandRank): string; // 「ワンペア（K）」など

// logic.ts
export function defaultConfig(): GameConfig;
export function createInitialState(config: GameConfig): GameState;
export function startHand(state: GameState, rng: Rng): GameState; // アンティ徴収+配札
export function getLegalActions(state: GameState): LegalActions;
export function applyAction(state: GameState, action: Action): GameState;
export function exchangeCards(state: GameState, player: PlayerId, indices: number[]): GameState;
export function resolveShowdown(state: GameState): GameState; // lastResult を確定させる
export function nextHand(state: GameState, rng: Rng): GameState;

// ai.ts
export function decideAction(state: GameState, rng: Rng): Action; // 手番がaiのとき
export function decideDiscards(state: GameState, rng: Rng): number[]; // 捨てるインデックス

// storage.ts（ロジック層には含めない）
export const LAST_CONFIG_KEY: string;
export function loadLastConfig(): GameConfig; // 不正値ならデフォルト
export function saveLastConfig(config: GameConfig): void;
```

### 不変条件（実装バグの早期検出）

- `pot + human.chips + ai.chips` は常に `initialChips * 2` に等しい（チップの総量保存）
- `deck.length + 配られたカード枚数 + 捨て札枚数` は常に 52
- 山札が足りない状態で `drawCards` が呼ばれた場合は例外を投げる
  （ヘッズアップ + 最大5枚交換なら 10 + 10 = 20 枚しか使わないため、本来起こり得ない）
- `getLegalActions` が全て false を返す状態でフェーズが進まない場合は例外を投げる

## E2Eテスト観点

- トップページから `/poker` へ遷移できる
- セットアップ画面で初期チップ・アンティ・ベット構造・AIの強さを選んでゲーム開始できる
- ゲーム開始時に両者のチップが同額で、アンティ分がポットに入っている
- 自分の手札5枚が表向き、AIの手札5枚が裏向きで表示される
- 第1ベッティングでチェック/ベット/フォールドのボタンが操作でき、ポットとチップが更新される
- フィックスドリミットではベット額が固定表示、ノーリミットではスライダーが表示される
- 交換フェーズでカードを選択して交換すると、選んだ枚数だけカードが入れ替わる
- 交換は1ハンドにつき1回しかできない（交換後はボタンが消える）
- ショーダウンでAIの手札が公開され、役名と勝敗が表示される
- フォールドするとショーダウンせずに次のハンドへ進める
- チップが0になるとゲーム終了オーバーレイが表示され、「もう一度」で再戦できる
- スマホ幅で手札5枚とアクションボタンが崩れずに表示される
