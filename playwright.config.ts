import { defineConfig } from "@playwright/test";

/** Smoke tests run against a dev server in MOCK_APIS mode with its own throwaway data dir. */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3101", viewport: { width: 1280, height: 900 } },
  webServer: {
    command:
      "rm -rf data/smoke && DATA_DIR=./data/smoke PORT=3101 MOCK_APIS=true NODE_ENV=development npm run dev",
    url: "http://127.0.0.1:3101",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
