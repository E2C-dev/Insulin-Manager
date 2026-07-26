import { test, expect } from "@playwright/test";
import { createPreset, deletePreset, login, todayStr } from "./helpers";

/**
 * tests/e2e/duplicate-entry-prevention.spec.ts
 *
 * BUG-002 / B-002 (「同一 user × date × timeSlot × preset」の二重登録防止)
 * のアプリケーション層バリデーションを検証する。
 *
 * 実装 (server/storage.ts DbStorage#createInsulinEntry) は、INSERT前に
 * 同一 (userId, date, timeSlot) の既存レコードを検索し、あれば INSERT ではなく
 * UPDATE する「アプリ層 upsert」方式。migrations/0007_add_unique_insulin_entries.sql
 * で DB 側にも (user_id, date, time_slot, preset_id) の UNIQUE 制約が用意されて
 * いるが、これは「本番環境で直接実行すること」という注記付きの手動適用マイグレ
 * ーションであり、`npm run db:push` (shared/schema.ts が正典) では反映されない。
 * このテストはアプリ層の実際の挙動を検証する。
 */

test.describe("インスリン記録の二重登録防止 (アプリケーション層)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("同一 date/timeSlot/preset へのAPI経由の連続POSTは1件に集約される (upsert)", async ({ page }) => {
    const preset = await createPreset(page, { name: "[e2e] dup-api-preset" });
    const date = todayStr();

    try {
      const first = await page.request.post("/api/insulin-entries", {
        data: { date, timeSlot: "Dinner", units: "3", presetId: preset.id },
      });
      expect(first.ok()).toBeTruthy();
      const firstBody = await first.json();

      const second = await page.request.post("/api/insulin-entries", {
        data: { date, timeSlot: "Dinner", units: "6", presetId: preset.id },
      });
      expect(second.ok()).toBeTruthy();
      const secondBody = await second.json();

      // 新規行ではなく同一行が更新されている (id が同じ)
      expect(secondBody.entry.id).toBe(firstBody.entry.id);

      const list = await page.request.get(`/api/insulin-entries?startDate=${date}&endDate=${date}`);
      const listBody = await list.json();
      const dinnerEntries = listBody.entries.filter((e: { timeSlot: string }) => e.timeSlot === "Dinner");

      expect(dinnerEntries).toHaveLength(1);
      expect(parseFloat(dinnerEntries[0].units)).toBe(6);
    } finally {
      await deletePreset(page, preset.id);
    }
  });

  test("Entry画面から同じ日付/タイミングで2回保存しても記録は1件に集約される", async ({ page }) => {
    const preset = await createPreset(page, { name: "[e2e] dup-ui-preset" });
    const date = todayStr();

    try {
      await page.goto("/entry");
      await page.getByTestId("input-date").fill(date);
      await page.getByTestId("select-timeslot").click();
      await page.getByTestId("option-LunchBefore").click();

      // 1回目の保存
      await page.getByTestId("input-insulinUnits").fill("3");
      await page.getByTestId("button-save").click();
      await expect(page.getByText("保存成功").first()).toBeVisible({ timeout: 10_000 });

      // 保存成功後も date/timeSlot は保持されたまま insulinUnits はクリアされる。
      // ただしプリセットの基礎投与量 (5) がある場合、自動計算 useEffect が
      // 即座にそれを再表示する (Entry.tsx: 「血糖値入力前でも基礎単位を提示」)。
      // ここでは値を明示的に上書きして2回目を保存する。
      await page.getByTestId("input-insulinUnits").fill("7");
      await page.getByTestId("button-save").click();
      await expect(page.getByText("保存成功").first()).toBeVisible({ timeout: 10_000 });

      const list = await page.request.get(`/api/insulin-entries?startDate=${date}&endDate=${date}`);
      const listBody = await list.json();
      const lunchEntries = listBody.entries.filter((e: { timeSlot: string }) => e.timeSlot === "Lunch");

      expect(lunchEntries).toHaveLength(1);
      expect(parseFloat(lunchEntries[0].units)).toBe(7);
    } finally {
      await deletePreset(page, preset.id);
    }
  });
});
