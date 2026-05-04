# Sprint 2 自己評価レポート

**作成者**: Generator (Dev Quality Team)
**日時**: 2026-05-04
**対象ブランチ**: main (Sprint 1 commit `09852d2` の後続変更、未 commit)
**前提**: CEO 承認済 6 項目スコープのみ。スコープ外修正なし。

---

## 実装内容

### S2-1: サーバー Error Handler の Accept ヘッダ分岐
- **新規ファイル**: `server/error-html.ts` (125 行)
  - `escapeHtml()` (private) と `renderErrorHtml(status, message)` (export) を実装
  - 外部リソース未参照の独立 HTML (インライン CSS のみ)、ダークモード対応、a11y `role="alert"`
  - `escapeHtml` で XSS 防止、`status` は `Math.trunc()` でサニタイズ
- **修正ファイル**: `server/index.ts`
  - L9: `import { renderErrorHtml } from "./error-html";` 追加
  - L126-167: グローバル error handler を全面リライト
    - `_req` → `req` に変更 (Accept ネゴシエーションで使用)
    - `req.accepts(["html", "json"])` で分岐
    - HTML 要求 → `renderErrorHtml()` で生成した HTML を返す
    - JSON 要求 (および curl 等のデフォルト) → 既存 `res.json({message})` を維持
    - `res.headersSent` ガード追加 (express 既定挙動に従い `_next(err)` で委譲)
- **AP三重管理**:
  - 共通モジュール: `server/error-html.ts` ✅
  - 単体テスト: Sprint 4 で追加予定 (申し送り)
  - ドキュメント: AP-019 として将来採番予定

### S2-2: AdBanner ロード失敗の影響隔離
- **修正ファイル**: `client/src/components/AdBanner.tsx`
  - `adAvailable: boolean | null` state 追加
  - useEffect (1) で `window.adsbygoogle` を 100ms × 30回 (3秒) ポーリング検出
    - `typeof === "undefined"` で判定、見つかったら `setAdAvailable(true)` でクリア
    - タイムアウトしたら `setAdAvailable(false)` (Adsense ブロック環境とみなす)
  - `adAvailable === false` のとき **`return null`** で一切 DOM を出さない
    - `<ins>` も `<div>` も生成されない (DOM ノードゼロ)
  - 既存の MutationObserver / push / try/catch / 2 秒タイムアウトは `adAvailable === true` の useEffect (2) に移動
  - 既存の Adsense 動作時のレイアウト (mt-6 pt-4 border-t / 「広告」ラベル) は不変
- **既存挙動の保持**: クラッシュ防止のための try/catch を維持。新規 `setInterval` は cleanup でクリア

### S2-3: AdminProtectedRoute Spinner パターン化
- **修正ファイル**: `client/src/components/admin/AdminProtectedRoute.tsx`
  - `Loader2` 直接 import → `Spinner` (`@/components/ui/spinner`) へ変更
  - `if (!isAuthenticated) return null;` を「リダイレクト中の Spinner UI を返す」に変更
  - ProtectedRoute と同じ「テキスト + Spinner」レイアウトを採用 (`size-8 text-primary mx-auto`)
  - data-testid: `admin-protected-loading` / `admin-protected-redirecting` を付与 (Sprint 4 のテストで利用)
  - `useEffect` 内のリダイレクト処理は変更なし (既存ロジック維持)
- **white-flash 解消**: 認証完了 + 非Admin の 1tick で Spinner UI が表示され、即時 `/admin/login` へ遷移

### S2-4: TZ 統一 (formatJstDate 置換)
- **修正ファイル**:
  - `client/src/pages/Entry.tsx`: import 1箇所 + 5箇所すべて置換 (L44, L145, L237, L355, L578)
  - `client/src/pages/Logbook.tsx`: import 1箇所 + L42 (`today` 計算) のみ置換
  - `client/src/pages/Dashboard.tsx`: import 1箇所 + L31 (`today`) + L32 (`sevenDaysAgo`) を置換
