# Service Worker 導入見送り判断 (2026-05-04)

## 結論

Service Worker (SW) / PWA フル対応は **当面導入しない**。

## 背景

- ホワイトアウト Audit (`audit/specs/whiteout_bug_audit.md` WA-PRE-002) で
  「後追い導入時に `skipWaiting` 誤実装で古いタブが新HTMLを要求 →
  古いSWキャッシュの古いHTMLでホワイトアウト」というアンチパターンを認識。
- 1型糖尿病管理という性質上、ホワイトアウトは即「インスリン未投与のリスク」に
  直結するため、SWによる難解なキャッシュバグを抱えるコストは正当化できない。
- 現状はマニフェスト + apple-touch-icon のみ (Sprint 1 S1-3 で対応済) で
  「ホーム画面追加できる Web アプリ」レベルに留める。
- Neon DB のサーバーレス + Express 構成では、HTML は CDN 経由ではなく
  Replit デプロイから直接配信されるため、SWなしでもキャッシュ事故は起きにくい。

## 導入時のチェックリスト（先出し）

将来 SW を導入する場合は最低限以下を実装すること:

1. **`self.skipWaiting()` は必ずユーザー明示操作経由**
   (「更新があります — 再読み込み」ダイアログを出してからのみ呼ぶ)
2. **Workbox / vite-plugin-pwa を使う**。手書きSWは禁止
3. **キャッシュ戦略**:
   - HTML = `network-first`（古い HTML を絶対に出さない）
   - JS/CSS = `stale-while-revalidate`（ハッシュ付きなのでキャッシュOK）
4. **旧バージョンのキャッシュ削除を `activate` イベントで確実に実施**
5. **`navigator.serviceWorker.controller` 変更時に `window.location.reload()`** を
   フックで張り、古いタブを救済
6. **デプロイ後の Playwright e2e で確認**:
   「古いタブから新ハッシュアセットを要求 → 200 が返る」を必ず自動テスト化
7. **オフライン挙動の SLA を明文化**:
   インスリン記録の保存はオフラインでバッファするのか落とすのか、
   ユーザーに「同期失敗」の表示が必須か等

## 現在の代替策

- `client/src/lib/queryClient.ts` の `staleTime: Infinity` で
  ネットワーク不要な再描画はキャッシュから返す（メモリキャッシュ）
- 認証・記録・サーバ通信が前提なので、完全オフライン対応は仕様外
- 「ホーム画面追加」は `client/public/manifest.webmanifest` + apple-touch-icon で実現

## 関連

- WA-PRE-002 (`audit/specs/whiteout_bug_audit.md` セクション3)
- Sprint 1 S1-3 (`apple-touch-icon`, `manifest.webmanifest` 整備)
- Sprint 3 自己評価: `audit/reports/sprint_3_self_review.md`
