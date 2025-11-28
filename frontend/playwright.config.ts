import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for FTR Registration System frontend E2E tests.
 *
 * NOTE:
 * - Перед запуском тестов необходимо запустить приложение:
 *   - backend: npm run dev (в папке backend, порт по умолчанию 3001)
 *   - frontend: npm run dev (в папке frontend, порт по умолчанию 5173)
 * - Базовый URL для тестов берётся из переменной окружения BASE_URL
 *   или по умолчанию http://localhost:5173.
 */

const baseURL = process.env.BASE_URL || 'http://localhost:5173';

export default defineConfig({
  testDir: './tests',
  timeout: 30 * 1000,
  expect: {
    timeout: 5 * 1000,
  },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});


