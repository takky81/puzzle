import {
  defaultConfig,
  GOALS,
  PLAYER_TYPES,
  MIN_PLAYERS,
  MAX_PLAYERS,
  MIN_INTERVAL_MS,
  MAX_INTERVAL_MS,
} from './logic';
import type { GameConfig, Goal } from './types';

export const LAST_CONFIG_KEY = 'bingo:last-config';

function isValidConfig(value: unknown): value is GameConfig {
  if (typeof value !== 'object' || value === null) return false;
  const { playerTypes, playerNames, goal, autoDrawIntervalMs } = value as Partial<GameConfig>;

  if (!Array.isArray(playerTypes) || !Array.isArray(playerNames)) return false;
  if (playerTypes.length < MIN_PLAYERS || playerTypes.length > MAX_PLAYERS) return false;
  if (playerNames.length !== playerTypes.length) return false;
  if (!playerTypes.every((type) => PLAYER_TYPES.includes(type))) return false;
  if (!playerNames.every((name) => typeof name === 'string' && name.length > 0)) return false;
  if (!GOALS.includes(goal as Goal)) return false;
  if (typeof autoDrawIntervalMs !== 'number') return false;
  if (autoDrawIntervalMs < MIN_INTERVAL_MS || autoDrawIntervalMs > MAX_INTERVAL_MS) return false;

  return true;
}

export function loadLastConfig(): GameConfig {
  try {
    const raw = localStorage.getItem(LAST_CONFIG_KEY);
    if (raw === null) return defaultConfig();
    const parsed: unknown = JSON.parse(raw);
    return isValidConfig(parsed) ? parsed : defaultConfig();
  } catch {
    return defaultConfig();
  }
}

export function saveLastConfig(config: GameConfig): void {
  try {
    localStorage.setItem(LAST_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // localStorage が使えない環境では保存をあきらめる
  }
}
