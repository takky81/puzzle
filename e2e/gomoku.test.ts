import { test, expect } from '@playwright/test';

test.describe('五目並べ', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/puzzle/gomoku');
  });

  test('ページタイトルが正しい', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('五目並べ');
  });

  test('戻るリンクが存在する', async ({ page }) => {
    const backLink = page.locator('a', { hasText: '戻る' });
    await expect(backLink).toBeVisible();
  });

  test('15x15のボードが表示される', async ({ page }) => {
    const cells = page.locator('.cell');
    await expect(cells).toHaveCount(225);
  });

  test('ターン表示が「黒の番」である', async ({ page }) => {
    await expect(page.locator('text=黒の番')).toBeVisible();
  });

  test('セルをクリックすると石が置かれる', async ({ page }) => {
    const cell = page.locator('.cell').nth(112); // 中央(7,7)
    await cell.click();
    const stone = cell.locator('.stone');
    await expect(stone).toBeVisible();
  });

  test('石を置くとターンが切り替わる', async ({ page }) => {
    await page.locator('.cell').nth(112).click();
    await expect(page.locator('text=白の番')).toBeVisible();
  });

  test('禁じ手チェックボックスが存在する', async ({ page }) => {
    const checkbox = page.locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();
    await expect(page.locator('text=禁じ手ルール')).toBeVisible();
  });

  test('モード切替ボタンが表示される', async ({ page }) => {
    await expect(page.locator('button', { hasText: '対人戦' })).toBeVisible();
    await expect(page.locator('button', { hasText: '対AI' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'AI観戦' })).toBeVisible();
  });

  test('対AIモードで色選択と難易度選択が表示される', async ({ page }) => {
    await page.locator('button', { hasText: '対AI' }).click();
    await expect(page.locator('text=あなたの色:')).toBeVisible();
    await expect(page.locator('text=AI難易度:')).toBeVisible();
  });

  test('リセットボタンでゲームが初期状態に戻る', async ({ page }) => {
    await page.locator('.cell').nth(112).click();
    await page.locator('button', { hasText: 'リセット' }).click();
    // 石が消えている
    const stones = page.locator('.stone');
    await expect(stones).toHaveCount(0);
    await expect(page.locator('text=黒の番')).toBeVisible();
  });

  test('対AIモードで石を置くとAIが応手する', async ({ page }) => {
    await page.locator('button', { hasText: '対AI' }).click();
    // 弱いAIを選択（高速応答）
    await page.locator('button', { hasText: '弱い' }).click();
    await page.locator('.cell').nth(112).click();
    // AIが応手するのを待つ
    await expect(page.locator('.stone')).toHaveCount(2, { timeout: 5000 });
  });

  test('戻るリンクでトップページに遷移できる', async ({ page }) => {
    await page.locator('a', { hasText: '戻る' }).click();
    await expect(page.locator('h1')).toHaveText('ゲーム一覧');
  });
});
