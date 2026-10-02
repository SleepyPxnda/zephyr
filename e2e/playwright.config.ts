import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.E2E_PORT ?? 3000)
const baseURL = `http://localhost:${port}`

// Prefer the preinstalled Chromium (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers);
// fall back to the locally installed Chrome so `playwright install` is never needed.
const chromium = process.env.PLAYWRIGHT_BROWSERS_PATH
  ? { launchOptions: { executablePath: `${process.env.PLAYWRIGHT_BROWSERS_PATH}/chromium` } }
  : { channel: process.env.E2E_CHANNEL ?? 'chrome' }

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], ...chromium } }],
  webServer: {
    command: 'pnpm --filter @zephyr/web dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { PORT: String(port) },
  },
})
