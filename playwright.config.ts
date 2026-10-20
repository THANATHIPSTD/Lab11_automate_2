import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

const isCI = Boolean(process.env.CI);
const targetURL = process.env.BASE_URL?.trim();
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

for (const name of ['TEST_USER', 'TEST_PASS']) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

// Starter configuration — LOCAL ONLY.
//
// It builds the Nuxt app, starts it on port 3000 and runs the whole suite on three
// browsers. Nothing in here knows about CI, Vercel, environments or secrets yet: making it
// do so is your job (PL-02 in the pipeline specification). Do not create a second config
// file for CI — one suite, one configuration, behaviour chosen by the environment.
//
// Tip: while you work, keep `npm run dev` running in another terminal. The config reuses
// a server that is already listening on port 3000 instead of building again.

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: isCI ? [['html', { open: 'never' }], ['blob']] : 'html',
  retries: isCI ? 2 : 0,
  forbidOnly: isCI,
  workers: isCI ? 2 : undefined,

  use: {
    baseURL: targetURL || 'http://localhost:3000',
    trace: 'on-first-retry',
    ...(targetURL && bypassSecret
      ? { extraHTTPHeaders: { 'x-vercel-protection-bypass': bypassSecret } }
      : {}),
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
  ],

  webServer: targetURL
    ? undefined
    : {
        command: 'npm run build && npm start',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
