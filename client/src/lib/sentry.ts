/**
 * Sentry 遅延初期化ラッパー (Sprint 4 / S4-1)
 *
 * 設計方針:
 *  - VITE_SENTRY_DSN env が無ければ完全 no-op (本番でも DSN 未設定なら一切ロードされない)
 *  - DSN がある時のみ動的 import で @sentry/react を取得
 *    → entry chunk に Sentry が混ざらず、初期 bundle サイズへの影響ゼロ
 *  - captureException も同じく動的 import + 未初期化なら no-op
 *  - cross-origin script で event.exception が空のものは beforeSend で破棄
 *    (WA-PRE-003 / Sprint 1 の window.onerror で扱った null event 対策と同方針)
 *
 * 使い方:
 *   import { initSentryIfConfigured, captureException } from "./lib/sentry";
 *   initSentryIfConfigured();          // fire-and-forget で起動時に呼ぶ
 *   captureException(err, { foo: 1 }); // 任意の場所で呼んで OK (未初期化なら何もしない)
 */

let initialized = false;
let initInFlight: Promise<void> | null = null;

export async function initSentryIfConfigured(): Promise<void> {
  if (initialized) return;
  if (initInFlight) return initInFlight;

  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) {
    // env 未設定: no-op で終了 (動的 import すら走らせない)
    return;
  }

  initInFlight = (async () => {
    try {
      const Sentry = await import("@sentry/react");
      Sentry.init({
        dsn,
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0.1,
        beforeSend(event) {
          // cross-origin null event を filter (WA-PRE-003 / Sprint 1 同方針)
          const firstException = event.exception?.values?.[0];
          if (!firstException?.value) return null;
          return event;
        },
      });
      initialized = true;
      console.log("[sentry] initialized");
    } catch (err) {
      console.warn("[sentry] init failed:", err);
    } finally {
      initInFlight = null;
    }
  })();

  return initInFlight;
}

export async function captureException(
  err: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  if (!initialized) return;
  try {
    const Sentry = await import("@sentry/react");
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    // Sentry 自体が落ちてもアプリには影響させない
  }
}

export function isSentryInitialized(): boolean {
  return initialized;
}
