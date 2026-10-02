import { defineConfig, devices } from "@playwright/test";

/** Set to run the same spec against an already-deployed build instead of a local `next dev`. */
const deployed = process.env.PLAYWRIGHT_BASE_URL;
const LOCAL_URL = "http://localhost:3000";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  // A cold `next dev` compiles the home and editor routes inside the first test.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: deployed ?? LOCAL_URL,
    acceptDownloads: true,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer:
    deployed === undefined
      ? {
          command: "bun run dev",
          url: LOCAL_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        }
      : undefined,
});
