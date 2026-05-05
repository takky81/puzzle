import { test, expect, type Page, type Locator } from '@playwright/test';

async function dragFromCell(page: Page, from: Locator, via: Locator[]): Promise<void> {
  const fromBox = await from.boundingBox();
  expect(fromBox).toBeTruthy();
  await page.mouse.move(fromBox!.x + fromBox!.width / 2, fromBox!.y + fromBox!.height / 2);
  await page.mouse.down();
  for (const cell of via) {
    const box = await cell.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2, { steps: 5 });
  }
  await page.mouse.up();
}

async function findAdjacentCell(page: Page, row: number, col: number): Promise<Locator> {
  for (const [dr, dc] of [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
  ]) {
    const cell = page.locator(`[data-row="${row + dr}"][data-col="${col + dc}"]`);
    if ((await cell.count()) > 0) return cell;
  }
  throw new Error(`no adjacent cell for (${row},${col})`);
}

async function dragFromFirstNumber(page: Page): Promise<void> {
  const firstNumber = page.locator('.cell.number-cell').first();
  const row = Number(await firstNumber.getAttribute('data-row'));
  const col = Number(await firstNumber.getAttribute('data-col'));
  const target = await findAdjacentCell(page, row, col);
  await dragFromCell(page, firstNumber, [target]);
}

async function gotoFirstPuzzle(page: Page): Promise<void> {
  await page.goto('/puzzle/numberlink');
  const firstLink = page.locator('a[href*="/numberlink/play"]').first();
  await firstLink.waitFor({ timeout: 60000 });
  await firstLink.click();
  await page.locator('.cell').first().waitFor({ timeout: 60000 });
}

test.describe('ナンバーリンクパズル', () => {
  test.describe('問題一覧画面', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/puzzle/numberlink');
      await page.locator('a[href*="/numberlink/play"]').first().waitFor({ timeout: 60000 });
    });

    test('ページタイトルとナビゲーションが正しい', async ({ page }) => {
      await expect(page.locator('h1')).toHaveText('ナンバーリンク');
      const backLink = page.locator('a', { hasText: '戻る' });
      await expect(backLink).toBeVisible();
      await backLink.click();
      await expect(page.locator('h1')).toHaveText('ゲーム一覧');
    });

    test('初期状態のUI要素が正しい', async ({ page }) => {
      await expect(page.locator('button', { hasText: '4×4' })).toBeVisible();
      await expect(page.locator('button', { hasText: '5×5' })).toBeVisible();
      await expect(page.locator('button', { hasText: '6×6' })).toBeVisible();
      const puzzleLinks = page.locator('a[href*="/numberlink/play"]');
      expect(await puzzleLinks.count()).toBeGreaterThan(0);
      await expect(page.locator('text=/\\d+ 問/')).toBeVisible();
    });

    test('サイズ切替で問題一覧が変わる', async ({ page }) => {
      const count4 = await page.locator('a[href*="/numberlink/play"]').count();
      await page.click('button:has-text("5×5")');
      await page.locator('a[href*="/numberlink/play"]').first().waitFor({ timeout: 10000 });
      const count5 = await page.locator('a[href*="/numberlink/play"]').count();
      expect(count5).toBeGreaterThan(count4);
    });

    test('問題リンクをクリックするとゲーム画面に遷移する', async ({ page }) => {
      await page.locator('a[href*="/numberlink/play"]').first().click();
      await page.locator('.cell').first().waitFor({ timeout: 60000 });
      await expect(page.locator('.cell.number-cell').first()).toBeVisible();
    });
  });

  test.describe('ゲーム画面', () => {
    test.beforeEach(async ({ page }) => {
      await gotoFirstPuzzle(page);
    });

    test('ページタイトルとナビゲーションが正しい', async ({ page }) => {
      await expect(page.locator('h1')).toHaveText('ナンバーリンク');
      await expect(page.locator('header a', { hasText: '戻る' })).toBeVisible();
    });

    test('初期状態のUI要素が正しい', async ({ page }) => {
      const progress = page.locator('text=/\\d+\\/\\d+ ペア接続/');
      await expect(progress).toBeVisible();
      await expect(progress).toContainText('0/');
      await expect(page.locator('button', { hasText: '戻す' })).toBeDisabled();
      await expect(page.locator('button', { hasText: 'やり直し' })).toBeDisabled();
      await expect(page.locator('button', { hasText: 'リセット' })).toBeVisible();
      await expect(page.locator('button', { hasText: 'ギブアップ' })).toBeVisible();
      await expect(page.locator('a', { hasText: '一覧に戻る' })).toBeVisible();
      expect(await page.locator('.cell.number-cell').count()).toBeGreaterThan(0);
    });

    test('番号マスからドラッグして線を引くと戻すボタンが有効化する', async ({ page }) => {
      await dragFromFirstNumber(page);
      await expect(page.locator('button', { hasText: '戻す' })).toBeEnabled();
    });

    test('ギブアップで正解の線が表示される', async ({ page }) => {
      await expect(page.locator('.solution-edge').first()).not.toBeVisible();
      await page.click('button:has-text("ギブアップ")');
      await expect(page.locator('.solution-edge').first()).toBeVisible();
    });

    test('リセットで線と戻す履歴がクリアされる', async ({ page }) => {
      await dragFromFirstNumber(page);
      await expect(page.locator('button', { hasText: '戻す' })).toBeEnabled();
      await page.click('button:has-text("リセット")');
      await expect(page.locator('button', { hasText: '戻す' })).toBeDisabled();
    });

    test('一覧に戻るで問題一覧画面に遷移する', async ({ page }) => {
      await page.locator('a', { hasText: '一覧に戻る' }).first().click();
      await expect(page.locator('h1')).toHaveText('ナンバーリンク');
      await expect(page.locator('a[href*="/numberlink/play"]').first()).toBeVisible();
    });
  });
});
