import { format, isValid } from "date-fns";
import { ja } from "date-fns/locale";

/**
 * safeFormat
 * date-fns の format() は Invalid Date を渡すと RangeError を投げる。
 * 任意のユーザ入力 (date input の "" や "abc" など) を受けても落ちないように
 * isValid チェック + try/catch で必ず文字列を返すラッパ。
 *
 * - date が null/undefined → fallback
 * - 文字列/数値 → new Date() で変換
 * - isValid(d) === false → fallback
 * - format() が例外を投げても fallback
 *
 * デフォルト locale は ja。ロケール上書きが必要な場合は format を直接使うか
 * 将来 options 引数を追加する。
 */
export function safeFormat(
  date: Date | string | number | null | undefined,
  formatStr: string,
  fallback: string = ""
): string {
  if (date == null) return fallback;
  const d =
    typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (!isValid(d)) return fallback;
  try {
    return format(d, formatStr, { locale: ja });
  } catch {
    return fallback;
  }
}

/**
 * safeParseDate
 * ISO/任意の文字列を Date にパース。Invalid Date の場合は fallback を返す。
 * date input の空文字や不正値で new Date() を呼んだ際の Invalid Date 伝播を止める。
 */
export function safeParseDate(
  value: string | null | undefined,
  fallback: Date = new Date()
): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return isValid(d) ? d : fallback;
}
