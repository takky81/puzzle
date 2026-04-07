import { test, expect, type Page, type Locator } from '@playwright/test';

/** 隣接するpathセル2つを見つけてドラッグし、両セルのLocatorを返す */
async function dragBetweenAdjacentCells(page: Page): Promise<{ from: Locator; to: Locator }> {
  const cells = page.locator('.cell:not(.wall)');
  const count = await cells.count();
  let fromCell: Locator | null = null;
  let toCell: Locator | null = null;

  for (let i = 0; i < count; i++) {
    const c = cells.nth(i);
    const row = Number(await c.getAttribute('data-row'));
    const col = Number(await c.getAttribute('data-col'));
    const right = page.locator(`[data-row="${row}"][data-col="${col + 1}"]:not(.wall)`);
    if ((await right.count()) > 0) {
      fromCell = c;
      toCell = right;
      break;
    }
  }

  expect(fromCell).not.toBeNull();
  const fromBox = await fromCell!.boundingBox();
  const toBox = await toCell!.boundingBox();
  expect(fromBox).toBeTruthy();
  expect(toBox).toBeTruthy();

  await page.mouse.move(fromBox!.x + fromBox!.width / 2, fromBox!.y + fromBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(toBox!.x + toBox!.width / 2, toBox!.y + toBox!.height / 2, { steps: 5 });
  await page.mouse.up();

  return { from: fromCell!, to: toCell! };
}

test.describe('一筆書きパズル', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/puzzle/one-stroke');
    await page.locator('.cell').first().waitFor({ timeout: 60000 });
  });

  test('ページタイトルとナビゲーションが正しい', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('一筆書き');
    const backLink = page.locator('a', { hasText: '戻る' });
    await expect(backLink).toBeVisible();
    await backLink.click();
    await expect(page.locator('h1')).toHaveText('ゲーム一覧');
  });

  test('初期状態のUI要素が正しい', async ({ page }) => {
    // グリッドサイズボタン
    await expect(page.locator('button', { hasText: '4x4' })).toBeVisible();
    await expect(page.locator('button', { hasText: '6x6' })).toBeVisible();
    await expect(page.locator('button', { hasText: '8x8' })).toBeVisible();
    // 進捗
    const progress = page.locator('text=/\\d+\\/\\d+ マス通過/');
    await expect(progress).toBeVisible();
    await expect(progress).toContainText('0/');
    // ボタンの状態
    await expect(page.locator('button', { hasText: '戻す' })).toBeDisabled();
    await expect(page.locator('button', { hasText: 'やり直し' })).toBeDisabled();
    await expect(page.locator('button', { hasText: 'リセット' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'ギブアップ' })).toBeVisible();
    // 壁とパスのセル
    const wallCells = page.locator('.cell.wall');
    const pathCells = page.locator('.cell:not(.wall)');
    expect(await pathCells.count()).toBeGreaterThan(0);
    const totalCells = await page.locator('.cell').count();
    expect((await wallCells.count()) + (await pathCells.count())).toBe(totalCells);
  });

  test('ドラッグ→戻す→やり直し→リセットの一連操作', async ({ page }) => {
    const progress = page.locator('text=/\\d+\\/\\d+ マス通過/');

    // ドラッグで進捗更新
    await dragBetweenAdjacentCells(page);
    await expect(progress).toContainText('2/');
    await expect(page.locator('button', { hasText: '戻す' })).toBeEnabled();

    // 戻す
    await page.locator('button', { hasText: '戻す' }).click();
    await expect(progress).toContainText('0/');

    // やり直し
    await expect(page.locator('button', { hasText: 'やり直し' })).toBeEnabled();
    await page.locator('button', { hasText: 'やり直し' }).click();
    await expect(progress).toContainText('2/');

    // リセット
    await page.locator('button', { hasText: 'リセット' }).click();
    await expect(progress).toContainText('0/');
    await expect(page.locator('button', { hasText: '戻す' })).toBeDisabled();
  });

  test('ギブアップで正解ルートが表示されドラッグが無効になる', async ({ page }) => {
    await expect(page.locator('.solution-edge')).toHaveCount(0);

    await page.locator('button', { hasText: 'ギブアップ' }).click();

    const solutionEdges = page.locator('.solution-edge');
    await expect(solutionEdges.first()).toBeVisible();

    // ギブアップ中はドラッグしても進捗が更新されない
    await dragBetweenAdjacentCells(page);
    const progress = page.locator('text=/\\d+\\/\\d+ マス通過/');
    await expect(progress).toContainText('0/');
  });

  test('グリッドサイズを変更するとステージが再生成される', async ({ page }) => {
    await page.locator('button', { hasText: '4x4' }).click();
    await page.locator('.cell').first().waitFor({ timeout: 60000 });
    await expect(page.locator('.cell')).toHaveCount(16);
  });
});
