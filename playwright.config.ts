import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config. Real journeys (onboarding → goal → decision → calendar
 * write) land in Phase 6 with externals stubbed. For now this establishes the
 * runner so `pnpm test:e2e` resolves.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
