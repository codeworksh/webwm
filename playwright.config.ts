import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "pnpm exec vp -C apps/web dev --host 127.0.0.1 --port 5184",
      url: "http://127.0.0.1:5184/",
      name: "React app",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 1_000 },
    },
    {
      command: "pnpm exec vp -C apps/playground dev --host 127.0.0.1 --port 5183",
      url: "http://127.0.0.1:5183/",
      name: "DOM playground",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      gracefulShutdown: { signal: "SIGTERM", timeout: 1_000 },
    },
  ],
});
