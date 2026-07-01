import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  timeout: 60_000,
});
