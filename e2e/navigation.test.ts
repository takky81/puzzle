import { test, expect } from '@playwright/test';

test('トップページが表示される', async ({ page }) => {
	await page.goto('/puzzle/');
	await expect(page.locator('h1')).toHaveText('ゲーム一覧');
});

test('各ゲームページに遷移できる', async ({ page }) => {
	await page.goto('/puzzle/');

	await page.click('text=オセロ');
	await expect(page.locator('h1')).toHaveText('オセロ');

	await page.click('text=戻る');
	await expect(page.locator('h1')).toHaveText('ゲーム一覧');
});
