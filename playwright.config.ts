import { defineConfig, devices } from '@playwright/test';
const production = process.env.TEST_PRODUCTION === '1';
export default defineConfig({
  testDir: './tests/e2e', timeout: 90000, workers: 1, retries: 0,
  reporter: 'list', outputDir: 'test-results',
  use: { ...devices['Desktop Chrome'], baseURL: production ? 'http://127.0.0.1:4173' : 'http://127.0.0.1:5173',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    launchOptions: { args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
  },
  webServer: [
    { command: 'node --import tsx scripts/serveRaceFixture.ts', url: 'http://127.0.0.1:5180', reuseExistingServer: false, timeout: 30000 },
    { command: 'npm run start:server', url: 'http://127.0.0.1:2567/health', reuseExistingServer: true, timeout: 30000 },
    { command: production ? 'npm run preview' : 'npm run dev:client',
      url: production ? 'http://127.0.0.1:4173' : 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 30000 },
  ],
});
