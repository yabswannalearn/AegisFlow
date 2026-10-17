import { defineConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
const localBrowser = path.resolve(".runtime/browsers/chromium-1248/chrome-win64/chrome.exe");
export default defineConfig({
  testDir: "e2e", timeout: 180000, workers: 1, retries: 0,
  use: { baseURL: process.env.AEGIS_TEST_BASE_URL ?? "http://localhost:3005", viewport: { width: 1440, height: 1080 },
    launchOptions: { executablePath: process.env.AEGIS_BROWSER_PATH ?? (fs.existsSync(localBrowser) ? localBrowser : undefined) },
    screenshot: "only-on-failure", trace: "retain-on-failure", video: "on" },
});
