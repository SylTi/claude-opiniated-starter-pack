import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E Test Configuration
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Global setup
  globalSetup: './e2e/setup/global-setup.ts',

  // Directory containing test files
  testDir: './e2e',

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list', { printSteps: true }]],

  // Shared settings for all the projects
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'http://localhost:3000',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Take screenshot on failure
    screenshot: 'only-on-failure',
  },

  // Configure projects for major browsers
  // Note: Only Chromium is enabled by default for WSL compatibility
  // Uncomment firefox/webkit if running on native Linux or CI
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Output folder for test artifacts
  outputDir: 'test-results',

  // Start both API and frontend servers for E2E tests
  webServer: [
    {
      // API server (AdonisJS)
      command: 'cd ../api && NODE_ENV=test node ace serve',
      url: 'http://localhost:3333',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      env: {
        NODE_ENV: 'test',
      },
    },
    {
      // Frontend server (Next.js)
      command:
        'NODE_ENV=test dotenv -e .env.test -- pnpm run build && NODE_ENV=test dotenv -e .env.test -- pnpm run start',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 300 * 1000, // More time for build + start on slower FS
    },
  ],
})
