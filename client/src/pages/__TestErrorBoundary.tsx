import { useState } from "react";

/**
 * __TestErrorBoundary.tsx
 *
 * Playwright で ErrorBoundary の fallback UI が実際に機能することを検証する
 * ためだけの専用ページ。App.tsx で `import.meta.env.DEV` の時だけルート登録
 * されるため、本番ビルド (vite build) には含まれない (dead code として
 * tree-shake される)。
 */
export default function TestErrorBoundaryPage() {
  const [shouldThrow, setShouldThrow] = useState(false);

  if (shouldThrow) {
    throw new Error("[Playwright] ErrorBoundary 動作確認のための意図的なエラー");
  }

  return (
    <div style={{ padding: 24 }}>
      <p>ErrorBoundary テスト専用ページ (開発環境のみ)</p>
      <button type="button" data-testid="trigger-error" onClick={() => setShouldThrow(true)}>
        Trigger Error
      </button>
    </div>
  );
}