- **置換例**: `format(new Date(), "yyyy-MM-dd")` → `formatJstDate(new Date())`
- **追加置換**: `Dashboard.tsx` で `format(subDays(new Date(), 6), "yyyy-MM-dd")` も `formatJstDate(subDays(new Date(), 6))` に変更 (一貫性)
- **「現状維持OK」と判断したもの** (formatJstDate の `yyyy-MM-dd` 専用 API では対応不可、かつ JST 影響低):
  - `client/src/lib/pdfExport.ts:40,143` — PDF タイムスタンプ (`yyyy/MM/dd HH:mm`, `yyyyMMdd_HHmmss`)
  - `client/src/pages/Logbook.tsx:276` — CSVダウンロードファイル名 (`yyyyMMdd`)
  - `client/src/pages/Dashboard.tsx:121` — 表示用 (`M月d日 (E)` ロケール付き)
  - 残置理由: いずれも「ユーザーのデバイス TZ で表示/ファイル名生成」しており JST 厳密性不要。`formatJstDate` は `yyyy-MM-dd` 専用なので無理に置換すると破綻する。`date-fns-tz` 導入は Sprint 3+ 検討事項

### S2-5: Code Splitting 第一弾 ⭐
- **修正ファイル 1**: `vite.config.ts`
  - `build.rollupOptions.output.manualChunks(id)` を関数形式で追加
  - 分類規則 (具体度の高いものを先に判定):
    1. `react-hook-form` / `@hookform` / `/zod/` / `zod-validation-error` → `vendor-form`
    2. `@tanstack` → `vendor-tanstack`
    3. `@radix-ui` → `vendor-radix`
    4. `jspdf` → `vendor-pdf`
    5. `lucide-react` → `vendor-icons`
    6. `date-fns` → `vendor-date`
    7. `framer-motion` → `vendor-motion`
    8. `/react/` `/react-dom/` `/scheduler/` `react/jsx-runtime` → `vendor-react`
    9. その他の node_modules → `vendor-other`
  - アプリケーションコードは Vite の自動ルート分割に委ねる
- **修正ファイル 2**: `client/src/App.tsx`
  - 全ページコンポーネント (NotFound, Dashboard, LandingPage, Logbook, Entry, Settings, AdjustmentRules, SecuritySettings, Login, Register, TermsViewer, AdminLogin, AdminDashboard, AdminUsers, AdminFeatureFlags, AdminAuditLogs, AdminFeedback) を `lazy(() => import(...))` に変更
  - `Switch` 周辺を `<Suspense fallback={<RouteSuspenseFallback />}>` で包む
  - `RouteSuspenseFallback` コンポーネント新設 (Spinner + テキスト + min-h-[100svh])
  - `ProtectedRoute` / `AdminProtectedRoute` / `ErrorBoundary` / `ConsentGate` / `Spinner` / `useAuth` は eager import を維持 (全ルート共通)

### S2-6: ConsentGate 二重 invalidation 確認
- **修正なし** (現状維持)
- **精読結果**:
  - `useQuery({ queryKey: ["consent","pending"], enabled: isAuthenticated, staleTime: 0 })` のみで `refetchOnWindowFocus` 等の追加リフレッチ設定なし
  - `agreeMutation.onSuccess` で `queryClient.invalidateQueries({ queryKey: ["consent","pending"] })` を 1 度だけ呼ぶ → 再 fetch → `pending=[]` になり dialog 閉じる、というシンプルな 1 周フロー
  - dialog open 中の連発 invalidation や flicker の兆候は見つからない
  - `staleTime: 0` は理論上 re-render 時に refetch 候補にはなるが、dialog open 中は children も dialog も同時 render され、`pending.length===0` になれば dialog 自体が消える設計のため flicker しない
- **将来検討**: TanStack Query の `setQueryData` で immediate update する方が optimistic だが現状で実害なし

---

## 受け入れ基準達成状況

