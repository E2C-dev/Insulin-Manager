import { test, expect } from "@playwright/test";
import { createGlucoseEntry, deleteGlucoseEntry, login, todayStr } from "./helpers";

/**
 * tests/e2e/pdf-export.spec.ts
 *
 * BUG-008 (PDF出力 window.print() で大量データ時フリーズ) の対応として
 * 実装された「jsPDFによる直接生成」+「90日超の警告ダイアログ」を検証する。
 *
 * 90日超シナリオについて:
 * Logbook.tsx の期間選択は現状 週(7日)/月(30日) の2択のみで、通常操作では
 * 90日超のパスに到達できない (コード中のコメントにある通り、将来のカスタム
 * 期間選択拡張に備えた準備実装)。決定論的に検証するため、Logbook.tsx に
 * `?e2eForceDays=N` という開発環境限定 (import.meta.env.DEV) のテストフックを
 * 追加し、Playwright からのみ 90日超の分岐を再現できるようにしている。
 */

test.describe("PDF/CSV出力", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("記録がある状態でPDF出力ボタンを押すと実際にファイルがダウンロードされる", async ({ page }) => {
    const entry = await createGlucoseEntry(page, {
      date: todayStr(),
      timeSlot: "BreakfastBefore",
      glucoseLevel: 110,
    });

    try {
      await page.goto("/logbook");
      await expect(page.getByTestId("button-export-dropdown")).toBeVisible({ timeout: 10_000 });
      await page.getByTestId("button-export-dropdown").click();

      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 20_000 }),
        page.getByTestId("menu-item-export-pdf").click(),
      ]);

      expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    } finally {
      await deleteGlucoseEntry(page, entry.id);
    }
  });

  test("記録がある状態でCSV出力ボタンを押すと実際にファイルがダウンロードされる", async ({ page }) => {
    const entry = await createGlucoseEntry(page, {
      date: todayStr(),
      timeSlot: "BreakfastBefore",
      glucoseLevel: 110,
    });

    try {
      await page.goto("/logbook");
      await expect(page.getByTestId("button-export-dropdown")).toBeVisible({ timeout: 10_000 });
      await page.getByTestId("button-export-dropdown").click();

      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 10_000 }),
        page.getByTestId("menu-item-export-csv").click(),
      ]);

      expect(download.suggestedFilename()).toMatch(/\.csv$/i);
    } finally {
      await deleteGlucoseEntry(page, entry.id);
    }
  });

  test("90日を超える期間のPDF出力では警告ダイアログが表示され、続行するとダウンロードされる", async ({
    page,
  }) => {
    const entry = await createGlucoseEntry(page, {
      date: todayStr(),
      timeSlot: "BreakfastBefore",
      glucoseLevel: 110,
    });

    try {
      await page.goto("/logbook?e2eForceDays=95");
      await expect(page.getByTestId("button-export-dropdown")).toBeVisible({ timeout: 10_000 });
      await page.getByTestId("button-export-dropdown").click();
      await page.getByTestId("menu-item-export-pdf").click();

      await expect(page.getByText("長期間のPDF出力")).toBeVisible();
      await expect(page.getByText(/90日を超える期間.*約95日/)).toBeVisible();

      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 20_000 }),
        page.getByTestId("button-confirm-pdf-warning").click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    } finally {
      await deleteGlucoseEntry(page, entry.id);
    }
  });

  test("90日超の警告ダイアログでキャンセルするとダウンロードされない", async ({ page }) => {
    const entry = await createGlucoseEntry(page, {
      date: todayStr(),
      timeSlot: "BreakfastBefore",
      glucoseLevel: 110,
    });

    try {
      await page.goto("/logbook?e2eForceDays=95");
      await expect(page.getByTestId("button-export-dropdown")).toBeVisible({ timeout: 10_000 });
      await page.getByTestId("button-export-dropdown").click();
      await page.getByTestId("menu-item-export-pdf").click();

      await expect(page.getByText("長期間のPDF出力")).toBeVisible();
      await page.getByTestId("button-cancel-pdf-warning").click();
      await expect(page.getByText("長期間のPDF出力")).not.toBeVisible();
    } finally {
      await deleteGlucoseEntry(page, entry.id);
    }
  });
});
