import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests/e2e', use: { baseURL: 'http://127.0.0.1:4181', browserName: 'chromium', launchOptions: { channel: 'chrome' } }, webServer: { command: 'npm run preview -- --port 4181 --strictPort', url: 'http://127.0.0.1:4181', reuseExistingServer: false, timeout: 20000 }, reporter: 'list' });
