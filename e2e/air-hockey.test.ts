import { test, expect } from '@playwright/test';

test.describe('エアホッケー', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/puzzle/air-hockey');
    await page.locator('h1').waitFor({ timeout: 30000 });
  });

  // --- ページ表示 ---

  test('ページタイトルが正しい', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('エアホッケー');
  });

  test('戻るリンクが存在する', async ({ page }) => {
    await expect(page.locator('main a', { hasText: '戻る' })).toBeVisible();
  });

  test('戻るリンクでトップページに遷移できる', async ({ page }) => {
    await page.locator('main a', { hasText: '戻る' }).click();
    await expect(page.locator('h1')).toHaveText('ゲーム一覧');
  });

  // --- モード選択画面 ---

  test('モード選択画面が表示される', async ({ page }) => {
    await expect(page.locator('h2', { hasText: 'モードを選択' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'vs AI' })).toBeVisible();
    await expect(page.locator('button', { hasText: '2人対戦' })).toBeVisible();
  });

  // --- vs AI フロー ---

  test('vs AI を選択すると難易度選択画面に遷移する', async ({ page }) => {
    await page.locator('button', { hasText: 'vs AI' }).click();
    await expect(page.locator('h2', { hasText: '難易度を選択' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'イージー' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'ノーマル' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'ハード' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'カスタム' })).toBeVisible();
  });

  test('難易度選択画面で戻るとモード選択に戻る', async ({ page }) => {
    await page.locator('button', { hasText: 'vs AI' }).click();
    await page.locator('button', { hasText: '← 戻る' }).click();
    await expect(page.locator('h2', { hasText: 'モードを選択' })).toBeVisible();
  });

  test('ノーマルを選択するとゲーム画面（Canvas）が表示される', async ({ page }) => {
    await page.locator('button', { hasText: 'vs AI' }).click();
    await page.locator('button', { hasText: 'ノーマル' }).click();
    await expect(page.locator('canvas')).toBeVisible();
  });

  // --- 設定画面（カスタム） ---

  test('カスタムを選択すると設定画面に遷移する', async ({ page }) => {
    await page.locator('button', { hasText: 'vs AI' }).click();
    await page.locator('button', { hasText: 'カスタム' }).click();
    await expect(page.locator('h2', { hasText: '設定' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'ゲーム開始' })).toBeVisible();
  });

  test('設定画面にAIパラメータが表示される（vs AI）', async ({ page }) => {
    await page.locator('button', { hasText: 'vs AI' }).click();
    await page.locator('button', { hasText: 'カスタム' }).click();
    await expect(page.locator('text=AI速度')).toBeVisible();
    await expect(page.locator('text=反射予測')).toBeVisible();
  });

  test('設定画面でゲーム開始するとCanvasが表示される', async ({ page }) => {
    await page.locator('button', { hasText: 'vs AI' }).click();
    await page.locator('button', { hasText: 'カスタム' }).click();
    await page.locator('button', { hasText: 'ゲーム開始' }).click();
    await expect(page.locator('canvas')).toBeVisible();
  });

  // --- 2人対戦フロー ---

  test('2人対戦を選択すると設定画面に遷移する', async ({ page }) => {
    await page.locator('button', { hasText: '2人対戦' }).click();
    await expect(page.locator('h2', { hasText: '設定' })).toBeVisible();
  });

  test('2人対戦の設定画面にはAIパラメータが表示されない', async ({ page }) => {
    await page.locator('button', { hasText: '2人対戦' }).click();
    await expect(page.locator('text=AI速度')).not.toBeVisible();
  });

  // --- ゲーム画面 ---

  test('ゲーム画面に一時停止ボタンともどるボタンがある', async ({ page }) => {
    await page.locator('button', { hasText: 'vs AI' }).click();
    await page.locator('button', { hasText: 'ノーマル' }).click();
    await expect(page.locator('button', { hasText: '一時停止' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'もどる' })).toBeVisible();
  });

  test('ゲーム画面にスコアが表示される', async ({ page }) => {
    await page.locator('button', { hasText: 'vs AI' }).click();
    await page.locator('button', { hasText: 'ノーマル' }).click();
    await expect(page.locator('text=Player 1')).toBeVisible();
    await expect(page.locator('text=AI')).toBeVisible();
  });

  test('一時停止ボタンでポーズできる（再開ボタンが出る）', async ({ page }) => {
    await page.locator('button', { hasText: 'vs AI' }).click();
    await page.locator('button', { hasText: 'ノーマル' }).click();
    // カウントダウン（3秒）が終わり playing フェーズになるまで待つ
    await page.waitForTimeout(3500);
    await page.locator('button', { hasText: '一時停止' }).click();
    await expect(page.locator('button', { hasText: '再開' })).toBeVisible();
  });
});
