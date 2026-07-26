import { safeGetLocalStorage, safeSetLocalStorageString } from "@/lib/storage-utils";

/**
 * client/src/lib/glucoseStatus.ts
 *
 * 血糖値のステータス判定 (色分け・ラベル) を1系統に統合する (作業5-1, 最優先)。
 *
 * 背景:
 * - client/src/lib/types.ts の旧 getGlucoseStatusColor(value, settings) は
 *   ユーザー設定の目標範囲を考慮する設計だったが、呼び出し箇所が一つも無い
 *   デッドコードだった。
 * - 代わりに Dashboard.tsx (バッジ2箇所 + 7日間カレンダーの day-dot) と
 *   Logbook.tsx (テーブルセルのバッジ) が、それぞれ独立して 70/180 の
 *   固定閾値をハードコードしていた (旧 getGlucoseBasicColor / getDayDotStyle /
 *   インラインの「低」「高」ラベル判定)。
 *
 * 方針 (回帰を避けつつ実際に個人化を反映させる):
 * - 危険域の閾値 (70未満=低血糖 / 180超=高血糖) は医療上の固定値として維持する。
 *   Dashboard/Logbook の凡例表示 ("70未満：低血糖" 等) と完全に一致させ、
 *   ユーザー設定では変更できない。
 * - 「良好 (green)」の範囲だけをユーザー設定の目標範囲で個人化する。
 *   既定値は 70〜180 (= 危険域の境界と同一) なので、ユーザーが目標範囲を
 *   カスタマイズしない限り、これまでの表示と完全に同じ結果になる
 *   (デフォルトでは regression が起きない設計)。
 * - 設定画面で目標範囲を狭める (例: 80〜130) と、安全域だが個人目標の
 *   外側にある値を「neutral」として区別できるようになる。
 */

export interface GlucoseRange {
  low: number;
  high: number;
}

// 危険域の固定閾値 (Dashboard/Logbook の凡例表示と一致。設定で変更不可)
export const GLUCOSE_DANGER_LOW = 70;
export const GLUCOSE_DANGER_HIGH = 180;

// 目標範囲の既定値。危険域の境界と同一にすることで、ユーザーが目標範囲を
// カスタマイズしない限り既存の表示と完全に同じ結果になる。
export const DEFAULT_GLUCOSE_RANGE: GlucoseRange = {
  low: GLUCOSE_DANGER_LOW,
  high: GLUCOSE_DANGER_HIGH,
};

const STORAGE_KEY_LOW = "glucoseTargetRangeLow";
const STORAGE_KEY_HIGH = "glucoseTargetRangeHigh";

/** ユーザーが設定画面で保存した目標範囲を読み出す (未設定/不正値なら既定値)。 */
export function getUserGlucoseRange(): GlucoseRange {
  const lowRaw = safeGetLocalStorage(STORAGE_KEY_LOW);
  const highRaw = safeGetLocalStorage(STORAGE_KEY_HIGH);
  const low = lowRaw != null ? parseInt(lowRaw, 10) : NaN;
  const high = highRaw != null ? parseInt(highRaw, 10) : NaN;
  if (Number.isNaN(low) || Number.isNaN(high) || low >= high) {
    return DEFAULT_GLUCOSE_RANGE;
  }
  return { low, high };
}

/** 目標範囲を保存する (Settings画面の保存ボタンから呼び出す)。 */
export function saveUserGlucoseRange(range: GlucoseRange): void {
  safeSetLocalStorageString(STORAGE_KEY_LOW, String(range.low));
  safeSetLocalStorageString(STORAGE_KEY_HIGH, String(range.high));
}

export type GlucoseStatus = "low" | "high" | "good" | "neutral";

/** 血糖値1件のステータスを判定する純粋関数。 */
export function getGlucoseStatus(value: number, range: GlucoseRange): GlucoseStatus {
  if (value < GLUCOSE_DANGER_LOW) return "low";
  if (value > GLUCOSE_DANGER_HIGH) return "high";
  if (value >= range.low && value <= range.high) return "good";
  return "neutral";
}

/**
 * バッジ・数値表示用のテキスト色クラス。
 * value が未測定 (undefined/null/NaN) の場合は記録なし表示を返す。
 * (旧 getGlucoseBasicColor / getGlucoseStatusColor の統合後継)
 */
export function getGlucoseStatusColorClass(
  value: number | null | undefined,
  range?: GlucoseRange
): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "text-muted-foreground";
  }
  const status = getGlucoseStatus(value, range ?? getUserGlucoseRange());
  switch (status) {
    case "low":
      return "text-red-600 font-semibold";
    case "high":
      return "text-orange-600 font-semibold";
    case "good":
      return "text-green-600";
    case "neutral":
      return "text-foreground";
  }
}

/**
 * 「低」「高」の短いバッジラベル。危険域のみに表示する。
 * (Dashboard.tsx のインライン判定 / Logbook.tsx の getGlucoseLabel の統合後継)
 */
export function getGlucoseStatusLabel(
  value: number | null | undefined,
  range?: GlucoseRange
): "低" | "高" | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const status = getGlucoseStatus(value, range ?? getUserGlucoseRange());
  if (status === "low") return "低";
  if (status === "high") return "高";
  return null;
}

/**
 * Dashboard 7日間カレンダーの day-dot 背景色クラス。
 * (Dashboard.tsx の旧 getDayDotStyle の統合後継)
 */
export function getDayDotColorClass(
  hasRecord: boolean,
  avgGlucose: number | null,
  isToday: boolean,
  range?: GlucoseRange
): string {
  const ring = isToday ? "ring-2 ring-primary ring-offset-1 " : "";
  if (!hasRecord) return ring + "bg-muted text-muted-foreground";
  if (avgGlucose === null) return ring + "bg-primary text-primary-foreground";

  const status = getGlucoseStatus(avgGlucose, range ?? getUserGlucoseRange());
  switch (status) {
    case "low":
      return ring + "bg-red-500 text-white";
    case "high":
      return ring + "bg-orange-400 text-white";
    case "good":
      return ring + "bg-green-500 text-white";
    case "neutral":
      // デフォルト設定 (70-180) では到達しない (good の範囲が危険域境界と同一のため)。
      // 目標範囲をカスタマイズした場合のみ表示される新しい状態。
      return ring + "bg-gray-400 text-white";
  }
}