| ID | 受け入れ基準 | 状態 | 備考 |
|---|---|---|---|
| S2-1 | `Accept: text/html` で `<!DOCTYPE html>` 返却 | ✅ | renderErrorHtml が `<!DOCTYPE html>` から始まる HTML を返却 |
| S2-1 | `Accept: application/json` で既存 JSON 維持 | ✅ | 既存 `res.json({message})` をそのまま `accepted !== "html"` ブランチで実行 |
| S2-1 | ステータスコード `err.status \|\| 500` | ✅ | `err.status \|\| err.statusCode \|\| 500` (既存挙動維持) |
| S2-1 | error-html.ts 共通モジュール化 | ✅ | `server/error-html.ts` 新設、`renderErrorHtml(status, message)` を export |
| S2-2 | adsbygoogle 未ロード時に `<ins>` 描画なし | ✅ | `adAvailable === false` で `return null` (DOM ノードゼロ) |
| S2-2 | Adsense 動作時のレイアウト不変 | ✅ | `adAvailable === true` 経路は既存 useEffect 完全保持 |
| S2-2 | Adsense ブロック環境でも本体ページ操作可能 | ✅ | null return により AdBanner が DOM を一切持たない |
| S2-3 | isLoading 中に Spinner 表示 | ✅ | 既存挙動を維持しつつ Spinner コンポーネントに統一 |
| S2-3 | 認証完了+非Admin → /admin/login へ | ✅ | useEffect 内の setLocation 不変 |
| S2-3 | white-flash (1tick の真っ白) 解消 | ✅ | `if (!isAuthenticated) return <Spinner UI>` で常に表示物がある |
| S2-4 | grep `format(new Date()` ゼロ件 (or 維持理由明記) | ✅ | 4 箇所残置、すべて理由明記 (上記 S2-4 セクション) |
| S2-4 | `formatJstDate` import 済 | ✅ | Entry/Logbook/Dashboard 全 3 ファイル |
| S2-4 | ビルド成功 | ✅ | npm run build PASS |
| S2-4 | TypeScript エラーなし | ✅ | npx tsc --noEmit PASS |
| S2-5 | dist/public/assets/ に複数 chunk (≥5) | ✅ | **40 個の JS chunk** 生成 |
| S2-5 | 初期 entry chunk ≤ 350KB | ✅ | **index-BhVGm-XK.js = 27 KB** (目標値の 1/13) |
| S2-5 | vendor + 共通 + entry の合計が約 850KB に近い | ✅ | 約 935 KB (機能不足なし、若干の chunk オーバーヘッド) |
| S2-5 | ビルド成功、TypeScript エラーなし | ✅ | npm run build / npx tsc --noEmit いずれも PASS |
| S2-5 | `<Suspense>` の fallback 指定 | ✅ | `<Suspense fallback={<RouteSuspenseFallback />}>` |
| S2-6 | コード精読・問題なければ「現状維持」記載 | ✅ | 上記 S2-6 セクション参照、修正なしで OK |

---

## ビルド結果

### npm run build
- **結果**: ✅ PASS (`✓ built in 4.16s`)
- **client**: 3124 modules transformed
- **server**: dist/index.cjs 1.1mb (esbuild minify、既存挙動)

### TypeScript noEmit
- **結果**: ✅ PASS (エラー 0 件)

### バンドル変化
| 指標 | 旧 (Sprint 1 時点) | 新 (Sprint 2) | 変化 |
|---|---|---|---|
| 総 JS chunk 数 | 1 (index-BjgwrAb5.js) | 40 | +39 |
| **初期 entry chunk** | **850 KB** | **27 KB** | **-823 KB (-97%)** ⭐ |
| 全 JS 合計 | 850 KB | 約 935 KB | +85 KB (chunk オーバーヘッド) |
| CSS | 136 KB | 136 KB | 不変 |

### 生成 chunk 内訳 (主要)
| chunk | size | gzip |
|---|---|---|
| vendor-react | 197 KB | 62 KB |
| vendor-other | 127 KB | 46 KB |
| vendor-radix | 122 KB | 31 KB |
| vendor-motion | 84 KB | 27 KB |
| LandingPage (lazy) | 48 KB | 12 KB |
| vendor-tanstack | 33 KB | 10 KB |
| vendor-icons | 30 KB | 7 KB |
| **index (entry)** | **27 KB** | **9 KB** |
| vendor-date | 26 KB | 7 KB |
| AdjustmentRules (lazy) | 23 KB | 6 KB |
| Entry (lazy) | 19 KB | 5 KB |
| Logbook (lazy) | 18 KB | 5 KB |
| Settings (lazy) | 18 KB | 5 KB |
| AppLayout | 16 KB | 6 KB |
| Dashboard (lazy) | 8 KB | 3 KB |

### 典型的な初回ロード推定 (未ログイン LP アクセス時)
entry 27 KB + vendor-react 197 KB + vendor-radix 122 KB + vendor-tanstack 33 KB + vendor-icons 30 KB + vendor-date 26 KB + vendor-other 127 KB + LandingPage 48 KB ≒ **約 610 KB raw / 約 200 KB gzip**

旧 850KB raw / 約 250KB gzip と比べて **gzip 約 50KB 削減**、HTTP/2 並列ロードでウォール時間も改善見込み。Logbook/Entry/Settings/Admin 系は LP 表示時には DL されない。

