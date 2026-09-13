import { describe, test, expect, beforeEach } from 'vitest';
import { LAST_CONFIG_KEY, loadLastConfig, saveLastConfig } from './storage';
import { anteOptions, defaultConfig } from './logic';

// テストリスト（Step 1: List）
// SPEC: src/routes/poker/SPEC.md の「ゲーム設定」から導出

describe('anteOptions', () => {
  test('初期チップに応じたアンティ候補を返す', () => {
    expect(anteOptions(1000)).toEqual([5, 10, 20]);
  });

  test('端数は切り上げ、重複は取り除く', () => {
    expect(anteOptions(100)).toEqual([1, 2]);
  });

  test('デフォルトのアンティは候補に含まれる', () => {
    const config = defaultConfig();
    expect(anteOptions(config.initialChips)).toContain(config.ante);
  });
});

describe('loadLastConfig / saveLastConfig', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('保存していなければデフォルト設定を返す', () => {
    expect(loadLastConfig()).toEqual(defaultConfig());
  });

  test('保存した設定を読み込める', () => {
    // Arrange
    const config = {
      initialChips: 500,
      ante: 5,
      betStructure: 'noLimit' as const,
      aiLevel: 'cheat' as const,
    };

    // Act
    saveLastConfig(config);

    // Assert
    expect(loadLastConfig()).toEqual(config);
  });

  test('保存先のキーは poker:last-config である', () => {
    expect(LAST_CONFIG_KEY).toBe('poker:last-config');
    saveLastConfig(defaultConfig());
    expect(localStorage.getItem(LAST_CONFIG_KEY)).not.toBeNull();
  });

  test('壊れたJSONが保存されていたらデフォルトを返す', () => {
    localStorage.setItem(LAST_CONFIG_KEY, '{壊れている');
    expect(loadLastConfig()).toEqual(defaultConfig());
  });

  test('不正な値が保存されていたらデフォルトを返す', () => {
    localStorage.setItem(
      LAST_CONFIG_KEY,
      JSON.stringify({ initialChips: -1, ante: 0, betStructure: 'x', aiLevel: 'y' }),
    );
    expect(loadLastConfig()).toEqual(defaultConfig());
  });

  test('アンティが初期チップを超えていたらデフォルトを返す', () => {
    localStorage.setItem(
      LAST_CONFIG_KEY,
      JSON.stringify({
        initialChips: 100,
        ante: 500,
        betStructure: 'noLimit',
        aiLevel: 'normal',
      }),
    );
    expect(loadLastConfig()).toEqual(defaultConfig());
  });
});
