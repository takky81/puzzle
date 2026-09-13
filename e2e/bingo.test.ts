import { test, expect } from '@playwright/test';

test.describe('ビンゴ', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/puzzle/bingo');
    await page.locator('h1').waitFor({ timeout: 30000 });
  });

  /** 決着して抽選ボタンが無効になるまで抽選し続ける（自動抽選より速い） */
  async function drawUntilFinished(page: import('@playwright/test').Page) {
    const button = page.getByRole('button', { name: '抽選する' });
    for (let i = 0; i < 75; i++) {
      if (await button.isDisabled()) return;
      await button.click();
    }
    throw new Error('75回引いても決着しなかった');
  }

  /** セットアップ画面からゲームを開始する */
  async function startGame(page: import('@playwright/test').Page) {
    await page.getByRole('button', { name: 'ゲーム開始' }).click();
    await expect(page.getByRole('button', { name: '抽選する' })).toBeVisible();
  }

  // --- ページ表示・遷移 ---

  test('ページタイトルが正しい', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('ビンゴ');
  });

  test('トップページから遷移できる', async ({ page }) => {
    await page.goto('/puzzle/');
    await page.click('text=ビンゴ');
    await expect(page.locator('h1')).toHaveText('ビンゴ');
  });

  test('戻るリンクでトップページに遷移できる', async ({ page }) => {
    await page.click('text=戻る');
    await expect(page.locator('h1')).toHaveText('ゲーム一覧');
  });

  // --- セットアップ画面 ---

  test('初期状態ではプレイヤーが2人表示される', async ({ page }) => {
    await expect(page.getByLabel(/の名前$/)).toHaveCount(2);
  });

  test('人数を4人にするとプレイヤー行が4行になる', async ({ page }) => {
    await page.getByRole('button', { name: '4人' }).click();

    await expect(page.getByLabel(/の名前$/)).toHaveCount(4);
  });

  test('プレイヤー種別を切り替えると未編集の名前が既定名に追従する', async ({ page }) => {
    const secondName = page.getByLabel('プレイヤー2の名前');
    await expect(secondName).toHaveValue('CPU2');

    await page
      .getByLabel('プレイヤー2の名前')
      .locator('..')
      .getByRole('button', { name: '人間' })
      .click();

    await expect(secondName).toHaveValue('プレイヤー2');
  });

  test('目標を選択できる', async ({ page }) => {
    const blackout = page.getByRole('button', { name: /ブラックアウト/ });
    await blackout.click();

    await expect(blackout).toHaveAttribute('aria-pressed', 'true');
  });

  test('ゲーム開始ボタンでゲーム画面に遷移する', async ({ page }) => {
    await startGame(page);

    await expect(page.getByTestId('card-list')).toBeVisible();
  });

  // --- ゲーム画面 ---

  test('人数分のカードが表示される', async ({ page }) => {
    await page.getByRole('button', { name: '3人' }).click();
    await startGame(page);

    await expect(page.getByTestId('player-card')).toHaveCount(3);
  });

  test('編集したプレイヤー名がカードに表示される', async ({ page }) => {
    await page.getByLabel('プレイヤー1の名前').fill('たろう');
    await startGame(page);

    await expect(page.getByTestId('player-card').first()).toContainText('たろう');
  });

  test('カードは25マスで中央がFREEである', async ({ page }) => {
    await startGame(page);

    const cells = page.getByTestId('player-card').first().locator('.cell');
    await expect(cells).toHaveCount(25);
    await expect(cells.nth(12)).toHaveText('FREE');
  });

  test('抽選ボタンを押すと番号が表示され抽選回数が増える', async ({ page }) => {
    await startGame(page);
    await expect(page.getByTestId('draw-count')).toHaveText('0');

    await page.getByRole('button', { name: '抽選する' }).click();

    await expect(page.getByTestId('draw-count')).toHaveText('1');
    await expect(page.getByTestId('current-ball')).not.toHaveText('--');
  });

  test('抽選した番号が履歴に追加される', async ({ page }) => {
    await startGame(page);
    await page.getByRole('button', { name: '抽選する' }).click();
    await page.getByRole('button', { name: '抽選する' }).click();

    await expect(page.getByTestId('draw-history').locator('li')).toHaveCount(2);
  });

  test('抽選された番号がカードでマークされる', async ({ page }) => {
    await startGame(page);

    // 20回引けばカードの24マスのうち何マスかは必ずマークされる
    // （20回に届く前に決着した場合は抽選ボタンが無効になるのでそこで止める）
    const drawButton = page.getByRole('button', { name: '抽選する' });
    for (let i = 0; i < 20; i++) {
      if (await drawButton.isDisabled()) break;
      await drawButton.click();
    }

    const marked = page.getByTestId('player-card').first().locator('.cell.marked');
    expect(await marked.count()).toBeGreaterThan(1); // FREE の1マスより多い
  });

  test('すべて表示で1〜75の番号一覧が開閉できる', async ({ page }) => {
    await startGame(page);

    await page.getByRole('button', { name: 'すべて表示' }).click();
    await expect(page.getByTestId('all-numbers').locator('li')).toHaveCount(75);

    await page.getByRole('button', { name: '一覧を閉じる' }).click();
    await expect(page.getByTestId('all-numbers')).toHaveCount(0);
  });

  test('自動抽選トグルで抽選が進み、もう一度押すと止まる', async ({ page }) => {
    await page.getByLabel('自動抽選の間隔').fill('500');
    await startGame(page);

    await page.getByRole('button', { name: '自動' }).click();
    await expect(page.getByTestId('draw-count')).not.toHaveText('0', { timeout: 5000 });

    await page.getByRole('button', { name: '自動' }).click();
    const stopped = await page.getByTestId('draw-count').textContent();
    await page.waitForTimeout(1500);

    await expect(page.getByTestId('draw-count')).toHaveText(stopped ?? '');
  });

  test('設定を変えるボタンでセットアップ画面に戻る', async ({ page }) => {
    await startGame(page);

    await page.getByRole('button', { name: '設定を変える' }).click();

    await expect(page.getByRole('button', { name: 'ゲーム開始' })).toBeVisible();
  });

  // --- 結果通知（トースト） ---

  test('決着すると結果トーストが表示され、盤面が隠れない', async ({ page }) => {
    await startGame(page);

    await drawUntilFinished(page);

    await expect(page.getByTestId('result-toast')).toBeVisible();
    await expect(page.getByTestId('result-title')).toContainText('勝ち！');
    // トーストが出てもカードは見えたまま
    await expect(page.getByTestId('player-card').first()).toBeVisible();
  });

  test('結果トーストを閉じられる', async ({ page }) => {
    await startGame(page);
    await drawUntilFinished(page);

    await page.getByRole('button', { name: '結果を閉じる' }).click();

    await expect(page.getByTestId('result-toast')).toHaveCount(0);
  });

  test('決着した順に順位バッジが表示される', async ({ page }) => {
    await startGame(page);
    await drawUntilFinished(page);

    await expect(page.getByTestId('rank-badge').first()).toContainText('1位');
  });

  test('このまま続けるで抽選を再開でき、全員達成すると最終結果になる', async ({ page }) => {
    await startGame(page);
    await drawUntilFinished(page);
    const decidedAt = Number(await page.getByTestId('draw-count').textContent());

    await page.getByRole('button', { name: 'このまま続ける' }).click();
    await expect(page.getByTestId('result-toast')).toHaveCount(0);
    await drawUntilFinished(page);

    await expect(page.getByTestId('result-title')).toContainText('全員が達成しました');
    await expect(page.getByRole('button', { name: 'このまま続ける' })).toHaveCount(0);
    await expect(page.getByTestId('rank-badge')).toHaveCount(2);
    expect(Number(await page.getByTestId('draw-count').textContent())).toBeGreaterThan(decidedAt);
  });

  test('もう一度で再戦できる', async ({ page }) => {
    await startGame(page);
    await drawUntilFinished(page);

    await page.getByRole('button', { name: 'もう一度' }).click();

    await expect(page.getByTestId('result-toast')).toHaveCount(0);
    await expect(page.getByTestId('draw-count')).toHaveText('0');
    await expect(page.getByTestId('rank-badge')).toHaveCount(0);
  });
});
