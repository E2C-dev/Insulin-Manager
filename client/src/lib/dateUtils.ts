import { subDays } from "date-fns";
import { formatJstDate, safeFormat } from "@/lib/date-utils";

/**
 * client/src/lib/dateUtils.ts (作業5-2)
 *
 * Entry.tsx 内で繰り返されていた下記3パターンを切り出したユーティリティ:
 *   - formatJstDate(new Date())                          → getTodayStr()
 *   - format(subDays(new Date(), 1), "yyyy-MM-dd")        → getYesterdayStr()
 *   - safeFormat(dateStr, "M月d日", dateStr)               → formatJaDate(dateStr)
 *
 * 既存の client/src/lib/date-utils.ts (safeFormat / safeParseDate /
 * formatJstDate 等の低レベルユーティリティ) はそのまま維持し、本ファイルは
 * その上に構築する薄いラッパー。
 */

/** JST基準の「今日」を YYYY-MM-DD で返す。 */
export function getTodayStr(): string {
  return formatJstDate(new Date());
}

/** JST基準の「昨日」を YYYY-MM-DD で返す。 */
export function getYesterdayStr(): string {
  return formatJstDate(subDays(new Date(), 1));
}

/**
 * 日付文字列を「M月d日」形式に整形する。不正な日付の場合は入力値をそのまま返す
 * (safeFormat のフォールバック方針を踏襲し、ホワイトアウトを防ぐ)。
 */
export function formatJaDate(dateStr: string): string {
  return safeFormat(dateStr, "M月d日", dateStr);
}
