import { createDeck, drawCards, shuffle } from './deck';
import { compareHands, evaluateHand, HAND_SIZE } from './hand';
import type {
  Action,
  AiLevel,
  BetStructure,
  GameConfig,
  GameState,
  HandResult,
  LegalActions,
  PlayerId,
  PlayerState,
  Rng,
} from './types';

export const PLAYER_IDS: readonly PlayerId[] = ['human', 'ai'];

/** セットアップ画面で選べる初期チップ */
export const CHIP_OPTIONS: readonly number[] = [100, 500, 1000, 5000];

/** アンティは初期チップに対する割合から選ぶ */
export const ANTE_RATIOS: readonly number[] = [0.005, 0.01, 0.02];

export const BET_STRUCTURES: readonly BetStructure[] = ['fixedLimit', 'noLimit'];

export const AI_LEVELS: readonly AiLevel[] = ['weak', 'normal', 'strong', 'cheat'];

/** 初期チップに応じたアンティの候補（端数は切り上げ、重複は除く） */
export function anteOptions(initialChips: number): number[] {
  const values = ANTE_RATIOS.map((ratio) => Math.max(1, Math.ceil(initialChips * ratio)));
  return [...new Set(values)].sort((a, b) => a - b);
}

export function defaultConfig(): GameConfig {
  return {
    initialChips: 1000,
    ante: 10,
    betStructure: 'fixedLimit',
    aiLevel: 'normal',
  };
}

/** 相手のプレイヤーID */
export function opponentOf(id: PlayerId): PlayerId {
  return id === 'human' ? 'ai' : 'human';
}

function createPlayer(id: PlayerId, chips: number): PlayerState {
  return {
    id,
    chips,
    hand: [],
    bet: 0,
    folded: false,
    allIn: false,
    drawCount: null,
    acted: false,
  };
}

export function createInitialState(config: GameConfig): GameState {
  return {
    config,
    deck: [],
    players: {
      human: createPlayer('human', config.initialChips),
      ai: createPlayer('ai', config.initialChips),
    },
    pot: 0,
    // 初回のディーラーはAI。非ディーラーが先に行動するため人間が先手になる
    phase: 'handEnd',
    turn: null,
    dealer: 'ai',
    raiseCount: 0,
    lastRaiseSize: 0,
    handNumber: 0,
    handStartChips: { human: config.initialChips, ai: config.initialChips },
    lastResult: null,
  };
}

/** アンティを徴収して5枚ずつ配る */
export function startHand(state: GameState, rng: Rng): GameState {
  if (state.phase === 'gameEnd') {
    throw new Error('ゲームは終了している');
  }

  const { ante } = state.config;
  let deck = shuffle(createDeck(), rng);
  let pot = 0;

  const players = {} as Record<PlayerId, PlayerState>;
  for (const id of PLAYER_IDS) {
    const chipsBefore = state.players[id].chips;
    const paid = Math.min(ante, chipsBefore);
    const dealt = drawCards(deck, HAND_SIZE);
    deck = dealt.rest;
    pot += paid;
    players[id] = {
      ...createPlayer(id, chipsBefore - paid),
      hand: dealt.cards,
      allIn: chipsBefore - paid === 0,
    };
  }

  const skipBetting = PLAYER_IDS.some((id) => players[id].allIn);

  return {
    ...state,
    deck,
    players,
    pot,
    phase: skipBetting ? 'draw' : 'bet1',
    turn: skipBetting ? null : opponentOf(state.dealer),
    raiseCount: 0,
    lastRaiseSize: 0,
    handNumber: state.handNumber + 1,
    handStartChips: { human: state.players.human.chips, ai: state.players.ai.chips },
    lastResult: null,
  };
}

/** ベッティングフェーズかどうか */
export function isBettingPhase(phase: GameState['phase']): boolean {
  return phase === 'bet1' || phase === 'bet2';
}

/** フィックスドリミットの1ベット単位（ノーリミットでは最小ベット額） */
export function betUnit(config: GameConfig): number {
  return config.ante * 2;
}

/** フィックスドリミットで1ラウンドに許されるベット/レイズ回数 */
export const FIXED_LIMIT_CAP = 4;

const NO_ACTIONS: LegalActions = {
  canCheck: false,
  canCall: false,
  callAmount: 0,
  canFold: false,
  canBet: false,
  canRaise: false,
  minRaiseTo: 0,
  maxRaiseTo: 0,
};