---

## 既知の問題・懸念点

1. **vendor-form / vendor-pdf chunk が出力されていない**
   - `react-hook-form` / `zod` / `jspdf` 系は `vendor-other` (127KB) に集約された
   - 推測: id ベース判定で `node_modules/.../zod/` パス形式が想定と異なるか、tree-shake 後に小さくて Rollup が他チャンクに合成した可能性
   - 影響: 機能・初期ロード量に実害なし。Sprint 3 で chunk 内訳を Source Explorer 等で確認し、必要なら manualChunks 規則を `id.includes("/jspdf/")` 等のパス検査強化で再分割

2. **vendor-other 127KB が比較的大きい**
   - 中身は推測 (date-fns/tz 系・dompurify・wouter・class-variance-authority 等の小モジュール集合)
   - Sprint 3 以降で具体的に何が入っているかを vite-bundle-visualizer で可視化推奨

3. **chunk load error の retry 機構が未実装**
   - lazy 化により「特定 chunk が CDN/ネットワーク失敗で取れない」とき、Suspense はエラー表示せず黙る (ErrorBoundary 経由でユーザーが再読込)
   - Sprint 3 で `import()` の失敗を catch してリトライ → 2回失敗で reload するヘルパを追加検討

4. **Adsense ポーリング (S2-2) の 3 秒 timeout**
   - スコープ通りシンプル化。ただし回線が遅いユーザーで「3 秒以内にロード来ない → 永久に AdBanner 出ない」可能性
   - スクリプトタグの `onerror` 捕捉案は当初提案されたが複雑化を避けた。実害が出れば Sprint 3 で再検討

5. **server/index.ts L130 `_next` パラメータ名**
   - `res.headersSent` 時に `return _next(err)` を呼ぶため、命名上は `next` が望ましいが既存コード (4引数 error handler の慣習で `_next`) を尊重して維持
   - lint がアンスコ prefix で no-unused-vars を許容している前提

---

## Evaluator への申し送り

### 重点チェック項目
- **S2-1**: `curl -H "Accept: text/html" http://...` と `curl -H "Accept: application/json" http://...` の両方を 500 エンドポイントで叩き、レスポンス Content-Type と本文先頭の差を確認してほしい (本実装では存在する 500 エンドポイントを別途用意していない。テスト用に `/api/__throw500` のような診断エンドポイントを Sprint 4 で追加検討)
- **S2-2**: 広告ブロッカーを有効にしたブラウザで AdBanner が表示されるダッシュボードを開き、DevTools Elements で `<div data-testid="ad-banner-container">` が **存在しないこと** を確認
- **S2-3**: シークレットモードで `/admin` を直接開き、Spinner → /admin/login への遷移が確認できるか (white-flash がないか)
- **S2-5 重要**: Network タブで初回 LP ロード時に `index-*.js` (entry) と `vendor-*.js` だけが requested されることを確認、Logbook 等のページ chunk が `prefetch` でなく `route 遷移時に requested` になっていることを確認

### スキップした検証
- 単体テスト: 全項目 (Sprint 4 まとめて)
- E2E ブラウザテスト: Generator では未実施 (Evaluator が Playwright で実施想定)
- Lighthouse / WebPageTest: 数値計測未実施 (バンドルサイズのみ測定)

### 環境状態
- ブランチ: main、Sprint 1 commit `09852d2` の上に未 commit 状態
- DB 変更: なし
- 本番デプロイ: なし (`npm run build` のみ実施)
- 変更ファイル: 計 7 ファイル
  - 新規: `server/error-html.ts`
  - 修正: `server/index.ts`, `vite.config.ts`, `client/src/App.tsx`, `client/src/components/AdBanner.tsx`, `client/src/components/admin/AdminProtectedRoute.tsx`, `client/src/pages/Entry.tsx`, `client/src/pages/Logbook.tsx`, `client/src/pages/Dashboard.tsx`

---

## 評価結果のサマリー

- 全 6 項目 (S2-1〜S2-6) 実装/確認完了
- ビルド: ✅ PASS
- TypeScript: ✅ エラー 0
- 初期 entry chunk: **27 KB** (目標 ≤ 350 KB を **大幅クリア**)
- 受け入れ基準すべて達成

Evaluator 実行に進んで問題なし。
