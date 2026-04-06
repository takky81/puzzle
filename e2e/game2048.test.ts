import { test, expect } from '@playwright/test';

test.describe('2048', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/puzzle/game2048');
    await page.locator('h1').waitFor({ timeout: 30000 });
  });

  // --- ページ表示 ---

  test('ページタイトルが正しい', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('2048');
  });

  test('戻るリンクが存在する', async ({ page }) => {
    const backLink = page.locator('a', { hasText: '戻る' });
    await expect(backLink).toBeVisible();
  });

  test('戻るリンクでトップページに遷移できる', async ({ page }) => {
    await page.locator('a', { hasText: '戻る' }).click();
    await expect(page.locator('h1')).toHaveText('ゲーム一覧');
  });

  // --- グリッド表示 ---

  test('4x4のグリッドが表示される', async ({ page }) => {
    const cells = page.locator('.cell');
    await expect(cells).toHaveCount(16);
  });

  test('初期状態でタイルが2つ表示される', async ({ page }) => {
    const cells = page.locator('.cell');
    let nonEmptyCount = 0;
    for (let i = 0; i < 16; i++) {
      const text = await cells.nth(i).textContent();
      if (text && text.trim() !== '') nonEmptyCount++;
    }
    expect(nonEmptyCount).toBe(2);
  });

  // --- スコア表示 ---

  test('スコアが0で表示される', async ({ page }) => {
    const scoreValue = page.locator('.score-value').first();
    await expect(scoreValue).toHaveText('0');
  });

  test('ベストスコアが表示される', async ({ page }) => {
    await expect(page.getByText('BEST')).toBeVisible();
  });

  // --- 難易度選択 ---

  test('難易度ボタンが3つ表示される', async ({ page }) => {
    await expect(page.locator('button', { hasText: 'Easy' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Random' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Hard' })).toBeVisible();
  });

  test('デフォルト難易度はRandomがアクティブ', async ({ page }) => {
    const randomBtn = page.locator('button', { hasText: 'Random' });
    await expect(randomBtn).toHaveClass(/active/);
  });

  test('難易度を変更できる', async ({ page }) => {
    await page.locator('button', { hasText: 'Easy' }).click();
    await expect(page.locator('button', { hasText: 'Easy' })).toHaveClass(/active/);
    await expect(page.locator('button', { hasText: 'Random' })).not.toHaveClass(/active/);
  });

  // --- キー操作 ---

  test('矢印キーでタイルがスライドする', async ({ page }) => {
    // 初期タイル位置を記録
    const cellsBefore: string[] = [];
    const cells = page.locator('.cell');
    for (let i = 0; i < 16; i++) {
      cellsBefore.push((await cells.nth(i).textContent()) ?? '');
    }

    // 左矢印キーを押す
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(200);

    // タイルが移動したか、新タイルが出現したか確認
    const cellsAfter: string[] = [];
    for (let i = 0; i < 16; i++) {
      cellsAfter.push((await cells.nth(i).textContent()) ?? '');
    }

    // ボードが変化しているか（スライドが成功したか、何かしら変わっている）
    const changed = cellsBefore.some((val, i) => val !== cellsAfter[i]);
    // タイルが動けなかった場合もある（左端に寄っていた場合）
    // 4方向全部試す
    if (!changed) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(200);
    }

    const cellsFinal: string[] = [];
    for (let i = 0; i < 16; i++) {
      cellsFinal.push((await cells.nth(i).textContent()) ?? '');
    }
    const finalChanged = cellsBefore.some((val, i) => val !== cellsFinal[i]);
    expect(finalChanged).toBe(true);
  });

  test('WASDキーでもスライドできる', async ({ page }) => {
    const cells = page.locator('.cell');
    const cellsBefore: string[] = [];
    for (let i = 0; i < 16; i++) {
      cellsBefore.push((await cells.nth(i).textContent()) ?? '');
    }

    // 複数方向試す
    await page.keyboard.press('a');
    await page.waitForTimeout(100);
    await page.keyboard.press('d');
    await page.waitForTimeout(100);

    const cellsAfter: string[] = [];
    for (let i = 0; i < 16; i++) {
      cellsAfter.push((await cells.nth(i).textContent()) ?? '');
    }
    const changed = cellsBefore.some((val, i) => val !== cellsAfter[i]);
    expect(changed).toBe(true);
  });

  // --- ボタン操作 ---

  test('New Gameボタンでゲームがリセットされる', async ({ page }) => {
    // 1手打つ
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(200);

    // リセット
    await page.locator('button', { hasText: 'New Game' }).click();

    // スコアが0に戻る
    const scoreValue = page.locator('.score-value').first();
    await expect(scoreValue).toHaveText('0');

    // タイルが2つに戻る
    const cells = page.locator('.cell');
    let nonEmptyCount = 0;
    for (let i = 0; i < 16; i++) {
      const text = await cells.nth(i).textContent();
      if (text && text.trim() !== '') nonEmptyCount++;
    }
    expect(nonEmptyCount).toBe(2);
  });

  test('Undo/Redoボタンが表示される', async ({ page }) => {
    await expect(page.locator('button', { hasText: 'Undo' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Redo' })).toBeVisible();
  });

  test('初期状態でUndoボタンが無効', async ({ page }) => {
    const undoBtn = page.locator('button', { hasText: 'Undo' });
    await expect(undoBtn).toBeDisabled();
  });

  test('初期状態でRedoボタンが無効', async ({ page }) => {
    const redoBtn = page.locator('button', { hasText: 'Redo' });
    await expect(redoBtn).toBeDisabled();
  });

  test('1手打つとUndoボタンが有効になる', async ({ page }) => {
    // 複数方向試して確実に動かす
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);

    const undoBtn = page.locator('button', { hasText: 'Undo' });
    await expect(undoBtn).toBeEnabled();
  });

  test('Undoで1手前に戻りRedoが有効になる', async ({ page }) => {
    // 1手打つ
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(100);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);

    // Undo
    await page.locator('button', { hasText: 'Undo' }).click();

    // Redoが有効になる
    const redoBtn = page.locator('button', { hasText: 'Redo' });
    await expect(redoBtn).toBeEnabled();
  });

  // --- メッセージ表示 ---

  test('初期状態でゲームメッセージが表示されない', async ({ page }) => {
    const overlay = page.locator('.overlay');
    await expect(overlay).toHaveCount(0);
  });

  // --- ベストスコア永続化 ---

  test('ベストスコアがリロード後も保持される', async ({ page }) => {
    // 何手か打ってスコアを上げる
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(50);
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(50);
    }

    // ベストスコアを記録
    const bestScoreEl = page.locator('.score-box').nth(1).locator('.score-value');
    const bestScore = await bestScoreEl.textContent();

    // ページをリロード
    await page.reload();
    await page.locator('h1').waitFor({ timeout: 30000 });

    // ベストスコアが保持されている
    const bestScoreAfter = await page
      .locator('.score-box')
      .nth(1)
      .locator('.score-value')
      .textContent();
    expect(bestScoreAfter).toBe(bestScore);
  });

  // --- New Gameの状態維持 ---

  test('New Gameで難易度が維持される', async ({ page }) => {
    // 難易度をHardに変更
    await page.locator('button', { hasText: 'Hard' }).click();
    await expect(page.locator('button', { hasText: 'Hard' })).toHaveClass(/active/);

    // New Game
    await page.locator('button', { hasText: 'New Game' }).click();

    // Hardのまま
    await expect(page.locator('button', { hasText: 'Hard' })).toHaveClass(/active/);
  });

  test('New Gameでベストスコアが維持される', async ({ page }) => {
    // 何手か打ってスコアを上げる
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(50);
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(50);
    }

    // ベストスコアを記録
    const bestScoreEl = page.locator('.score-box').nth(1).locator('.score-value');
    const bestScore = await bestScoreEl.textContent();

    // New Game
    await page.locator('button', { hasText: 'New Game' }).click();

    // ベストスコアが維持されている
    const bestScoreAfter = await bestScoreEl.textContent();
    expect(bestScoreAfter).toBe(bestScore);
  });

  // --- 難易度変更後のボード継続 ---

  test('難易度変更後もボードがそのまま継続する', async ({ page }) => {
    // 1手打つ
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(200);

    // セルの状態を記録
    const cells = page.locator('.cell');
    const cellsBefore: string[] = [];
    for (let i = 0; i < 16; i++) {
      cellsBefore.push((await cells.nth(i).textContent()) ?? '');
    }

    // 難易度変更
    await page.locator('button', { hasText: 'Hard' }).click();

    // セルが変化していない
    for (let i = 0; i < 16; i++) {
      const text = (await cells.nth(i).textContent()) ?? '';
      expect(text).toBe(cellsBefore[i]);
    }
  });
});
