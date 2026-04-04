import { test, expect, type Page, type Locator } from '@playwright/test';

/** 隣接するpathセル2つを見つけてドラッグし、両セルのLocatorを返す */
async function dragBetweenAdjacentCells(page: Page): Promise<{ from: Locator; to: Locator }> {
  const cells = page.locator('.cell:not(.wall)');
  const firstCell = cells.first();
  const firstBox = await firstCell.boundingBox();
  expect(firstBox).toBeTruthy();

  const row = Number(await firstCell.getAttribute('data-row'));
  const col = Number(await firstCell.getAttribute('data-col'));
  const rightCell = page.locator(`[data-row="${row}"][data-col="${col + 1}"]:not(.wall)`);
  expect(await rightCell.count()).toBeGreaterThan(0);
  const rightBox = await rightCell.boundingBox();
  expect(rightBox).toBeTruthy();

  await page.mouse.move(firstBox!.x + firstBox!.width / 2, firstBox!.y + firstBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(rightBox!.x + rightBox!.width / 2, rightBox!.y + rightBox!.height / 2, {
    steps: 5,
  });
  await page.mouse.up();

  return { from: firstCell, to: rightCell };
}

test.describe('一筆書きパズル', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/puzzle/one-stroke');
    await page.locator('.cell').first().waitFor({ timeout: 30000 });
  });

  test('ページタイトルが正しい', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('一筆書き');
  });

  test('戻るリンクが存在する', async ({ page }) => {
    const backLink = page.locator('a', { hasText: '戻る' });
    await expect(backLink).toBeVisible();
  });

  test('グリッドサイズボタンが表示される', async ({ page }) => {
    await expect(page.locator('button', { hasText: '4x4' })).toBeVisible();
    await expect(page.locator('button', { hasText: '6x6' })).toBeVisible();
    await expect(page.locator('button', { hasText: '8x8' })).toBeVisible();
  });

  test('進捗表示が初期状態で0マス通過', async ({ page }) => {
    const progress = page.locator('text=/\\d+\\/\\d+ マス通過/');
    await expect(progress).toBeVisible();
    await expect(progress).toContainText('0/');
  });

  test('ボタンが全て表示される', async ({ page }) => {
    await expect(page.locator('button', { hasText: '戻す' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'やり直し' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'リセット' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'ギブアップ' })).toBeVisible();
  });

  test('初期状態で戻すボタンが無効', async ({ page }) => {
    await expect(page.locator('button', { hasText: '戻す' })).toBeDisabled();
  });

  test('初期状態でやり直しボタンが無効', async ({ page }) => {
    await expect(page.locator('button', { hasText: 'やり直し' })).toBeDisabled();
  });

  test('ドラッグでエッジを描画すると進捗が更新される', async ({ page }) => {
    await dragBetweenAdjacentCells(page);

    const progress = page.locator('text=/\\d+\\/\\d+ マス通過/');
    await expect(progress).toContainText('2/');
  });

  test('ドラッグ後に戻すボタンが有効になる', async ({ page }) => {
    await dragBetweenAdjacentCells(page);

    await expect(page.locator('button', { hasText: '戻す' })).toBeEnabled();
  });

  test('戻すボタンでストロークを取り消せる', async ({ page }) => {
    await dragBetweenAdjacentCells(page);

    await page.locator('button', { hasText: '戻す' }).click();

    const progress = page.locator('text=/\\d+\\/\\d+ マス通過/');
    await expect(progress).toContainText('0/');
  });

  test('戻す→やり直しでストロークを復元できる', async ({ page }) => {
    await dragBetweenAdjacentCells(page);

    await page.locator('button', { hasText: '戻す' }).click();
    await expect(page.locator('button', { hasText: 'やり直し' })).toBeEnabled();
    await page.locator('button', { hasText: 'やり直し' }).click();

    const progress = page.locator('text=/\\d+\\/\\d+ マス通過/');
    await expect(progress).toContainText('2/');
  });

  test('リセットで初期状態に戻る', async ({ page }) => {
    await dragBetweenAdjacentCells(page);

    await page.locator('button', { hasText: 'リセット' }).click();

    const progress = page.locator('text=/\\d+\\/\\d+ マス通過/');
    await expect(progress).toContainText('0/');
    await expect(page.locator('button', { hasText: '戻す' })).toBeDisabled();
  });

  test('ギブアップで正解ルートが表示される', async ({ page }) => {
    await expect(page.locator('.solution-edge')).toHaveCount(0);

    await page.locator('button', { hasText: 'ギブアップ' }).click();

    const solutionEdges = page.locator('.solution-edge');
    await expect(solutionEdges.first()).toBeVisible();
  });

  test('グリッドサイズを変更するとステージが再生成される', async ({ page }) => {
    await page.locator('button', { hasText: '4x4' }).click();
    await page.locator('.cell').first().waitFor({ timeout: 30000 });

    const cells = page.locator('.cell');
    await expect(cells).toHaveCount(16);
  });

  test('壁マスがグリッドに表示される', async ({ page }) => {
    const wallCells = page.locator('.cell.wall');
    const pathCells = page.locator('.cell:not(.wall)');
    expect(await pathCells.count()).toBeGreaterThan(0);
    const totalCells = await page.locator('.cell').count();
    expect((await wallCells.count()) + (await pathCells.count())).toBe(totalCells);
  });

  test('戻るリンクでトップページに遷移できる', async ({ page }) => {
    await page.locator('a', { hasText: '戻る' }).click();
    await expect(page.locator('h1')).toHaveText('ゲーム一覧');
  });

  test('ギブアップ中にドラッグしてもエッジが追加されない', async ({ page }) => {
    await page.locator('button', { hasText: 'ギブアップ' }).click();

    await dragBetweenAdjacentCells(page);

    const progress = page.locator('text=/\\d+\\/\\d+ マス通過/');
    await expect(progress).toContainText('0/');
  });

  test('次のステージボタンが表示される', async ({ page }) => {
    const nextButton = page.locator('button', { hasText: /次のステージ/ });
    await expect(nextButton).toBeVisible({ timeout: 60000 });
  });

  test('ドラッグで通過したマスにvisitedクラスが付与される', async ({ page }) => {
    const cells = page.locator('.cell:not(.wall)');
    const firstCell = cells.first();
    await expect(firstCell).not.toHaveClass(/visited/);

    const { from, to } = await dragBetweenAdjacentCells(page);

    await expect(from).toHaveClass(/visited/);
    await expect(to).toHaveClass(/visited/);
  });

  test('3マス以上の連続ドラッグでエッジが複数追加される', async ({ page }) => {
    const cells = page.locator('.cell:not(.wall)');
    const firstCell = cells.first();
    const firstBox = await firstCell.boundingBox();
    expect(firstBox).toBeTruthy();

    const row = Number(await firstCell.getAttribute('data-row'));
    const col = Number(await firstCell.getAttribute('data-col'));

    const cell2 = page.locator(`[data-row="${row}"][data-col="${col + 1}"]:not(.wall)`);
    const cell3 = page.locator(`[data-row="${row}"][data-col="${col + 2}"]:not(.wall)`);
    expect(await cell2.count()).toBeGreaterThan(0);
    expect(await cell3.count()).toBeGreaterThan(0);
    const box2 = await cell2.boundingBox();
    const box3 = await cell3.boundingBox();
    expect(box2).toBeTruthy();
    expect(box3).toBeTruthy();

    await page.mouse.move(firstBox!.x + firstBox!.width / 2, firstBox!.y + firstBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box2!.x + box2!.width / 2, box2!.y + box2!.height / 2, { steps: 5 });
    await page.mouse.move(box3!.x + box3!.width / 2, box3!.y + box3!.height / 2, { steps: 5 });
    await page.mouse.up();

    const progress = page.locator('text=/\\d+\\/\\d+ マス通過/');
    await expect(progress).toContainText('3/');
  });
});
