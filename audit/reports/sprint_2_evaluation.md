# Sprint 2 評価レポート

**評価者**: Evaluator (Dev Quality Team)
**日時**: 2026-05-04
**対象**: Insulia Sprint 2 (S2-1〜S2-6)
**評価基準**: `audit/specs/whiteout_bug_audit.md` セクション4・5
**Generator 自己評価**: `audit/reports/sprint_2_self_review.md`

---

## 総合判定: PASS

全 6 項目すべてが受け入れ基準を満たしている。Sprint 1 リグレッションなし。
特に S2-5 (Code Splitting) で初期 entry chunk が **27 KB** (閾値 350 KB の 1/13) と圧倒的に達成。

---

## 評価詳細

| カテゴリ | 結果 | 詳細 |
|---|---|---|
| 機能完全性 | PASS | 6/6 (S2-1〜S2-5 達成、S2-6 SKIPPED 妥当性確認済) |
| 初期 entry chunk ≤ 350KB | PASS | 実測 **26,960 B (約27 KB)** / 閾値 350KB |
| ビルド | PASS | `npm run build` ✓ built in 4.26s (3124 modules transformed) |
| TypeScript | PASS | `npx tsc --noEmit` エラー 0 件 |
| Sprint 1 リグレッション | PASS | S1-1〜S1-5 全て維持 |
| chunk 分割質 | PASS | JS chunk 数 38、vendor 7種 (react/other/radix/motion/tanstack/icons/date) + lazy ページ chunks |
| HTML refs 整合性 | PASS | index.html 参照 7 ファイル全て dist/public/assets/ に実在 |

---

## 各 S2 項目の検証結果

### S2-1: サーバー Error Handler の Accept ヘッダ分岐

- `server/error-html.ts` 新設 (125行)、`renderErrorHtml(status, message)` を export
- `escapeHtml()` で XSS 防止 (`& < > " '` 全エンティティ化)、`Math.trunc()` で status サニタイズ
- HTML は `<!DOCTYPE html>` から始まる完結 (外部リソース参照なし、インライン CSS のみ、a11y `role="alert"`)
- ダークモード対応 (`prefers-color-scheme`)、viewport-fit=cover メタ
- `server/index.ts` L126-167 で Accept ネゴシエーション
  - `req.accepts(["html","json"])` → "html" なら HTML、それ以外 (curl 等) は既存 JSON 維持
  - `res.headersSent` ガード → `_next(err)` で express 既定挙動に委譲
  - status code: `err.status || err.statusCode || 500` (既存挙動維持)
- **判定**: PASS

### S2-2: Adsense ロード失敗の影響隔離

- `client/src/components/AdBanner.tsx`:
  - `adAvailable: boolean | null` state 追加
  - 100ms × 30回 = 3秒のポーリングで `window.adsbygoogle` 検出
  - `adAvailable === false` → `return null` (DOM ノードゼロ、`<ins>` も `<div>` も生成されない)
  - Adsense 動作時のレイアウト (mt-6 pt-4 border-t / 「広告」ラベル) は完全保持
- 既存 try/catch 維持 (push 失敗時の防御)、`setInterval` cleanup あり
- **判定**: PASS

### S2-3: AdminProtectedRoute Spinner パターン統一

- `Loader2` 直接 import → `Spinner` (`@/components/ui/spinner`) に統一
- `if (!isAuthenticated) return null;` を Spinner UI 返却に変更
- ProtectedRoute (BUG-006 fix) と同等パターン:
  - 両方とも `min-h-[100svh] flex items-center justify-center` + 中央 Spinner + 説明テキスト
  - 両方とも `useEffect` 内で setLocation (副作用分離)
  - data-testid 付与: `admin-protected-loading` / `admin-protected-redirecting` / `protected-redirecting`
- white-flash (1tick の真っ白) 解消: 認証完了 + 非Admin 時に Spinner UI 表示
- **判定**: PASS

### S2-4: TZ 統一 (formatJstDate 置換)

- 残存 `format(new Date()` 件数: **4 件**
- 各残置箇所の妥当性:
  - `client/src/lib/pdfExport.ts:40` → PDF 内タイムスタンプ (`yyyy/MM/dd HH:mm`) → ファイル名・表示用、JST固定不要 → **妥当**
  - `client/src/lib/pdfExport.ts:143` → PDFファイル名 (`yyyyMMdd_HHmmss`) → ファイル名 → **妥当**
  - `client/src/pages/Logbook.tsx:276` → CSVダウンロードファイル名 (`yyyyMMdd`) → ファイル名 → **妥当**
  - `client/src/pages/Dashboard.tsx:121` → 表示用 (`M月d日 (E)` ロケール付き) → ロケール表示用、JST固定不要 → **妥当**
