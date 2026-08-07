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
 *      正しく発動すること (Entry.tsx のリアルタイム参考値表示)
 *   4. targetTimeSlot が異なる時間帯のルールは、無関係な時間帯の入力に
 *      適用されないこと (timeSlot フィルタの健全性)
 *
 * D-003 (薬機法対策パッケージ) 以降の重要な仕様変更:
 *   ルール評価の結果は **参考値パネル (data-testid="reference-panel") に表示
 *   されるだけ** で、インスリン入力欄 (input-insulinUnits) には自動で入らない。
 *   入力欄に入るのはユーザーが「この値を入力欄に反映」(button-apply-reference)
 *   をタップしたときだけ。
 *   そのため各テストは
 *     (a) 参考値パネルの数値が正しいこと
 *     (b) タップ前は入力欄が空のままであること (= 自動入力していないこと)
 *     (c) タップ後に入力欄へその値が入ること
 *   の3点を検証する。(b) が D-003 の中核なので必ず残すこと。
 */

/** 参考値の検証3点セット (パネル値 / 自動入力していないこと / タップ反映) */
async function expectReferenceValue(
  page: import("@playwright/test").Page,
  expected: string
): Promise<void> {
  // (a) 参考値パネルに期待値が出ている
  await expect(page.getByTestId("reference-units")).toHaveText(expected, { timeout: 10_000 });
  // (b) D-003 の中核: タップ前は入力欄に自動で値が入らない
  await expect(page.getByTestId("input-insulinUnits")).toHaveValue("");
  // (c) ユーザーがタップして初めて入力欄に入る
  await page.getByTestId("button-apply-reference").click();
  await expect(page.getByTestId("input-insulinUnits")).toHaveValue(expected);
}

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
        // これに反応して参考値が -1u してしまったら「前日/当日の取り違え」regression。
        await page.getByTestId("input-glucoseLevel").fill("60");

        // 基礎投与量 (5) のまま = ルールは適用されていない
        await expectReferenceValue(page, "5");
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
        await expectReferenceValue(page, "4");

        // 内訳に「基準量」と「適用されたルールの調整量」が両方出ている
        const breakdown = page.getByTestId("reference-breakdown");
        await expect(breakdown).toContainText("基準量 5単位");
        await expect(breakdown).toContainText("-1単位");
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

      await expectReferenceValue(page, "4");
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

      await expectReferenceValue(page, "5");
    } finally {
      await deleteRule(page, rule.id);
      await deletePreset(page, preset.id);
    }
  });
});

/**
 * D-003 (薬機法対策パッケージ) の受け入れ条件そのものを検証するスイート。
 * 「血糖値を入れるとインスリン量が自動で決まる」挙動が復活したら落ちる。
 */
