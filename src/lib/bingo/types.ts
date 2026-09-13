/** [0, 1) の乱数を返す関数。テスト可能にするため生成器を注入する */
export type Rng = () => number;

export type Cell = {
  /** null は FREE マス */
  value: number | null;
  marked: boolean;
};

export type Card = {
  /** [row][col] の 5x5 */
  cells: Cell[][];
};

export type Position = { row: number; col: number };

export type Line = {
  kind: 'row' | 'col' | 'diag';
  /** row/col は 0-4、diag は 0（左上→右下）/ 1（右上→左下） */
  index: number;
  positions: Position[];
};

export type PlayerType = 'human' | 'cpu';

export type Player = {
  id: number;
  name: string;
  type: PlayerType;
  card: Card;
  bingoLines: number;
  reachLines: number;
  /** 目標を達成した抽選回（1始まり）。未達成は null */
  achievedAt: number | null;
};

export type Goal = 'single' | 'triple' | 'blackout';

export type GameConfig = {
  /** 長さ 1〜4 */
  playerTypes: PlayerType[];
  /** playerTypes と同じ長さ */
  playerNames: string[];
  goal: Goal;
  autoDrawIntervalMs: number;
};

export type GameState = {
  players: Player[];
  /** 抽選済み番号（抽選順） */
  drawn: number[];
  /** 未抽選番号 */
  remaining: number[];
  lastDrawn: number | null;
  phase: 'playing' | 'finished';
  /** 勝者の player id（同着時は複数） */
  winners: number[];
  /** 決着後に継続プレイ中か */
  continued: boolean;
  config: GameConfig;
};