- `formatJstDate` 置換状況:
  - Entry.tsx: 5箇所すべて置換 (L44/L145/L237/L355/L578)
  - Logbook.tsx: L42 (`today` 計算) 置換
  - Dashboard.tsx: L31 (`today`) + L32 (`sevenDaysAgo`) 置換
- 「核心的な今日の日付計算」はすべて `formatJstDate` 化、海外 TZ ユーザーで「今日の記録なし」問題解消
- **判定**: PASS

### S2-5: Code Splitting (最重要)

- `vite.config.ts` の `manualChunks(id)` 関数定義 (順序: 具体度高→低)
- `client/src/App.tsx` で 17 ルートを `lazy(() => import(...))` 化、`<Suspense fallback={<RouteSuspenseFallback />}>` で包む
- RouteSuspenseFallback コンポーネント: min-h-[100svh] + Spinner + テキスト
- ProtectedRoute / AdminProtectedRoute / ErrorBoundary / ConsentGate / Spinner / useAuth は eager import 維持

**ビルド結果実測**:

| 指標 | 実測値 |
|---|---|
| **entry chunk** (`index-BhVGm-XK.js`) | **26,960 B (約27 KB)** |
| chunk 総数 (JS) | 38 |
| chunk 総サイズ (JS) | 868 KB (gzip 概算 250 KB 程度) |
| 最大 chunk | vendor-react 197KB → gzip 62KB |

**生成された vendor chunks**:
- vendor-react (197 KB), vendor-other (127 KB), vendor-radix (122 KB), vendor-motion (84 KB), vendor-tanstack (33 KB), vendor-icons (30 KB), vendor-date (26 KB)

**HTML refs 整合性チェック (node スクリプト実行結果)**:
```
refs: [
  '/assets/index-BhVGm-XK.js',         OK
  '/assets/vendor-other-B7AQg7UH.js',  OK
  '/assets/vendor-react-CYohCLlY.js',  OK
  '/assets/vendor-tanstack-BuCu_eOR.js', OK
  '/assets/vendor-radix-BKLar88P.js',  OK
  '/assets/vendor-icons-C38aObEx.js',  OK
  '/assets/index-XtVVFBhu.css'         OK
]
```
全 7 refs 実在 (missing なし)。

**vendor-form / vendor-pdf 不在の真因 (Generator 懸念事項の Evaluator 解明)**:
- `react-hook-form` を import しているのは `client/src/components/ui/form.tsx` の 1 ファイルのみ
- `client/src/components/ui/form.tsx` を import している箇所が**ソース全体で 0 件**
- 同様に `jspdf` を import しているのは `client/src/lib/pdfExport.ts` のみ、これも**呼び出し元 0 件**
- → Rollup の tree-shaking で完全に dead code として除外され、`vendor-form` / `vendor-pdf` chunk は emit されなかった
- ビルドチャンクを `grep "jsPDF\|autoTable"` でも 0 ヒット (vendor-react の "useForm" は別物の文字列マッチ)
- **結論**: vendor-form/vendor-pdf 不在は**正しい挙動**、機能不足ではない。むしろ Sprint 3 で `pdfExport.ts` / `components/ui/form.tsx` の dead code 整理を提案

- **判定**: PASS (entry chunk 27KB << 350KB 閾値、ビルド整合性 OK、vendor 分割 7 種類)

### S2-6: ConsentGate (SKIPPED の妥当性確認)

- Generator は「修正なし、現状維持」と判断。Evaluator がコード精読で検証:
- `useQuery` の設定: `queryKey: ["consent","pending"]`、`enabled: isAuthenticated`、`staleTime: 0`、`refetchOnWindowFocus` 等の追加リフレッシュなし
- `agreeMutation.onSuccess` で `queryClient.invalidateQueries` を **1回のみ** 呼ぶ → 再 fetch → `pending=[]` で dialog 自動クローズ
- dialog は `<Dialog open modal>` で常時 open フラグ、`onInteractOutside` / `onEscapeKeyDown` で閉じれない設計 → 「閉じる」副作用なし
- `pending.length === 0` になれば「未同意なし → そのまま children を表示」分岐に入って dialog 自体が unmount → flicker しない
- **コード読み所感**: 二重 invalidation の経路はコード上存在しない。`staleTime: 0` でも refetch トリガが「window focus」「mount」「invalidate」のみで、open 中の連続 invalidate は発生しない設計
- **判定**: PASS (SKIPPED 妥当)

---

## Sprint 1 リグレッション抜き打ちチェック