test.describe("D-003 薬機法対策: 参考表示とタップ反映", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("血糖値を入力しても入力欄には自動で入らず、タップして初めて反映される", async ({ page }) => {
    const preset = await createPreset(page, { name: "[e2e] d003-preset-1" });
    const rule = await createRule(page, {
      name: "[e2e] 当日朝食前高血糖対応",
      timeSlot: "朝",
      conditionType: "当日朝食前血糖",
      threshold: 200,
      comparison: "以上",
      adjustmentAmount: 2,
      targetTimeSlot: "当日の朝",
      presetId: preset.id,
    });

    try {
      await page.goto("/entry");
      await page.getByTestId("select-timeslot").click();
      await page.getByTestId("option-BreakfastBefore").click();

      // タイミングを選んだだけの段階でも、入力欄は空 (基礎単位すら自動で入らない)
      await expect(page.getByTestId("reference-units")).toHaveText("5", { timeout: 10_000 });
      await expect(page.getByTestId("input-insulinUnits")).toHaveValue("");

      // 条件を満たす血糖値を入力 → 参考値だけが 5 → 7 に変わる
      await page.getByTestId("input-glucoseLevel").fill("250");
      await expect(page.getByTestId("reference-units")).toHaveText("7", { timeout: 10_000 });
      await expect(page.getByTestId("input-insulinUnits")).toHaveValue("");

      // 内訳に基準量と適用ルールが出ている
      const breakdown = page.getByTestId("reference-breakdown");
      await expect(breakdown).toContainText("基準量 5単位");
      await expect(breakdown).toContainText("200mg/dL以上");
      await expect(breakdown).toContainText("+2単位");

      // タップして初めて入力欄に入る
      await page.getByTestId("button-apply-reference").click();
      await expect(page.getByTestId("input-insulinUnits")).toHaveValue("7");
      await expect(page.getByTestId("hint-reference-applied")).toBeVisible();

      // 反映後の手動編集は自由 (上書きし返されない)
      await page.getByTestId("input-insulinUnits").fill("3");
      await expect(page.getByTestId("input-insulinUnits")).toHaveValue("3");
      await expect(page.getByTestId("hint-reference-applied")).toHaveCount(0);
      // 参考値パネル自体は 7 のまま表示され続ける
      await expect(page.getByTestId("reference-units")).toHaveText("7");
    } finally {
      await deleteRule(page, rule.id);
      await deletePreset(page, preset.id);
    }
  });

  test("参考値パネルの直下に免責が常設表示される", async ({ page }) => {
    const preset = await createPreset(page, { name: "[e2e] d003-preset-2" });

    try {
      await page.goto("/entry");
      await page.getByTestId("select-timeslot").click();
      await page.getByTestId("option-LunchBefore").click();

      await expect(page.getByTestId("reference-panel")).toBeVisible();
      await expect(page.getByTestId("entry-disclaimer")).toContainText(
        "本アプリは医療機器ではありません"
      );
      await expect(page.getByTestId("entry-disclaimer")).toContainText(
        "治療の判断は必ず主治医の指示に従ってください"
      );
      // アプリ共通フッターの短縮版免責
      await expect(page.getByTestId("app-disclaimer")).toContainText(
        "本アプリは医療機器ではありません。緊急時は医療機関へ。"
      );
    } finally {
      await deletePreset(page, preset.id);
    }
  });

  // 注記: doctor_confirmed=false のルールは D-003 以降 API から作成できない
  // (作成・更新時に true 必須)。したがって「未確認ルールを含む」注記
  // (data-testid="reference-unconfirmed-note") と一覧の未確認バッジ
  // (badge-unconfirmed-*) が出るのは D-003 以前に作られた既存レコードだけで、
  // E2E から状態を作れない。ここでは裏返しの
  // 「確認済みルールでは注記もバッジも出ない」ことを検証する。
  test("確認済みルールでは未確認の注記もバッジも出ない", async ({ page }) => {
    const preset = await createPreset(page, { name: "[e2e] d003-preset-3" });
    const rule = await createRule(page, {
      name: "[e2e] 確認済みルール",
      timeSlot: "朝",
      conditionType: "当日朝食前血糖",
      threshold: 200,
      comparison: "以上",
      adjustmentAmount: 2,
      targetTimeSlot: "当日の朝",
      presetId: preset.id,
      instructedAt: "2026-05-01",
      instructedBy: "○○病院 内分泌内科",
    });

    try {
      await page.goto("/entry");
      await page.getByTestId("select-timeslot").click();
      await page.getByTestId("option-BreakfastBefore").click();
      await page.getByTestId("input-glucoseLevel").fill("250");

      await expect(page.getByTestId("reference-units")).toHaveText("7", { timeout: 10_000 });
      await expect(page.getByTestId("reference-unconfirmed-note")).toHaveCount(0);

      // 一覧画面には「主治医指示として登録済み」と指示日・指示元が出て、
      // 未確認バッジは出ない。
      await page.goto("/adjustment-rules");
      const card = page.locator("text=[e2e] 確認済みルール").first();
      await expect(card).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId(`badge-unconfirmed-${rule.id}`)).toHaveCount(0);
      await expect(page.getByText("主治医指示として登録済み").first()).toContainText(
        "2026-05-01 / ○○病院 内分泌内科"
      );
    } finally {
      await deleteRule(page, rule.id);
      await deletePreset(page, preset.id);
    }
  });
});

/**
 * D-003: 調整ルール作成フォームの「主治医の指示であることの確認」必須化。
 */
test.describe("D-003 薬機法対策: 医師指示転記フロー", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("主治医指示の確認にチェックしないとルールを保存できない", async ({ page }) => {
    const preset = await createPreset(page, { name: "[e2e] d003-rule-form-preset" });

    try {
      await page.goto("/adjustment-rules");
      await page.getByRole("button", { name: "新規ルール" }).click();

      // 使用するインスリンを選ぶ
      await page.locator("#presetId").click();
      // 注意1: preset.name には "[e2e]" が含まれるため RegExp に渡してはいけない
      // ([e2e] は文字クラスとして解釈され一致しなくなる)。文字列指定なら
      // Playwright が部分一致で扱う。
      // 注意2: 過去に中断された実行の残骸で同名プリセットが残ることがあるため
      // first() を使う (このテストは保存ボタンの活性状態しか見ないため、
      // 同名のどちらを選んでも判定は変わらない)。
      await page.getByRole("option", { name: preset.name }).first().click();

      // 未チェックの状態では保存ボタンが押せない
      await expect(page.getByTestId("button-save-rule")).toBeDisabled();

      // チェックすると押せるようになる
      await page.getByTestId("checkbox-doctor-confirmed").click();
      await expect(page.getByTestId("button-save-rule")).toBeEnabled();
    } finally {
      await deletePreset(page, preset.id);
    }
  });

  test("doctorConfirmed なしの API リクエストは 400 で拒否される", async ({ page }) => {
    const preset = await createPreset(page, { name: "[e2e] d003-api-preset" });

    try {
      const res = await page.request.post("/api/adjustment-rules", {
        data: {
          name: "[e2e] 確認なしルール",
          timeSlot: "朝",
          conditionType: "当日朝食前血糖",
          threshold: 200,
          comparison: "以上",
          adjustmentAmount: 2,
          targetTimeSlot: "当日の朝",
          presetId: preset.id,
        },
      });
      expect(res.status()).toBe(400);
    } finally {
      await deletePreset(page, preset.id);
    }
  });
});
