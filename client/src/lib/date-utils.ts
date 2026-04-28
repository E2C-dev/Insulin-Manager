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

/**
 * BUG-014: タイムゾーン方針 (2026-04-28 Sprint 3 時点)
 *
 * - 当アプリは国内 1型糖尿病患者向けで、JST 固定運用を前提とする
 * - 内部の format() / safeFormat() は date-fns 標準のローカルタイムゾーンに依存している
 *   (ブラウザ実行環境の TZ が採用される)
 * - 国内ユーザーがデバイスを JST のままで使う限り日付ずれは発生しない
 * - 将来 海外ユーザー対応・サーバ側集計・アラート通知を導入する場合は
 *   `date-fns-tz` の `formatInTimeZone(d, "Asia/Tokyo", ...)` への移行が必要
 *
 * 暫定: 海外 TZ デバイスでも日本日付として扱いたい場合に使うヘルパだけ用意しておく
 * (現時点では UI からは未使用。将来の段階移行用)
 */
const JST_OFFSET_MIN = 9 * 60;

/**
 * jstNow
 * 現在時刻を「JST 表現の Date」として返す。Date 自体は UTC を保持するが、
 * `getFullYear()` 等のローカルメソッドが JST 値を返すようオフセットを適用したもの。
 * 統計集計やキャッシュキー生成等、デバイス TZ に依存させたくない箇所で使う。
 */
export function jstNow(now: Date = new Date()): Date {
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utc + JST_OFFSET_MIN * 60_000);
}

/**
 * formatJstDate
 * JST 基準で `yyyy-MM-dd` 等の文字列を生成する軽量ユーティリティ。
 * date-fns-tz を導入していないため最小限の整形のみサポート。
 */
export function formatJstDate(date: Date | string | number | null | undefined): string {
  if (date == null) return "";
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const j = jstNow(d);
  const y = j.getFullYear();
  const m = String(j.getMonth() + 1).padStart(2, "0");
  const dd = String(j.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