export function getLegalActions(state: GameState): LegalActions {
  const turn = state.turn;
  if (!isBettingPhase(state.phase) || turn === null) return NO_ACTIONS;

  const me = state.players[turn];
  const other = state.players[opponentOf(turn)];
  const unit = betUnit(state.config);
  const toCall = other.bet - me.bet;
  const maxRaiseTo = me.bet + me.chips;
  const capped = state.config.betStructure === 'fixedLimit' && state.raiseCount >= FIXED_LIMIT_CAP;

  // 相手がオールインで追加のベットができない場合はレイズ不可
  const opponentCanRespond = other.chips > 0;

  if (toCall === 0) {
    const desiredTo = me.bet + unit;
    const betTo = Math.min(desiredTo, maxRaiseTo);
    const canBet = me.chips > 0 && !capped && opponentCanRespond;
    return {
      canCheck: true,
      canCall: false,
      callAmount: 0,
      canFold: false,
      canBet,
      canRaise: false,
      minRaiseTo: canBet ? betTo : 0,
      maxRaiseTo: canBet ? (state.config.betStructure === 'fixedLimit' ? betTo : maxRaiseTo) : 0,
    };
  }

  const desiredRaiseTo =
    state.config.betStructure === 'fixedLimit'
      ? other.bet + unit
      : other.bet + Math.max(state.lastRaiseSize, unit);
  const minRaiseTo = Math.min(desiredRaiseTo, maxRaiseTo);
  const canRaise = maxRaiseTo > other.bet && !capped && opponentCanRespond;

  return {
    canCheck: false,
    canCall: true,
    callAmount: Math.min(toCall, me.chips),
    canFold: true,
    canBet: false,
    canRaise,
    minRaiseTo: canRaise ? minRaiseTo : 0,
    maxRaiseTo: canRaise
      ? state.config.betStructure === 'fixedLimit'
        ? minRaiseTo
        : maxRaiseTo
      : 0,
  };
}

function clonePlayers(players: Record<PlayerId, PlayerState>): Record<PlayerId, PlayerState> {
  return {
    human: { ...players.human, hand: [...players.human.hand] },
    ai: { ...players.ai, hand: [...players.ai.hand] },
  };
}

/** 賭け金をポットに集めて次のラウンドの準備をする */
function collectBets(state: GameState, players: Record<PlayerId, PlayerState>): GameState {
  const pot = state.pot + players.human.bet + players.ai.bet;
  for (const id of PLAYER_IDS) {
    players[id].bet = 0;
    players[id].acted = false;
  }
  return { ...state, players, pot, raiseCount: 0, lastRaiseSize: 0 };
}

/** ハンドを終了させ、ポットを分配して結果を記録する */
function finishHand(
  state: GameState,
  players: Record<PlayerId, PlayerState>,
  result: Omit<HandResult, 'delta'>,
): GameState {
  const pot = state.pot + players.human.bet + players.ai.bet;
  for (const id of PLAYER_IDS) players[id].bet = 0;

  if (result.winner === null) {
    // 引き分け: 折半し、奇数チップは非ディーラー側に渡す
    const half = Math.floor(pot / 2);
    players.human.chips += half;
    players.ai.chips += half;
    players[opponentOf(state.dealer)].chips += pot - half * 2;
  } else {
    players[result.winner].chips += pot;
  }

  const delta: Record<PlayerId, number> = {
    human: players.human.chips - state.handStartChips.human,
    ai: players.ai.chips - state.handStartChips.ai,
  };
  const bankrupt = PLAYER_IDS.some((id) => players[id].chips === 0);

  return {
    ...state,
    players,
    pot: 0,
    phase: bankrupt ? 'gameEnd' : 'handEnd',
    turn: null,
    raiseCount: 0,
    lastRaiseSize: 0,
    lastResult: { ...result, delta },
  };
}

/** ベッティングラウンドを終える（bet1 → draw、bet2 → showdown） */
function endBettingRound(state: GameState, players: Record<PlayerId, PlayerState>): GameState {
  const collected = collectBets(state, players);
  return {
    ...collected,
    phase: state.phase === 'bet1' ? 'draw' : 'showdown',
    turn: null,
  };
}

