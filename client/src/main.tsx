import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

/**
 * 軽量観測性 (Sprint 3 / 観測性タスク)
 *
 * Sentry SDK 等の本格的な APM は未導入だが、未捕捉エラー / 未処理 Promise rejection を
 * 必ず console に流すことで Replit のサーバログ転送 + 本番ブラウザの DevTools で追跡できる状態にする。
 * 将来 Sentry / Datadog / OpenTelemetry を入れる際は、ここに sendToTelemetry(...) を追加すれば
 * 全ての uncaught error が自動で送信されるようにしておく。
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
    // TODO: Sentry / Datadog 連携時はここで sendToTelemetry({ kind: "error", err, ... })
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("[obs] unhandled promise rejection:", event.reason);
    // TODO: Sentry / Datadog 連携時はここで sendToTelemetry({ kind: "unhandledrejection", reason: event.reason })
  });
}

createRoot(document.getElementById("root")!).render(<App />);
