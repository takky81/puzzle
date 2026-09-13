import { createCard, countBingoLines, countReachLines, markCard, isBlackout } from './card';
import type { Card, GameConfig, GameState, Goal, Player, PlayerType, Rng } from './types';

/** 抽選対象の番号の総数（1〜75） */
export const TOTAL_NUMBERS = 75;

/** プレイヤー人数の範囲 */
export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 4;

/** 自動抽選間隔の範囲 (ms) */
export const MIN_INTERVAL_MS = 500;
export const MAX_INTERVAL_MS = 3000;

/** プレイヤー名の最大文字数 */
export const MAX_NAME_LENGTH = 12;

/** 選択可能な目標 */
export const GOALS: Goal[] = ['single', 'triple', 'blackout'];

/** 選択可能なプレイヤー種別 */
export const PLAYER_TYPES: PlayerType[] = ['human', 'cpu'];

/** プレイヤーの既定名（index は0始まり、表示は1始まり） */
export function defaultPlayerName(type: PlayerType, index: number): string {
  return type === 'human' ? `プレイヤー${index + 1}` : `CPU${index + 1}`;
}

export function defaultConfig(): GameConfig {
  const playerTypes: PlayerType[] = ['human', 'cpu'];
  return {
    playerTypes,
    playerNames: playerTypes.map((type, index) => defaultPlayerName(type, index)),
    goal: 'single',
    autoDrawIntervalMs: 1500,
  };
}

export function createInitialState(config: GameConfig, rng: Rng): GameState {
  const players: Player[] = config.playerTypes.map((type, index) => ({
    id: index,
    name: config.playerNames[index],
    type,
    card: createCard(rng),
    bingoLines: 0,
    reachLines: 0,
    achievedAt: null,
  }));
  return {
    players,
    drawn: [],
    remaining: Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1),
    lastDrawn: null,
    phase: 'playing',
    winners: [],
    continued: false,
    config,
  };
}

/** 目標ごとに必要なビンゴ本数 */
const REQUIRED_LINES: Record<Exclude<Goal, 'blackout'>, number> = {
  single: 1,
  triple: 3,
};

export function isGoalAchieved(card: Card, goal: Goal): boolean {
  if (goal === 'blackout') {
    return isBlackout(card);
  }
  return countBingoLines(card) >= REQUIRED_LINES[goal];
}

/**
 * 番号を1つ抽選し、全プレイヤーのカードを自動マークした新しい state を返す。
 *
 * SPEC「決着の保証」より、75個を引き切る前に必ず決着するため、
 * 未抽選番号が尽きた状態や決着後の呼び出しは実装バグを意味する。
 */
export function drawNumber(state: GameState, rng: Rng): GameState {
  if (state.phase === 'finished') {
    throw new Error('drawNumber: ゲームは既に終了している');
  }
  if (state.remaining.length === 0) {
    throw new Error('drawNumber: 未抽選番号が尽きているのに決着していない');
  }

  const index = Math.floor(rng() * state.remaining.length);
  const value = state.remaining[index];
  const remaining = state.remaining.filter((_, i) => i !== index);
  const drawCount = state.drawn.length + 1;

  const players: Player[] = state.players.map((player) => {
    const card = markCard(player.card, value);
    const achieved = isGoalAchieved(card, state.config.goal);
    return {
      ...player,
      card,
      bingoLines: countBingoLines(card),
      reachLines: countReachLines(card),
      // 達成回は最初に達成したときだけ記録する
      achievedAt: player.achievedAt ?? (achieved ? drawCount : null),
    };
  });

  // 勝者は最初の達成者のまま。継続モードでは新たな勝者を増やさない
  const winners = state.continued
    ? state.winners
    : players.filter((player) => player.achievedAt !== null).map((player) => player.id);

  // 通常は最初の達成者が出た時点、継続モードでは全員が達成した時点で終了する
  const finished = state.continued
    ? players.every((player) => player.achievedAt !== null)
    : winners.length > 0;

  return {
    ...state,
    players,
    drawn: [...state.drawn, value],
    remaining,
    lastDrawn: value,
    phase: finished ? 'finished' : 'playing',
    winners,
  };
}

/** 決着後に抽選を再開する（勝者は変わらず、残りのプレイヤーの順位を確定させる） */
export function continueGame(state: GameState): GameState {
  if (state.phase !== 'finished') {
    throw new Error('continueGame: 決着していないゲームは継続できない');
  }
  return { ...state, phase: 'playing', continued: true };
}

/** achievedAt の昇順に順位を付ける（同じ抽選回は同順位、未達成は含まない） */
export function getRanks(players: Player[]): Map<number, number> {
  const achieved = players.filter(
    (player): player is Player & { achievedAt: number } => player.achievedAt !== null,
  );
  const ranks = new Map<number, number>();
  for (const player of achieved) {
    // 自分より早く達成した人数 + 1 が順位（同じ抽選回なら同順位）
    const rank = achieved.filter((other) => other.achievedAt < player.achievedAt).length + 1;
    ranks.set(player.id, rank);
  }
  return ranks;
}
