import { test, expect } from "@playwright/test";
import { login } from "./helpers";

/**
 * tests/e2e/entry-whiteout.spec.ts
 *
 * B-001 (ホワイトアウトバグ) の回帰テスト。
 * 参考仕様: 事業戦略資料/.../B-001_ホワイトアウト調査と全画面バグ監査_仕様書.md §8
 * 記載の4シナリオを、現行実装の data-testid に合わせて実装する。
 *
 * このスイート実行時点で ErrorBoundary・useCallback 化・safeFormat 等の
 * Sprint 1 修正は既にコードベースに反映済み (git log 参照)。ここでは
 * その修正が壊れていないことを検証する回帰テストという位置づけ。
 */

test.describe("Entry画面 ホワイトアウト回帰テスト", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("シナリオ1: 正常系の血糖値入力で画面が真っ白にならない", async ({ page }) => {
    await page.goto("/entry");

    await page.getByTestId("select-timeslot").click();
    await page.getByTestId("option-BreakfastBefore").click();
    await page.getByTestId("input-glucoseLevel").fill("120");

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(100);
    await expect(page.getByTestId("button-save")).toBeVisible();
    await expect(page.getByTestId("input-glucoseLevel")).toHaveValue("120");
  });

  test("シナリオ2: 不正な血糖値入力 (abc/-1/99999/0/0.5) でも画面が真っ白にならない", async ({ page }) => {
    await page.goto("/entry");

    await page.getByTestId("select-timeslot").click();
    await page.getByTestId("option-BreakfastBefore").click();

    const glucoseInput = page.getByTestId("input-glucoseLevel");

    // "abc" は type="number" の input には Playwright.fill() で直接設定できない
    // (ブラウザが number 入力への非数値代入を拒否するため)。実ユーザーの
    // キー入力を模した pressSequentially で試みる (ブラウザ側がキーごと弾き、
    // 値は変化しないはずだが、その場合も画面が真っ白にならないことを確認する)。
    await glucoseInput.click();
    await glucoseInput.pressSequentially("abc");
    await expect(page.getByTestId("button-save")).toBeVisible();

    for (const value of ["-1", "99999", "0", "0.5"]) {
      await glucoseInput.fill(value);
      // 入力の都度、画面が保存ボタンごと消えていないことを確認する。
      await expect(page.getByTestId("button-save")).toBeVisible();
    }

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(100);
  });

  test("シナリオ4: date input を空欄にしても画面が真っ白にならない", async ({ page }) => {
    await page.goto("/entry");

    await page.getByTestId("input-date").fill("");

    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(100);
    await expect(page.getByTestId("button-save")).toBeVisible();
    // 日付選択カードのタイトルが表示され続けている (ページ全体が消えていない)
    await expect(page.getByText("いつの記録ですか？")).toBeVisible();
  });
});

test.describe("ErrorBoundary 動作確認 (開発環境専用ルート)", () => {
  test("シナリオ3: 意図的な例外発生時に ErrorBoundary の fallback UI が表示される", async ({ page }) => {
    await page.goto("/__test-error-boundary");
    await page.getByTestId("trigger-error").click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByTestId("error-boundary-reload")).toBeVisible();
    await expect(page.getByTestId("error-boundary-home")).toBeVisible();
    await expect(page.getByTestId("error-boundary-reload")).toContainText("再読み込み");
  });
});
