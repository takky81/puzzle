import { AI_LEVELS, anteOptions, BET_STRUCTURES, CHIP_OPTIONS, defaultConfig } from './logic';
import type { AiLevel, BetStructure, GameConfig } from './types';

export const LAST_CONFIG_KEY = 'poker:last-config';

function isValidConfig(value: unknown): value is GameConfig {
  if (typeof value !== 'object' || value === null) return false;
  const { initialChips, ante, betStructure, aiLevel } = value as Partial<GameConfig>;

  if (typeof initialChips !== 'number' || !CHIP_OPTIONS.includes(initialChips)) return false;
  if (typeof ante !== 'number' || !anteOptions(initialChips).includes(ante)) return false;
  if (!BET_STRUCTURES.includes(betStructure as BetStructure)) return false;
  if (!AI_LEVELS.includes(aiLevel as AiLevel)) return false;

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
