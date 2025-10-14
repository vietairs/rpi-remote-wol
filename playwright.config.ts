import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for PC Remote Wake e2e tests
 *
 * Test strategy:
 * - Sequential execution for database consistency
 * - Single worker to avoid race conditions
 * - Test database isolation
 * - Mock network operations when needed
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Sequential for DB consistency
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for DB isolation
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes
    env: {
      JWT_SECRET: 'test-secret-key-do-not-use-in-production',
      NODE_ENV: 'test',
    },
  },
});