export function applyAction(state: GameState, action: Action): GameState {
  const turn = state.turn;
  const legal = getLegalActions(state);
  if (turn === null) throw new Error('手番ではないためアクションできない');

  const players = clonePlayers(state.players);
  const me = players[turn];
  const other = players[opponentOf(turn)];

  switch (action.type) {
    case 'check': {
      if (!legal.canCheck) throw new Error('チェックできない');
      me.acted = true;
      break;
    }
    case 'fold': {
      if (!legal.canFold) throw new Error('フォールドできない');
      me.folded = true;
      return finishHand(state, players, {
        winner: other.id,
        bySplit: false,
        byFold: true,
        humanRank: null,
        aiRank: null,
      });
    }
    case 'call': {
      if (!legal.canCall) throw new Error('コールできない');
      const paid = Math.min(other.bet - me.bet, me.chips);
      me.chips -= paid;
      me.bet += paid;
      me.acted = true;
      if (me.chips === 0) me.allIn = true;
      // コール額に届かないオールインでは超過分を相手に返す
      if (me.bet < other.bet) {
        const refund = other.bet - me.bet;
        other.bet -= refund;
        other.chips += refund;
      }
      break;
    }
    case 'bet':
    case 'raise': {
      const allowed = action.type === 'bet' ? legal.canBet : legal.canRaise;
      if (!allowed) throw new Error(`${action.type}できない`);
      if (action.amount < legal.minRaiseTo || action.amount > legal.maxRaiseTo) {
        throw new Error(
          `ベット額が範囲外: ${action.amount}（${legal.minRaiseTo}〜${legal.maxRaiseTo}）`,
        );
      }
      const raiseSize = action.amount - other.bet;
      me.chips -= action.amount - me.bet;
      me.bet = action.amount;
      me.acted = true;
      if (me.chips === 0) me.allIn = true;
      other.acted = false;
      return {
        ...state,
        players,
        turn: other.id,
        raiseCount: state.raiseCount + 1,
        lastRaiseSize: Math.max(raiseSize, state.lastRaiseSize),
      };
    }
  }

  const roundComplete =
    players.human.acted && players.ai.acted && players.human.bet === players.ai.bet;
  if (roundComplete) return endBettingRound(state, players);
  return { ...state, players, turn: other.id };
}

/** 次に交換する番のプレイヤー（交換フェーズ以外や両者済みなら null） */
export function nextDrawer(state: GameState): PlayerId | null {
  if (state.phase !== 'draw') return null;
  const first = opponentOf(state.dealer);
  if (state.players[first].drawCount === null) return first;
  if (state.players[state.dealer].drawCount === null) return state.dealer;
  return null;
}

/** 指定したインデックスのカードを捨てて同数を山札から引く */
export function exchangeCards(state: GameState, player: PlayerId, indices: number[]): GameState {
  if (state.phase !== 'draw') throw new Error('交換フェーズではない');
  if (nextDrawer(state) !== player) throw new Error(`${player} の交換順ではない`);

  const unique = new Set(indices);
  if (unique.size !== indices.length) throw new Error('同じカードを重複して指定している');
  if (indices.some((i) => !Number.isInteger(i) || i < 0 || i >= HAND_SIZE)) {
    throw new Error(`交換するカードの指定が範囲外: ${indices.join(',')}`);
  }

  const players = clonePlayers(state.players);
  const me = players[player];
  const { cards, rest } = drawCards(state.deck, indices.length);

  let drawn = 0;
  me.hand = me.hand.map((card, i) => (unique.has(i) ? cards[drawn++] : card));
  me.drawCount = indices.length;

  const next: GameState = { ...state, players, deck: rest };
  if (nextDrawer(next) !== null) return next;

  // 両者の交換が完了。オールインが絡む場合は第2ベッティングを飛ばす
  const skipBetting = PLAYER_IDS.some((id) => players[id].allIn);
  return {
    ...next,
    phase: skipBetting ? 'showdown' : 'bet2',
    turn: skipBetting ? null : opponentOf(state.dealer),
    raiseCount: 0,
    lastRaiseSize: 0,
  };
}

/** 手札を公開して勝敗を決め、ポットを分配する */
export function resolveShowdown(state: GameState): GameState {
  if (state.phase !== 'showdown') throw new Error('ショーダウンのフェーズではない');

  const humanRank = evaluateHand(state.players.human.hand);
  const aiRank = evaluateHand(state.players.ai.hand);
  const diff = compareHands(humanRank, aiRank);

  return finishHand(state, clonePlayers(state.players), {
    winner: diff === 0 ? null : diff > 0 ? 'human' : 'ai',
    bySplit: diff === 0,
    byFold: false,
    humanRank,
    aiRank,
  });
}

/** ディーラーを交代して次のハンドを始める */
export function nextHand(state: GameState, rng: Rng): GameState {
  if (state.phase !== 'handEnd') throw new Error('ハンドが終了していない');
  return startHand({ ...state, dealer: opponentOf(state.dealer) }, rng);
}