| ID | 項目 | 結果 | 証拠 |
|---|---|---|---|
| S1-1 | SPA fallback `/assets/*` 除外 | 維持 | `server/static.ts` の `app.use("*", ...)` 内で `isStaticAssetRequest(req)` blocklist あり、404 返却 |
| S1-2 | process handlers | 維持 | `server/process-handlers.ts` 存在、`server/index.ts` 1行目で `import "./process-handlers"` (最早期 import) |
| S1-3 | viewport-fit=cover | 維持 | `client/index.html` に `viewport-fit=cover` + `apple-mobile-web-app-capable` + `apple-touch-icon` 確認 |
| S1-4 | min-h-screen → 100svh | 維持 | `min-h-screen` grep ヒット **0 件**、`min-h-[100svh]` grep 16 件 |
| S1-5 | recharts 除去 | 維持 | `package.json` に recharts なし、`client/src/components/ui/chart.tsx` 削除済 |
| BUG-006 | ProtectedRoute Spinner | 維持 | `Spinner` import + isLoading/isAuthenticated 両方で UI 表示 |
| ErrorBoundary 2層 | 最外層 + PageBoundary | 維持 | App.tsx の `PageBoundary` 関数 + `ErrorBoundary` クラスコンポーネント存在 |

---

## 発見されたバグ・懸念点

### [BUG-S2-001] dead code: pdfExport.ts / ui/form.tsx
- **重大度**: Low (機能影響なし、コード品質のみ) — ただし**コア機能 (PDF 出力) の見落とし可能性あり、CEO 確認推奨**
- **内容**: `client/src/lib/pdfExport.ts` (jspdf) と `client/src/components/ui/form.tsx` (react-hook-form) はソースコード全体で呼び出し元 0 件。Rollup tree-shaking で正しく除外されているが、依然としてソース上存在
- **影響**: ビルド成果物への影響なし。npm install 時に jspdf/react-hook-form が deps に残るので node_modules サイズ・install 時間に若干影響
- **対応**: Sprint 3 候補。dead code 削除 + package.json から jspdf/react-hook-form 削除を提案
- **AP三重管理候補**: ボーイスカウト的に「import されていない top-level export を CI で検出するルール」を Sprint 4 で検討

### [BUG-S2-002] vendor-form / vendor-pdf chunk が未 emit
- **重大度**: Info (実害なし)
- **真因**: 上記 BUG-S2-001 と同じ。tree-shake されているため当然
- **対応**: Generator が「Sprint 3 で vite-bundle-visualizer で確認」と申し送りしているが、本評価で原因が確定済のため Sprint 3 でのアクションは「dead code 削除」とセット

---

## 改善提案 (Sprint 3 以降への引継ぎ)

1. **lazy chunk load 失敗時のリトライ機構**: 現状 `import()` 失敗で Suspense が黙る。CDN 一時障害でユーザーが再読込必要。`import()` の失敗 catch → 1 回再試行 → 失敗時 reload prompt のヘルパを共通化
2. **vendor-other (127KB) の中身可視化**: `vite-bundle-visualizer` か `rollup-plugin-visualizer` で wouter/dompurify/cva 等の細かい内訳を可視化、必要に応じて追加分割
3. **Adsense ポーリング 3 秒タイムアウト**: 遅い回線でロード失敗扱いになる可能性。`<script onerror>` フックの追加実装で「明確に失敗」を即検知できる
4. **`server/index.ts` の `_next` 命名**: 4引数 error handler 慣習で `_next` だが、実際に使うので `next` に直すべき (lint がアンスコ prefix で no-unused-vars を許容する前提を排除)
5. **TZ 統一の完成形**: `date-fns-tz` 導入で PDF/CSV ファイル名も JST 固定に統一可能 (ただし優先度低)

---

## CEOへの判断要請事項

**dead code 発見の取り扱い**: `pdfExport.ts` (PDF出力機能) / `components/ui/form.tsx` (フォーム共通) が本番ビルドから完全除外されている。本来意図された機能 (PDF出力ボタンなど) が未実装の可能性あり。

- PDF出力は「インスリア」のコア訴求 (`<title>` に「迷わない記録。伝わる共有。」「A4横型PDFで栄養士・医師へすぐに共有」と謳っている) → 未実装か、別実装パスが存在するか要確認
- **CEO 判断要請**: PDF出力機能の現状 (実装中/未実装/別経路) を確認し、Sprint 3 でカバーするかをトリアージ

---

## ジェネレーターへのフィードバック

PASS のため特になし。以下の点で Generator の作業品質が高かった:
- S2-4 で「formatJstDate 専用 API では対応不可」「JST 影響低」を区別し、4箇所を意図的残置 → 評価で全て妥当と判定
- S2-5 で manualChunks の順序設計 (具体度高→低) と eager/lazy 分離が的確
- S2-6 で SKIPPED の判断を文書化、Evaluator が再現的に検証可能
- 自己評価で vendor-form/vendor-pdf 未emit を「未確認懸念」として明示 → Evaluator が原因確定 (dead code) まで持っていけた

---

## commit 推奨

**GO** — このまま commit & 次スプリント着手可。
