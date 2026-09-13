/** [0, 1) の乱数を返す関数。テスト可能にするため生成器を注入する */
export type Rng = () => number;

export type Suit = 'spade' | 'heart' | 'diamond' | 'club';

/** 2〜14（11=J, 12=Q, 13=K, 14=A） */
export type Rank = number;

export type Card = { suit: Suit; rank: Rank };

export type HandCategory =
  | 'highCard'
  | 'onePair'
  | 'twoPair'
  | 'threeOfAKind'
  | 'straight'
  | 'flush'
  | 'fullHouse'
  | 'fourOfAKind'
  | 'straightFlush';

export type HandRank = {
  category: HandCategory;
  /** 同カテゴリ内の比較用。上位から順に並べたランク列 */
  tiebreak: Rank[];
};

export type PlayerId = 'human' | 'ai';

export type BetStructure = 'fixedLimit' | 'noLimit';

export type AiLevel = 'weak' | 'normal' | 'strong' | 'cheat';

export type GameConfig = {
  initialChips: number;
  ante: number;
  betStructure: BetStructure;
  aiLevel: AiLevel;
};

export type Action =
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'fold' }
  /** amount は「このラウンドで合計いくらまで賭けるか」 */
  | { type: 'bet'; amount: number }
  | { type: 'raise'; amount: number };

export type LegalActions = {
  canCheck: boolean;
  canCall: boolean;
  /** コールに必要な追加額（チップ不足時はオールイン額） */
  callAmount: number;
  canFold: boolean;
  canBet: boolean;
  canRaise: boolean;
  /** ベット/レイズ時の合計額の下限・上限 */
  minRaiseTo: number;
  maxRaiseTo: number;
};

export type Phase =
  | 'bet1'
  | 'draw'
  | 'bet2'
  | 'showdown'
  | 'handEnd'
  /** どちらかが破産してゲーム終了 */
  | 'gameEnd';

export type PlayerState = {
  id: PlayerId;
  chips: number;
  hand: Card[];
  /** このラウンドで既に賭けている額 */
  bet: number;
  folded: boolean;
  allIn: boolean;
  /** このハンドで交換した枚数（未交換は null） */
  drawCount: number | null;
  /** 現ラウンドでアクション済みか */
  acted: boolean;
};

export type HandResult = {
  /** null = 引き分け */
  winner: PlayerId | null;
  bySplit: boolean;
  byFold: boolean;
  humanRank: HandRank | null;
  aiRank: HandRank | null;
  /** ハンド開始時からのチップ増減 */
  delta: Record<PlayerId, number>;
};

export type GameState = {
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
  /** 現ラウンドの直前のレイズ幅（ノーリミットの最小レイズ判定用） */
  lastRaiseSize: number;
  handNumber: number;
  /** ハンド開始時のチップ（増減表示用） */
  handStartChips: Record<PlayerId, number>;
  lastResult: HandResult | null;
};
