/**
 * storage-utils
 * localStorage の JSON.parse は不正値で SyntaxError を投げる。
 * これを未捕捉のまま走らせると最寄りの ErrorBoundary で fallback UI に
 * フォールバックしてしまうため、安全な統一ラッパを提供する。
 *
 * 採用方針:
 * - parse 失敗時は console.warn してから当該キーを削除し、fallback を返す
 * - set 失敗時 (Quota Exceeded など) は console.warn して false を返す
 * - SSR / window 不在環境での guard も含める
 */

const isLocalStorageAvailable = (): boolean => {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
};

export function safeParseLocalStorage<T>(key: string, fallback: T): T {
  if (!isLocalStorageAvailable()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch (err) {
    console.warn(`Failed to parse localStorage["${key}"]:`, err);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore - 既に書込不能なら次の getItem で null が返るだけ
    }
    return fallback;
  }
}

export function safeSetLocalStorage(key: string, value: unknown): boolean {
  if (!isLocalStorageAvailable()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`Failed to write localStorage["${key}"]:`, err);
    return false;
  }
}

/**
 * safeGetLocalStorage
 * 値を文字列のまま欲しい場合のラッパ。getItem 自体は通常例外を投げないが、
 * SSR/window 不在ケースの統一窓口としてエクスポートしておく。
 */
export function safeGetLocalStorage(key: string, fallback: string | null = null): string | null {
  if (!isLocalStorageAvailable()) return fallback;
  try {
    const v = window.localStorage.getItem(key);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

/**
 * safeSetLocalStorageString
 * 文字列を JSON.stringify せずに直接書き込む (シンプルな string 値用)。
 */
export function safeSetLocalStorageString(key: string, value: string): boolean {
  if (!isLocalStorageAvailable()) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.warn(`Failed to write localStorage["${key}"]:`, err);
    return false;
  }
}
