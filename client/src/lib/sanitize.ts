import DOMPurify from "dompurify";

/**
 * sanitizeHtml
 * dangerouslySetInnerHTML に渡す前に必ず通すユーティリティ。
 * BUG-012 対策: 規約本文・将来のリッチテキスト入力など、管理者/ユーザー入力起源の
 * HTML 文字列を XSS フィルタしてから挿入する。
 *
 * 許可しない: <script>, <iframe>, on* イベントハンドラ, javascript: スキーム など
 * 許可する: 一般的な見出し/段落/リスト/インライン強調/リンク (rel="noopener" 強制)
 *
 * NOTE: SSR 環境で window が無い場合 DOMPurify は no-op で空文字を返す。
 * 当該プロジェクトは CSR のみのため実害なし。
 */
export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "br", "hr",
      "strong", "em", "u", "b", "i",
      "ul", "ol", "li",
      "blockquote", "code", "pre",
      "a", "span", "div",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "class", "id"],
    ALLOW_DATA_ATTR: false,
  });
}
