import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { queryClient } from "./lib/queryClient";
import { initSentryIfConfigured, captureException } from "./lib/sentry";
import { startWebVitalsTracking } from "./lib/web-vitals";

/**
 * 軽量観測性 (Sprint 3 / 観測性タスク + Sprint 4 / S4-1, S4-2, S4-3)
 *
 * Sprint 3: window.onerror / unhandledrejection を console.error で出すフォールバック層を導入。
 * Sprint 4 (S4-1): VITE_SENTRY_DSN がある場合のみ @sentry/react を動的 import で初期化。
 *                  既存の console.error と二重出力にして DevTools / サーバログ双方で追えるようにする。
 * Sprint 4 (S4-2): bfcache (back/forward cache) からの復帰を pageshow で検知し、
 *                  TanStack Query の全クエリを invalidate して fresh データを取り直す。
 * Sprint 4 (S4-3): web-vitals (CLS/LCP/INP/FCP/TTFB) を計測し、poor のみ Sentry に送る。
 *
 * 注: ErrorBoundary (App.tsx 2層) は React tree 内の例外を捕捉するが、
 * 以下のケースは ErrorBoundary では掴めないため window レベルで捕捉する必要がある:
 *  - イベントハンドラ内の例外 (React 18+: 多くは開発時のみ surface)
 *  - setTimeout / setInterval 内の例外
 *  - Promise の .then 連鎖で .catch されなかった rejection
 *  - 動的 import の network 失敗
 */
if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    // event.error は cross-origin script の場合 null になることがある
    const err = event.error ?? new Error(event.message || "Unknown uncaught error");
    console.error("[obs] uncaught error:", err, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
    // Sprint 4 (S4-1): Sentry が初期化済なら送る (未初期化なら no-op)
    captureException(err, {
      kind: "window.onerror",
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("[obs] unhandled promise rejection:", event.reason);
    // Sprint 4 (S4-1): Sentry へ送信 (未初期化なら no-op)
    captureException(event.reason, {
      kind: "unhandledrejection",
    });
  });

  // Sprint 4 (S4-2): bfcache 復帰時に TanStack Query を invalidate
  // ブラウザの戻る/進むで bfcache (back-forward cache) から復帰すると、
  // React コンポーネントは再 mount されないため、stale データがそのまま残ることがある。
  // event.persisted === true は bfcache 由来であることを示す。
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      console.log("[bfcache] page restored, invalidating queries");
      queryClient.invalidateQueries();
    }
  });

  // Sprint 4 (S4-1): Sentry を遅延初期化 (env 未設定なら no-op)
  // fire-and-forget: 起動を遅らせない
  void initSentryIfConfigured();

  // Sprint 4 (S4-3): Web Vitals 計測スタート (動的 import / fire-and-forget)
  void startWebVitalsTracking();
}

createRoot(document.getElementById("root")!).render(<App />);
