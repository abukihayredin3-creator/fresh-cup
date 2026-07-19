import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.E2E_WEB_PORT ?? "3000";
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Some sandboxes ship a full Chromium build without the separate headless-shell
        // Playwright normally downloads; point at it explicitly when provided instead of
        // failing with "Executable doesn't exist".
        launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined },
      },
    },
    { name: "mobile-safari", use: { ...devices["iPhone 14"] } },
  ],
  webServer: {
    command: process.env.CI ? `PORT=${PORT} pnpm start` : `PORT=${PORT} pnpm dev`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
