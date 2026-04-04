import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		reuseExistingServer: !process.env.CI
	},
	testDir: 'e2e',
	testMatch: '**/*.test.ts',
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'Mobile Chrome',
			use: { ...devices['Pixel 5'] }
		}
	]
});
