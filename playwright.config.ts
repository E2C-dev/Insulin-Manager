import { defineConfig, devices } from "@playwright/test";

/**
 * playwright.config.ts
 *
 * 作業3 (2026-07): B-001 ホワイトアウト回帰・調整ルール計算・重複登録防止・
 * PDF出力の E2E テストスイート設定。
 *
 * 前提 (ローカル実行時):
 * - ローカル Postgres が起動しており .env に DATABASE_URL が設定済みであること
 * - `npm run db:push` でスキーマが最新であること
 * - dev server がまだ起動していなければ本設定の webServer が自動起動する
 *   (既に起動中ならそれを再利用する)
 * - テストユーザーは globalSetup が script/create-test-user.ts を呼び出して
 *   自動作成する (testuser_demo / TestPass123)
 *
 * 対象: localhost:5000 の dev server (PORT 環境変数で上書き可能。
 * 例: 手元の Mac で 5000 番が macOS の AirPlay Receiver に専有されている場合など)
 */
const PORT = process.env.PORT || "5000";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  // 同一DB・同一テストユーザーに対する書き込みテストのため直列実行 (レース回避)
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
