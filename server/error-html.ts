/**
 * server/error-html.ts
 *
 * エラー時に HTML クライアント (ブラウザ・curl 等で Accept: text/html) へ返す
 * 独立したエラー HTML を生成する共通モジュール。
 *
 * 設計判断:
 *   - 外部リソース (CSS, JS, フォント, 画像) を一切読み込まない (障害時の連鎖を避ける)
 *   - インライン CSS のみで完結
 *   - 国内向けサービスのため日本語メインで、ステータス/メッセージは描画前に
 *     escapeHtml() で必ずサニタイズする (XSS 防止)
 *   - 既存の JSON エラー応答は変更せず、Accept ヘッダで分岐する (server/index.ts 側の責務)
 *
 * 使用箇所: server/index.ts のグローバル error handler
 *
 * AP三重管理:
 *   - 共通モジュール化: 本ファイル
 *   - 単体テスト: Sprint 4 で追加予定
 *   - ドキュメント: AP-019 (将来採番、エラー HTML 一貫表示)
 */

/**
 * HTML 文字列に埋め込んでも安全になるように
 * `& < > " '` を HTML エンティティへエスケープする。
 */
function escapeHtml(input: unknown): string {
  const s = typeof input === "string" ? input : String(input ?? "");
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * renderErrorHtml
 *
 * エラー時のレスポンス本文として返す独立 HTML を生成する。
 *
 * @param status  HTTP ステータスコード (例: 500)
 * @param message エンドユーザに表示するメッセージ。詳細は出さない
 * @returns       <!DOCTYPE html> から始まる完全な HTML 文字列
 */
export function renderErrorHtml(status: number, message: string): string {
  const safeStatus = Number.isFinite(status) ? Math.trunc(status) : 500;
  const safeMessage = escapeHtml(message || "予期せぬエラーが発生しました。");
  const statusLabel = escapeHtml(String(safeStatus));

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>エラー ${statusLabel} - Insulin Manager</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif;
    background: #f9fafb;
    color: #111827;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #111827; color: #f9fafb; }
    .card { background: #1f2937; border-color: #374151; }
  }
  .card {
    max-width: 480px;
    width: 100%;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 32px 24px;
    text-align: center;
  }
  .status {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: #6b7280;
    margin: 0 0 8px;
  }
  h1 {
    font-size: 20px;
    line-height: 1.5;
    margin: 0 0 16px;
  }
  p {
    font-size: 14px;
    line-height: 1.6;
    margin: 0 0 24px;
    color: #4b5563;
  }
  @media (prefers-color-scheme: dark) {
    p { color: #9ca3af; }
  }
  a.button {
    display: inline-block;
    padding: 10px 20px;
    background: #2563eb;
    color: #ffffff;
    border-radius: 8px;
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
  }
  a.button:hover { background: #1d4ed8; }
</style>
</head>
<body>
  <main class="card" role="alert" aria-live="assertive">
    <p class="status">ERROR ${statusLabel}</p>
    <h1>${safeMessage}</h1>
    <p>申し訳ありません。問題が継続する場合は、しばらく時間をおいて再度お試しください。</p>
    <a class="button" href="/">ホームへ戻る</a>
  </main>
</body>
</html>`;
}
