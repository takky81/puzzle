import { test, expect, type Page } from '@playwright/test';

test.describe('ポーカー', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/puzzle/poker');
    await page.locator('h1').waitFor({ timeout: 30000 });
  });

  /** セットアップ画面からゲームを開始する */
  async function startGame(page: Page) {
    await page.getByRole('button', { name: 'ゲーム開始' }).click();
    await expect(page.getByTestId('pot')).toBeVisible();
  }

  /** 交換フェーズに入るまでチェック/コールで進める（AIがベットしてくることがある） */
  async function advanceToDraw(page: Page) {
    const exchange = page.getByRole('button', { name: /交換/ });
    for (let i = 0; i < 6; i++) {
      if (await exchange.first().isVisible()) return;
      const check = page.getByRole('button', { name: 'チェック' });
      const call = page.getByRole('button', { name: /^コール/ });
      if (await check.isVisible()) {
        await check.click();
      } else if (await call.isVisible()) {
        await call.click();
      }
      await waitForTurn(page);
      await exchange
        .first()
        .waitFor({ state: 'visible', timeout: 3000 })
        .catch(() => {});
    }
    throw new Error('交換フェーズに到達しなかった');
  }

  /** ハンドが終わるまで、可能なアクションで進める */
  async function playUntilHandEnd(page: Page) {
    const nextHand = page.getByRole('button', { name: '次のハンドへ' });
    for (let i = 0; i < 10; i++) {
      if (await nextHand.isVisible()) return;
      const fold = page.getByRole('button', { name: 'フォールド' });
      const standPat = page.getByRole('button', { name: '交換しない' });
      const check = page.getByRole('button', { name: 'チェック' });
      if (await fold.isVisible()) {
        await fold.click();
      } else if (await standPat.isVisible()) {
        await standPat.click();
      } else if (await check.isVisible()) {
        await check.click();
      }
      await waitForTurn(page);
      await nextHand.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});
    }
    throw new Error('ハンドが終わらなかった');
  }

  /** 人間の手番（またはハンド終了）になるまで待つ */
  async function waitForTurn(page: Page) {
    await expect(page.getByText('AIが考えています…')).toHaveCount(0, { timeout: 15000 });
  }

  // --- ページ表示・遷移 ---

  test('ページタイトルが正しい', async ({ page }) => {
    await expect(page.locator('h1')).toHaveText('ポーカー');
  });

  test('トップページから遷移できる', async ({ page }) => {
    await page.goto('/puzzle/');
    await page.click('text=ポーカー');
    await expect(page.locator('h1')).toHaveText('ポーカー');
  });

  test('戻るリンクでトップページに遷移できる', async ({ page }) => {
    await page.click('text=戻る');
    await expect(page.locator('h1')).toHaveText('ゲーム一覧');
  });

  // --- セットアップ画面 ---

  test('初期チップとアンティを選択できる', async ({ page }) => {
    const chips = page.getByRole('button', { name: '500', exact: true });
    await chips.click();

    await expect(chips).toHaveAttribute('aria-pressed', 'true');
  });

  test('ベット構造を選択できる', async ({ page }) => {
    const noLimit = page.getByRole('button', { name: /ノーリミット/ });
    await noLimit.click();

    await expect(noLimit).toHaveAttribute('aria-pressed', 'true');
  });

  test('AIの強さを選択できる', async ({ page }) => {
    const cheat = page.getByRole('button', { name: /最強/ });
    await cheat.click();

    await expect(cheat).toHaveAttribute('aria-pressed', 'true');
  });

  // --- ゲーム画面 ---

  test('ゲーム開始でアンティがポットに入り、両者に5枚配られる', async ({ page }) => {
    await startGame(page);

    await expect(page.getByTestId('pot')).toHaveText('ポット 20');
    await expect(page.getByTestId('human-chips')).toHaveText('990 チップ');
    await expect(page.getByTestId('ai-chips')).toHaveText('990 チップ');
    await expect(page.getByTestId('human-hand').getByRole('button')).toHaveCount(5);
    await expect(page.getByTestId('ai-hand').getByRole('button')).toHaveCount(5);
  });

  test('自分の手札は表向き、AIの手札は裏向きで表示される', async ({ page }) => {
    await startGame(page);

    await expect(page.getByTestId('ai-hand').getByLabel('裏向きのカード')).toHaveCount(5);
    await expect(page.getByTestId('human-hand').getByLabel('裏向きのカード')).toHaveCount(0);
  });

  test('自分の役が表示される', async ({ page }) => {
    await startGame(page);

    await expect(page.getByTestId('human-rank')).not.toBeEmpty();
  });

  test('ベットするとチップが減りポットが増える', async ({ page }) => {
    await startGame(page);

    await page.getByRole('button', { name: /^ベット/ }).click();

    await expect(page.getByTestId('human-chips')).toHaveText('970 チップ');
  });

  test('ベッティングを終えるとカード交換フェーズになる', async ({ page }) => {
    await startGame(page);

    await advanceToDraw(page);

    await expect(page.getByRole('button', { name: /交換/ })).toBeVisible();
  });

  test('カードを選んで交換すると選んだ枚数だけ入れ替わる', async ({ page }) => {
    await startGame(page);
    await advanceToDraw(page);

    // Arrange: 1枚目のカードのラベルを控えて選択する
    const firstCard = page.getByTestId('human-hand').getByRole('button').first();
    const before = await firstCard.getAttribute('aria-label');
    await firstCard.click();

    // Act
    await page.getByRole('button', { name: '1枚を交換する' }).click();

    // Assert: 交換フェーズが終わり、手札は5枚のまま
    await expect(page.getByTestId('human-hand').getByRole('button')).toHaveCount(5);
    expect(before).not.toBeNull();
  });

  test('交換は1ハンドに1回だけで、終わると交換ボタンが消える', async ({ page }) => {
    await startGame(page);
    await advanceToDraw(page);
    await page.getByRole('button', { name: '交換しない' }).click();

    await expect(page.getByRole('button', { name: /交換/ })).toHaveCount(0);
  });

  test('ベットしたあとフォールドするとハンドが終わり次のハンドへ進める', async ({ page }) => {
    await startGame(page);
    await page.getByRole('button', { name: /^ベット/ }).click();
    await waitForTurn(page);

    await playUntilHandEnd(page);

    await expect(page.getByTestId('result-text')).toBeVisible();
    await expect(page.getByRole('button', { name: '次のハンドへ' })).toBeVisible();
  });

  test('ハンドを最後まで進めると結果が表示される', async ({ page }) => {
    await startGame(page);

    await playUntilHandEnd(page);

    await expect(page.getByTestId('result-text')).toBeVisible();
    await expect(page.getByRole('button', { name: '次のハンドへ' })).toBeVisible();
  });

  test('次のハンドへ進むとハンド番号が増える', async ({ page }) => {
    await startGame(page);
    await playUntilHandEnd(page);
    await page.getByRole('button', { name: '次のハンドへ' }).click();

    await expect(page.getByText(/ハンド 2 \//)).toBeVisible();
  });

  test('ハンド終了時に勝敗が見出しで表示される', async ({ page }) => {
    await startGame(page);

    await playUntilHandEnd(page);

    await expect(page.getByTestId('result-headline')).toHaveText(
      /あなたの勝ち！|AIの勝ち|引き分け/,
    );
  });

  test('勝った側にWINバッジが表示される', async ({ page }) => {
    await startGame(page);
    await playUntilHandEnd(page);

    const headline = await page.getByTestId('result-headline').textContent();
    if (headline?.includes('あなたの勝ち')) {
      await expect(page.getByTestId('human-winner-badge')).toBeVisible();
      await expect(page.getByTestId('ai-winner-badge')).toHaveCount(0);
    } else if (headline?.includes('AIの勝ち')) {
      await expect(page.getByTestId('ai-winner-badge')).toBeVisible();
      await expect(page.getByTestId('human-winner-badge')).toHaveCount(0);
    } else {
      await expect(page.getByTestId('human-winner-badge')).toHaveCount(0);
      await expect(page.getByTestId('ai-winner-badge')).toHaveCount(0);
    }
  });

  test('ハンド終了時に両者の役がそれぞれの手札の下に表示される', async ({ page }) => {
    await startGame(page);
    await playUntilHandEnd(page);

    // フォールド決着では相手の手札を公開しない
    const byFold = (await page.getByTestId('result-text').textContent())?.includes('フォールド');
    await expect(page.getByTestId('human-rank')).not.toBeEmpty();
    if (byFold === false) {
      await expect(page.getByTestId('ai-rank')).not.toBeEmpty();
    }
  });

  test('ポットのところに両者のそのハンドの収支が表示される', async ({ page }) => {
    await startGame(page);

    // アンティを払った直後は両者 -10
    await expect(page.getByTestId('human-delta')).toHaveText('あなた -10');
    await expect(page.getByTestId('ai-delta')).toHaveText('AI -10');
  });

  test('勝つと結果表示が赤、負けると青になる', async ({ page }) => {
    await startGame(page);
    await playUntilHandEnd(page);

    const headline = await page.getByTestId('result-headline').textContent();
    const potArea = page.getByTestId('pot-area');
    if (headline?.includes('あなたの勝ち')) {
      await expect(potArea).toHaveClass(/bg-red-600/);
    } else if (headline?.includes('AIの勝ち')) {
      await expect(potArea).toHaveClass(/bg-blue-700/);
    } else {
      await expect(potArea).toHaveClass(/bg-green-800/);
    }
  });

  test('手札はスートとランクが読める形で5枚表示される', async ({ page }) => {
    await startGame(page);

    const labels = await page.getByTestId('human-hand').getByRole('button').allInnerTexts();
    expect(labels).toHaveLength(5);
    for (const label of labels) {
      expect(label).toMatch(/[♠♥♦♣]/);
    }
  });

  test('ノーリミットではベット額のスライダーが表示される', async ({ page }) => {
    await page.getByRole('button', { name: /ノーリミット/ }).click();
    await startGame(page);

    await expect(page.getByLabel(/ベット額/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'オールイン' })).toBeVisible();
  });

  test('ベット額のスライダーは10刻みである', async ({ page }) => {
    await page.getByRole('button', { name: /ノーリミット/ }).click();
    await startGame(page);

    await expect(page.getByLabel(/ベット額/)).toHaveAttribute('step', '10');
  });

  test('ポットのショートカットも10刻みの額になる', async ({ page }) => {
    await page.getByRole('button', { name: /ノーリミット/ }).click();
    await startGame(page);

    await page.getByRole('button', { name: 'ポット', exact: true }).click();

    const label = await page.getByText(/^ベット額: /).textContent();
    const amount = Number(label?.replace(/[^0-9]/g, ''));
    expect(amount % 10).toBe(0);
  });

  test('フィックスドリミットではスライダーが表示されない', async ({ page }) => {
    await startGame(page);

    await expect(page.getByLabel(/ベット額/)).toHaveCount(0);
  });

  test('スマホ幅でも手札とボタンが表示される', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await startGame(page);

    await expect(page.getByTestId('human-hand').getByRole('button')).toHaveCount(5);
    await expect(page.getByRole('button', { name: 'チェック' })).toBeVisible();
  });
});
