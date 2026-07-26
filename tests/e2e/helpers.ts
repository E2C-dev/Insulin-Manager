import type { Page } from "@playwright/test";

/**
 * tests/e2e/helpers.ts
 * 全 spec 共通のログイン・テストデータ作成ヘルパー。
 * テストユーザーは script/create-test-user.ts (globalSetup 経由) が作成する
 * testuser_demo / TestPass123 を既定値とする。
 */

export const TEST_USERNAME = process.env.PW_TEST_USERNAME ?? "testuser_demo";
export const TEST_PASSWORD = process.env.PW_TEST_PASSWORD ?? "TestPass123";

/** ログインフォームからログインし、ホーム(ダッシュボード)への遷移まで待つ。 */
export async function login(
  page: Page,
  username: string = TEST_USERNAME,
  password: string = TEST_PASSWORD
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("ユーザー名").fill(username);
  await page.getByLabel("パスワード").fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();
  // ログイン成功後 Login.tsx の onSuccess で setLocation("/") される。
  await page.waitForURL((url) => url.pathname === "/", { timeout: 10_000 });
}

// ===== JST 基準の日付ユーティリティ (client/src/lib/date-utils.ts の
// formatJstDate と同じ考え方。テスト実行環境の TZ に依らず、アプリ本体と
// 同じ「今日」を指すようにする) =====
const JST_OFFSET_MIN = 9 * 60;

function jstDateStr(base: Date): string {
  const utc = base.getTime() + base.getTimezoneOffset() * 60_000;
  const jst = new Date(utc + JST_OFFSET_MIN * 60_000);
  const y = jst.getFullYear();
  const m = String(jst.getMonth() + 1).padStart(2, "0");
  const d = String(jst.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayStr(): string {
  return jstDateStr(new Date());
}

export function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return jstDateStr(d);
}

// ===== API 経由のテストデータ作成 (page.request は page と同じ Cookie/
// セッションを共有するため、事前に login(page) 済みであれば認証状態で叩ける) =====

interface PresetInput {
  name: string;
  category?: string;
  brand?: string;
  defaultBreakfastUnits?: string | null;
  defaultLunchUnits?: string | null;
  defaultDinnerUnits?: string | null;
  defaultBedtimeUnits?: string | null;
  sortOrder?: number;
}

export interface CreatedPreset {
  id: string;
  name: string;
}

export async function createPreset(page: Page, input: PresetInput): Promise<CreatedPreset> {
  const res = await page.request.post("/api/insulin-presets", {
    data: {
      category: "超速効型",
      brand: "Humalog (リスプロ)",
      defaultBreakfastUnits: "5",
      defaultLunchUnits: "5",
      defaultDinnerUnits: "5",
      defaultBedtimeUnits: "5",
      sortOrder: 0,
      isActive: "true",
      ...input,
    },
  });
  if (!res.ok()) {
    throw new Error(`プリセット作成に失敗しました: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return body.preset;
}

export async function deletePreset(page: Page, id: string): Promise<void> {
  await page.request.delete(`/api/insulin-presets/${id}`);
}

interface RuleInput {
  name?: string;
  timeSlot: string;
  conditionType: string;
  threshold: number;
  comparison: "以下" | "以上" | "未満" | "超える";
  adjustmentAmount: number;
  targetTimeSlot: string;
  presetId: string;
}

export interface CreatedRule {
  id: string;
  name: string;
}

export async function createRule(page: Page, input: RuleInput): Promise<CreatedRule> {
  const res = await page.request.post("/api/adjustment-rules", {
    data: {
      name: input.name ?? `[e2e] ${input.conditionType}${input.comparison}${input.threshold}`,
      ...input,
    },
  });
  if (!res.ok()) {
    throw new Error(`ルール作成に失敗しました: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return body.rule;
}

export async function deleteRule(page: Page, id: string): Promise<void> {
  await page.request.delete(`/api/adjustment-rules/${id}`);
}

interface GlucoseInput {
  date: string;
  timeSlot: string;
  glucoseLevel: number;
}

export interface CreatedGlucoseEntry {
  id: string;
}

export async function createGlucoseEntry(page: Page, input: GlucoseInput): Promise<CreatedGlucoseEntry> {
  const res = await page.request.post("/api/glucose-entries", { data: input });
  if (!res.ok()) {
    throw new Error(`血糖値記録の作成に失敗しました: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return body.entry;
}

export async function deleteGlucoseEntry(page: Page, id: string): Promise<void> {
  await page.request.delete(`/api/glucose-entries/${id}`);
}

export async function deleteInsulinEntry(page: Page, id: string): Promise<void> {
  await page.request.delete(`/api/insulin-entries/${id}`);
}

interface InsulinInput {
  date: string;
  timeSlot: string;
  units: string;
  presetId?: string;
}

export interface CreatedInsulinEntry {
  id: string;
}

export async function createInsulinEntry(page: Page, input: InsulinInput): Promise<CreatedInsulinEntry> {
  const res = await page.request.post("/api/insulin-entries", { data: input });
  if (!res.ok()) {
    throw new Error(`インスリン記録の作成に失敗しました: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return body.entry;
}
