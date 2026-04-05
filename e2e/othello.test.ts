import { test, expect } from '@playwright/test';

test.describe('オセロ', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/puzzle/othello');
    await page.locator('h1').waitFor({ timeout: 30000 });
  });

  // --- ページ表示 ---

  test('ページタイトルが正しい', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('オセロ');
  });

  test('戻るリンクが存在する', async ({ page }) => {
    const backLink = page.locator('a', { hasText: '戻る' });
    await expect(backLink).toBeVisible();
  });

  test('戻るリンクでトップページに遷移できる', async ({ page }) => {
    await page.locator('a', { hasText: '戻る' }).click();
    await expect(page.locator('h1')).toHaveText('ゲーム一覧');
  });

  // --- ボード表示 ---

  test('8x8のボードが表示される', async ({ page }) => {
    const cells = page.locator('.cell');
    await expect(cells).toHaveCount(64);
  });

  test('初期配置で石が4つ表示される', async ({ page }) => {
    const discs = page.locator('.disc');
    await expect(discs).toHaveCount(4);
  });

  // --- スコア・ターン表示 ---

  test('スコアが表示される', async ({ page }) => {
    await expect(page.getByText('2', { exact: true }).first()).toBeVisible();
  });

  test('ターン表示が「黒の番」である', async ({ page }) => {
    await expect(page.getByText('黒の番')).toBeVisible();
  });

  // --- 石を置く操作 ---

  test('合法手の位置にヒントが表示される', async ({ page }) => {
    const hints = page.locator('.hint');
    await expect(hints).toHaveCount(4);
  });

  test('ヒントのセルをクリックすると石が置かれる', async ({ page }) => {
    const hint = page.locator('.hint').first();
    const cell = hint.locator('..');
    await cell.click();

    // 石が増える（4 → 初期4 + 配置1 - 裏返り分は色が変わるだけ）
    const discs = page.locator('.disc');
    const count = await discs.count();
    expect(count).toBe(5);
  });

  test('石を置くとターンが切り替わる', async ({ page }) => {
    const hint = page.locator('.hint').first();
    await hint.locator('..').click();

    await expect(page.getByText('白の番')).toBeVisible();
  });

  test('石を置くとスコアが更新される', async ({ page }) => {
    const hint = page.locator('.hint').first();
    await hint.locator('..').click();

    // 黒が1つ置いて1つ裏返す → 黒4, 白1
    // スコア表示に4が含まれることを確認
    const scoreTexts = page.locator('.text-\\[var\\(--c-score-text\\)\\]');
    const scores: string[] = [];
    for (let i = 0; i < (await scoreTexts.count()); i++) {
      scores.push((await scoreTexts.nth(i).textContent()) ?? '');
    }
    expect(scores).toContain('4');
    expect(scores).toContain('1');
  });

  // --- 直前の手のマーカー ---

  test('石を置くと直前の手にマーカーが表示される', async ({ page }) => {
    const hint = page.locator('.hint').first();
    await hint.locator('..').click();

    const lastMove = page.locator('.cell.last-move');
    await expect(lastMove).toHaveCount(1);
  });

  // --- モード切替 ---

  test('モード切替ボタンが表示される', async ({ page }) => {
    await expect(page.locator('button', { hasText: '対人戦' })).toBeVisible();
    await expect(page.locator('button', { hasText: '対AI' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'AI観戦' })).toBeVisible();
  });

  test('対AIモードで色選択と難易度選択が表示される', async ({ page }) => {
    await page.locator('button', { hasText: '対AI' }).click();

    await expect(page.getByText('あなたの色:')).toBeVisible();
    await expect(page.getByText('AI難易度:')).toBeVisible();
    await expect(page.locator('button', { hasText: '弱い' })).toBeVisible();
    await expect(page.locator('button', { hasText: '普通' })).toBeVisible();
    await expect(page.locator('button', { hasText: '強い' })).toBeVisible();
  });

  test('AI観戦モードで黒AIと白AIの難易度と速度が設定できる', async ({ page }) => {
    await page.locator('button', { hasText: 'AI観戦' }).click();

    await expect(page.getByText('黒AI:')).toBeVisible();
    await expect(page.getByText('白AI:')).toBeVisible();
    await expect(page.getByText('速度:')).toBeVisible();
    await expect(page.locator('input[type="range"]')).toBeVisible();
  });

  // --- リセットボタン ---

  test('リセットボタンでゲームが初期状態に戻る', async ({ page }) => {
    // 1手打つ
    const hint = page.locator('.hint').first();
    await hint.locator('..').click();
    await expect(page.locator('.disc')).toHaveCount(5);

    // リセット
    await page.locator('button', { hasText: 'リセット' }).click();

    await expect(page.locator('.disc')).toHaveCount(4);
    await expect(page.getByText('黒の番')).toBeVisible();
  });

  // --- 対AIモードの操作 ---

  test('対AIモードで石を置くとAIが応手する', async ({ page }) => {
    await page.locator('button', { hasText: '対AI' }).click();
    // AI難易度を「弱い」にして速度安定
    await page.locator('button', { hasText: '弱い' }).click();

    await page.locator('.hint').first().locator('..').click();

    // AI思考中表示 or AIが応手して石が増える
    await expect(page.locator('.disc')).toHaveCount(6, { timeout: 5000 });
  });

  test('対AIモードで白を選択するとAIが先手で打つ', async ({ page }) => {
    await page.locator('button', { hasText: '対AI' }).click();
    await page.locator('button', { hasText: '弱い' }).click();
    // 白を選択
    await page.locator('button', { hasText: '白' }).click();

    // AIが先手（黒）で1手打つ → 石が5個になる
    await expect(page.locator('.disc')).toHaveCount(5, { timeout: 5000 });
  });

  test('AI観戦モードでAIが自動で対局する', async ({ page }) => {
    await page.locator('button', { hasText: 'AI観戦' }).click();

    // AIが自動で何手か打つ → 石が増える
    await expect(async () => {
      const count = await page.locator('.disc').count();
      expect(count).toBeGreaterThan(4);
    }).toPass({ timeout: 10000 });
  });

  test('合法手でないセルをクリックしても石が置かれない', async ({ page }) => {
    // 初期盤面の(0,0)は合法手ではない
    const firstCell = page.locator('.cell').first();
    await firstCell.click();

    // 石の数は変わらない（4のまま）
    await expect(page.locator('.disc')).toHaveCount(4);
    // ターンも変わらない
    await expect(page.getByText('黒の番')).toBeVisible();
  });

  test('対AIモードでゲームが最後まで正常に完了する', async ({ page }) => {
    await page.locator('button', { hasText: '対AI' }).click();
    await page.locator('button', { hasText: '弱い' }).click();

    // ゲーム終了まで繰り返す（パスが発生してもゲームが固まらないことを検証）
    const maxAttempts = 120;
    for (let i = 0; i < maxAttempts; i++) {
      // ゲーム終了チェック
      const gameOverMsg = page.locator('.text-primary', { hasText: /の勝ち|引き分け/ });
      if (await gameOverMsg.isVisible().catch(() => false)) break;

      // プレイヤーのターンでヒントがあればクリック
      const hints = page.locator('.hint');
      if ((await hints.count()) > 0) {
        await hints.first().locator('..').click();
      }

      // AI応手を待つ
      await page.waitForTimeout(500);
    }

    // ゲームが正常に終了していること
    await expect(page.locator('.text-primary', { hasText: /の勝ち|引き分け/ })).toBeVisible({
      timeout: 10000,
    });
  });

  test('対AIモードで強いを選ぶと思考時間設定が表示される', async ({ page }) => {
    await page.locator('button', { hasText: '対AI' }).click();
    await expect(page.getByText('思考時間:')).not.toBeVisible();

    await page.locator('button', { hasText: '強い' }).click();
    await expect(page.getByText('思考時間:')).toBeVisible();
    await expect(page.getByText('3秒')).toBeVisible();
  });

  test('AI観戦モードで強いを選ぶと思考時間設定が表示される', async ({ page }) => {
    await page.locator('button', { hasText: 'AI観戦' }).click();
    await expect(page.getByText('思考時間:')).not.toBeVisible();

    // 黒AIを強いに変更
    const hardButtons = page.locator('button', { hasText: '強い' });
    await hardButtons.first().click();
    await expect(page.getByText('思考時間:')).toBeVisible();
  });

  test('対AIモードでAI思考中にローディング表示が出る', async ({ page }) => {
    await page.locator('button', { hasText: '対AI' }).click();
    await page.locator('button', { hasText: '強い' }).click();

    await page.locator('.hint').first().locator('..').click();

    // AI思考中テキストが表示される
    await expect(page.getByText('AI思考中...')).toBeVisible({ timeout: 3000 });
  });
});
