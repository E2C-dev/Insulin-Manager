import { test, expect } from "@playwright/test";
import {
  createGlucoseEntry,
  createPreset,
  createRule,
  deleteGlucoseEntry,
  deletePreset,
  deleteRule,
  login,
  yesterdayStr,
} from "./helpers";

/**
 * tests/e2e/adjustment-rule-calculation.spec.ts
 *
 * shared/adjustmentRuleEngine.ts (作業2で client/server 共有化した
 * conditionType × timeSlot 評価ロジック) を Entry 画面越しに検証する。
 *
 * B-001 の根本原因は「conditionType (前日/当日 × 測定タイミング) を無視し、
 * いま入力中の血糖値を全ルールに当てはめていた」ことだった。
 * 全 conditionType (14通り) × timeSlot (4通り) の総当たりではなく、
 * 評価ロジックの正しさを決定づける4つの軸をそれぞれ代表するテストを書く:
 *
 *   1. dateOffset=-1 (前日) の条件が、当日のリアルタイム入力に反応して
 *      誤発動しないこと (= B-001 の具体的な再発防止テスト、最重要)
 *   2. 同じ前日条件ルールが、DBに保存済みの前日データでは正しく発動すること
 *      (positive control。 1 だけだと「常に発動しない」壊れ方を見逃す)
 *   3. dateOffset=0 (当日・同枠) の条件が、保存前のリアルタイム入力で
 *      正しく発動すること (Entry.tsx のリアルタイム補正提案機能)
 *   4. targetTimeSlot が異なる時間帯のルールは、無関係な時間帯の入力に
 *      適用されないこと (timeSlot フィルタの健全性)
 */

test.describe("調整ルール計算 (conditionType × timeSlot)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("前日眠前血糖ルールが当日朝食前の入力で誤発動しない (B-001 回帰・最重要)", async ({ page }) => {
    const preset = await createPreset(page, { name: "[e2e] rule-preset-1" });
    const rule = await createRule(page, {
      name: "[e2e] 前日眠前低血糖対応",
      timeSlot: "朝",
      conditionType: "前日眠前血糖",
      threshold: 70,
      comparison: "以下",
      adjustmentAmount: -1,
      targetTimeSlot: "当日の朝",
      presetId: preset.id,
    });

    try {
      // 前日の眠前血糖は「高め (150 = 条件を満たさない)」で登録しておく。
      const yEntry = await createGlucoseEntry(page, {
        date: yesterdayStr(),
        timeSlot: "BeforeSleep",
        glucoseLevel: 150,
      });

      try {
        await page.goto("/entry");
        await page.getByTestId("select-timeslot").click();
        await page.getByTestId("option-BreakfastBefore").click();

        // 当日朝食前の血糖値として、ルールの閾値(70以下)を満たす値をあえて入力する。
        // これに反応して自動計算が -1u してしまったら「前日/当日の取り違え」regression。
        await page.getByTestId("input-glucoseLevel").fill("60");

        // 基礎投与量 (5) のまま = ルールは適用されていない
        await expect(page.getByTestId("input-insulinUnits")).toHaveValue("5", { timeout: 10_000 });
      } finally {
        await deleteGlucoseEntry(page, yEntry.id);
      }
    } finally {
      await deleteRule(page, rule.id);
      await deletePreset(page, preset.id);
    }
  });

  test("前日眠前血糖ルールが、実際の前日データが条件を満たす時は正しく発動する (positive control)", async ({
    page,
  }) => {
    const preset = await createPreset(page, { name: "[e2e] rule-preset-2" });
    const rule = await createRule(page, {
      name: "[e2e] 前日眠前低血糖対応2",
      timeSlot: "朝",
      conditionType: "前日眠前血糖",
      threshold: 70,
      comparison: "以下",
      adjustmentAmount: -1,
      targetTimeSlot: "当日の朝",
      presetId: preset.id,
    });

    try {
      const yEntry = await createGlucoseEntry(page, {
        date: yesterdayStr(),
        timeSlot: "BeforeSleep",
        glucoseLevel: 60, // 70以下 → 条件を満たす
      });

      try {
        await page.goto("/entry");
        await page.getByTestId("select-timeslot").click();
        await page.getByTestId("option-BreakfastBefore").click();

        // 当日朝食前の血糖値は入力しない (前日データだけで発動するかを確認する)
        await expect(page.getByTestId("input-insulinUnits")).toHaveValue("4", { timeout: 10_000 });
      } finally {
        await deleteGlucoseEntry(page, yEntry.id);
      }
    } finally {
      await deleteRule(page, rule.id);
      await deletePreset(page, preset.id);
    }
  });

  test("当日朝食前血糖ルールが保存前のリアルタイム入力で正しく発動する (dateOffset=0 同枠)", async ({ page }) => {
    const preset = await createPreset(page, { name: "[e2e] rule-preset-3" });
    const rule = await createRule(page, {
      name: "[e2e] 当日朝食前低血糖対応",
      timeSlot: "朝",
      conditionType: "当日朝食前血糖",
      threshold: 70,
      comparison: "以下",
      adjustmentAmount: -1,
      targetTimeSlot: "当日の朝",
      presetId: preset.id,
    });

    try {
      await page.goto("/entry");
      await page.getByTestId("select-timeslot").click();
      await page.getByTestId("option-BreakfastBefore").click();

      await page.getByTestId("input-glucoseLevel").fill("60");

      await expect(page.getByTestId("input-insulinUnits")).toHaveValue("4", { timeout: 10_000 });
    } finally {
      await deleteRule(page, rule.id);
      await deletePreset(page, preset.id);
    }
  });

  test("targetTimeSlotが異なる時間帯のルールは適用されない (timeSlotフィルタの健全性)", async ({ page }) => {
    const preset = await createPreset(page, { name: "[e2e] rule-preset-4" });
    // 夕食向けのルール。 朝の入力には一切関係しないはず。
    const rule = await createRule(page, {
      name: "[e2e] 夕食向けルール(朝には無関係)",
      timeSlot: "夕",
      conditionType: "当日夕食前血糖",
      threshold: 70,
      comparison: "以下",
      adjustmentAmount: -2,
      targetTimeSlot: "当日の夕",
      presetId: preset.id,
    });

    try {
      await page.goto("/entry");
      await page.getByTestId("select-timeslot").click();
      await page.getByTestId("option-BreakfastBefore").click();

      // 閾値を満たす値を入力しても、夕食向けルールが朝に誤爆しないこと
      await page.getByTestId("input-glucoseLevel").fill("60");

      await expect(page.getByTestId("input-insulinUnits")).toHaveValue("5", { timeout: 10_000 });
    } finally {
      await deleteRule(page, rule.id);
      await deletePreset(page, preset.id);
    }
  });
});
