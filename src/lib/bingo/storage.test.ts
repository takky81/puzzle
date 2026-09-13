import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { saveLastConfig, loadLastConfig, LAST_CONFIG_KEY } from './storage';
import { defaultConfig } from './logic';
import type { GameConfig } from './types';

// SPEC: 「設定は localStorage（キー bingo:last-config）に自動保存し、次回起動時の初期値とする」

describe('saveLastConfig / loadLastConfig', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('保存した設定をそのまま読み込める', () => {
    // Arrange
    const config: GameConfig = {
      playerTypes: ['human', 'human', 'cpu'],
      playerNames: ['たろう', 'はなこ', 'CPU3'],
      goal: 'blackout',
      autoDrawIntervalMs: 800,
    };

    // Act
    saveLastConfig(config);

    // Assert
    expect(loadLastConfig()).toEqual(config);
  });

  test('未保存のときはデフォルト設定を返す', () => {
    expect(loadLastConfig()).toEqual(defaultConfig());
  });

  test('壊れた JSON が入っているときはデフォルト設定を返す', () => {
    localStorage.setItem(LAST_CONFIG_KEY, '{ broken');

    expect(loadLastConfig()).toEqual(defaultConfig());
  });

  test('playerNames の数が playerTypes と一致しないときはデフォルト設定を返す', () => {
    localStorage.setItem(
      LAST_CONFIG_KEY,
      JSON.stringify({ ...defaultConfig(), playerNames: ['1人だけ'] }),
    );

    expect(loadLastConfig()).toEqual(defaultConfig());
  });

  test('未知の goal が入っているときはデフォルト設定を返す', () => {
    localStorage.setItem(LAST_CONFIG_KEY, JSON.stringify({ ...defaultConfig(), goal: 'unknown' }));

    expect(loadLastConfig()).toEqual(defaultConfig());
  });

  test.each([0, 5])('人数が範囲外（%i人）のときはデフォルト設定を返す', (count) => {
    localStorage.setItem(
      LAST_CONFIG_KEY,
      JSON.stringify({
        ...defaultConfig(),
        playerTypes: Array.from({ length: count }, () => 'cpu'),
        playerNames: Array.from({ length: count }, (_, i) => `CPU${i + 1}`),
      }),
    );

    expect(loadLastConfig()).toEqual(defaultConfig());
  });

  test.each([100, 5000])(
    '自動抽選間隔が範囲外（%ims）のときはデフォルト設定を返す',
    (autoDrawIntervalMs) => {
      localStorage.setItem(
        LAST_CONFIG_KEY,
        JSON.stringify({ ...defaultConfig(), autoDrawIntervalMs }),
      );

      expect(loadLastConfig()).toEqual(defaultConfig());
    },
  );

  test('localStorage が使えない環境ではデフォルト設定を返す', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(loadLastConfig()).toEqual(defaultConfig());
  });

  test('localStorage が使えない環境でも保存は例外を投げない', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => saveLastConfig(defaultConfig())).not.toThrow();
  });
});
