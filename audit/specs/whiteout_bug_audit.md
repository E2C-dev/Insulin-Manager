# Insulia ホワイトアウト・バグ徹底レビュー & 改善Sprint計画

## 0. エグゼクティブサマリー

- **現状リスク等級**: **Medium-High**
  - **根拠（ポジティブ）**: `B-001`〜`BUG-016` で多数の堅牢化が完了。具体的には ErrorBoundary を 2 層配置（最外層 + ページ単位 `PageBoundary`）、`safeFormat` / `safeParseDate` ユーティリティ統一、`ProtectedRoute` の Spinner フォールバック (BUG-006)、`localStorage` の安全ラッパ統一 (BUG-007)、`getBasalDosesFromPresets` の `useCallback` メモ化 (B-001 根本原因 B)、`window.onerror` / `unhandledrejection` 計装 (74e56ef)。これらにより**典型的な"即ホワイトアウト経路"の大半は塞がれている**。
  - **根拠（ネガティブ）**: しかしモバイル特有のリスクは未対応。`<meta name="apple-mobile-web-app-capable">` `<meta name="viewport-fit=cover">` `<link rel="apple-touch-icon">` `<link rel="manifest">` がいずれも欠落。`min-h-screen` (= `100vh`) を 13 箇所以上で使用し iOS Safari の URL バー高さ問題で**画面下部切れ・初期描画ずれ**を起こしうる。`process.on('uncaughtException')` / `process.on('unhandledRejection')` がサーバ側に未設定でプロセスクラッシュ→Replit 自動再起動中の可用性ホールが残る。Service Worker は未導入のため SW 経由のホワイトアウトは原理的に発生しないが、その代わり**832KB の単一バンドル**全部が初回ロードに必要 → モバイル回線/低速 4G/古い iPhone でロード失敗時の白画面持続時間が長い。

- **ホワイトアウト発生確率の推定（モバイル端末・典型ユーザ・本番ビルド時）**:
  - 即時ホワイトアウト: **〜2-5%**（主に下記主要因 1, 2 由来）
  - 体感的なホワイト時間（>3秒の白画面）: **〜10-20%**（バンドルサイズ + フォントブロッキング由来）

- **ホワイトアウト主要因 TOP 3**:
  1. **iOS Safari の `100vh` 問題と Safe Area 未対応** — `min-h-screen` を全画面コンテナで使用 (`AppLayout`, `ProtectedRoute`, `Login`, `Register`, 他10件超)。iOS Safari ではアドレスバーの分だけ `100vh` が画面より大きくなり、固定ヘッダ/フッタが画面外に出る。さらに `viewport-fit=cover` 未設定なので safe-area 保護が効かない。
  2. **832KB 単一 JS バンドル + 同期実行ブロック** — `dist/public/assets/index-DLPrRpsl.js` が 832K（minified）。code-splitting ゼロ。低速回線/古いiPhone(SE 1st 等) で `<div id="root">` が空のまま長時間ホワイト。さらに `recharts` が完全に未使用なのにバンドル同梱（dead import）で水増しされている。
  3. **Adsense 同期 `<script>` + 第三者ドメイン (`pagead2.googlesyndication.com`) を `async` で `<head>` に挿入** — モバイル広告ブロッカー/学校 WiFi/企業 NW で当該ドメインが TCP RST されると、`async` でも他リソースの帯域を奪い体感ホワイト時間を悪化。さらに `AdBanner` の `useEffect` 中の `(window.adsbygoogle).push({})` は try/catch で防御済みだが、**adsbygoogle.js 自体のロード失敗は ErrorBoundary で捕捉できない**（外部スクリプトの SyntaxError は `window.error` のみ）。

---

## 1. 既存リスク・バグ一覧（発見順）

| ID | 領域 | 重大度 | 概要 | 再現条件 | 根拠ファイル:行 | スマホホワイトアウト直結度 |
|----|------|--------|------|----------|------------------|----------------------------|
| WA-001 | iOS Viewport | High | `<meta name="viewport">` に `viewport-fit=cover` がなく iOS の safe-area が無効 → ノッチ機種でヘッダが切れる/ロード時に画面真っ白の領域が一瞬出る | iPhone X 以降の Safari | `client/index.html:5` | ◎ |
| WA-002 | iOS PWA | Medium | `apple-mobile-web-app-capable` / `apple-touch-icon` / `manifest` 全部欠落 → ホーム追加時の起動が標準ブラウザ Chrome shim になり、最悪 about:blank チラ見せ | iOS にホーム画面追加後、PWA として起動 | `client/index.html` 全体 | ○ |
| WA-003 | iOS 100vh | High | `min-h-screen` を 13 箇所以上で使用、`100dvh`/`100svh` 未使用 → iOS Safari URLバー伸縮で下部見切れ&初回描画時の余白白帯 | iOS Safari (full-screen でない通常タブ) | `client/src/components/layout/AppLayout.tsx:93`、`client/src/components/ProtectedRoute.tsx:24,36`、`client/src/pages/Login.tsx:127,134`、`client/src/pages/LandingPage.tsx:368`、ほか同一grep 13箇所 | ◎ |
| WA-004 | バンドル肥大 | High | `dist/public/assets/index-DLPrRpsl.js` 832KB 単一 chunk、`recharts` (大型) は `chart.tsx` でしか参照されず、その `chart.tsx` 自体がページから未使用 | 低速回線/iPhone SE 1st/Safariキャッシュ無し初回 | `dist/public/assets/index-DLPrRpsl.js`、`client/src/components/ui/chart.tsx:2` (recharts dead import)、`vite.config.ts` (manualChunks 未設定) | ◎ |
| WA-005 | サーバ uncaughtException 未捕捉 | High | `server/index.ts` に `process.on('uncaughtException')` / `process.on('unhandledRejection')` がなく、初期化中の Promise 失敗で Node プロセスが落ちる → Replit 再起動中に SPA HTML が 502/503 → モバイルブラウザは空白タブ | DB pool フェイルオーバー時、長時間アイドル後の Neon 接続切れなど | `server/index.ts` 全体（ハンドラ無し）、`server/db.ts:14` (pool error は console のみ) | ◎ |
| WA-006 | SPA fallback の MIME 罠 | High | `server/static.ts:14` で `app.use("*", ...)` が**全 GET を index.html に返す**ため、CDN/プロキシキャッシュ齟齬で `/assets/index-OLD.js` を要求すると `index.html` が返る → ブラウザは JS として実行→`Unexpected token '<'` SyntaxError → 真っ白 | デプロイ直後にユーザのキャッシュが古い `index.html` を保持、新しいアセットを古いハッシュで要求 | `server/static.ts:14-17` | ◎ |
| WA-007 | サーバ error handler が JSON のみ | Medium | `server/index.ts:128` の error handler は HTML 要求でも `res.json({message})` を返す → SPA fallback の前にヒットすると JSON 文字列が `index.html` の代わりに返り、ブラウザが解釈できずホワイト | `/assets/...` 要求中に上流でエラーが起きた場合 | `server/index.ts:124-129` | ○ |
| WA-008 | Adsense 第三者スクリプト | Medium | `pagead2.googlesyndication.com` を `<head>` で `async` 読み込み。外部 NW ブロックで `window.adsbygoogle` 未定義のまま `AdBanner` が `push` を呼ぶ → try/catch で守ってあるので実害は低いが、**adsbygoogle.js 内部の SyntaxError は ErrorBoundary 外**で `window.onerror` ログのみ | 広告ブロッカー有効、企業/学校 NW、iOS Safari Private | `client/index.html:18`、`client/src/components/AdBanner.tsx:38-43` | △ |
| WA-009 | フォントブロッキング | Medium | Google Fonts (Noto Sans JP + Plus Jakarta Sans + Inter) を `preconnect` のみで `display=swap` 付きで読み込み。`display=swap` 自体は OK だが回線断で `<body>` に何も描画されない時間が長くなる | 海外ローミング、地下鉄、モバイル回線断 | `client/index.html:21` | △ |
| WA-010 | wouter `Switch` の404 | Low | `<Switch>` の最後が `<Route>{NotFound}</Route>` で defensive。OKだが `useRoute` パラメータ欠落時の guard なし | URL に意図しないパスを直接アクセス | `client/src/App.tsx:148` | × |
| WA-011 | `AdminProtectedRoute` の `null` 返却 | Low | 未認証時 `return null` → リダイレクト発火までの 1tick 真っ白。`ProtectedRoute` (BUG-006) と同パターンで未対応 | `/admin/*` 直リンク踏んで未認証 | `client/src/components/admin/AdminProtectedRoute.tsx:30` | ○ |
| WA-012 | TZ 依存の日付比較 | Medium | `format(new Date(), "yyyy-MM-dd")` をクライアントで生成し、サーバ JST 固定 (`formatJstDate` 用意済みだが未適用) と突合。海外端末 TZ ユーザでは Logbook が「今日の記録なし」と空表示 | 海外渡航中ユーザ、デバイス TZ 設定が JST 以外 | `client/src/pages/Dashboard.tsx:31,32`、`client/src/pages/Logbook.tsx:42,96`、`client/src/pages/Entry.tsx:44`、`client/src/lib/date-utils.ts:62-99` (formatJstDate あるが未使用) | △ |
| WA-013 | `useAuth` query 5分staleTime | Low | `staleTime: 5min` でセッション期限切れに気付くまでラグ。期限切れ後の遷移で Spinner→真っ白の連鎖は ProtectedRoute で守られているが、`useAuth` 内 `fetchCurrentUser` が catch して `null` 返却するため OK | 連続 7 日間 アプリ放置後復帰 | `client/src/hooks/use-auth.ts:54-77` | × |
| WA-014 | `getQueryFn({on401:"throw"})` グローバル既定 | Medium | `queryClient.ts:43` の既定 queryFn は 401 を throw する。各ページがこれに乗ると mutation onError には行くが、useQuery の `error` ステートに留まる。ただし `throwOnError: true` を将来 1 箇所でも付けると即 ErrorBoundary fallback に飛び画面真っ白の代わりに Error UI が出る | 将来 throwOnError オプション追加時 | `client/src/lib/queryClient.ts:23-37` | △ |
| WA-015 | `ConsentGate` の認証取得失敗時挙動 | Low | `data?.pending ?? []` で fallback。`isLoading` 中は `<>{children}</>` を返すので白画面にはならない。OK | - | `client/src/components/ConsentGate.tsx:79-82` | × |
| WA-016 | `TermsViewer` のフォールバック表示 | Low | `BUG-017` で fallback テキスト導入済み。OK | - | `client/src/pages/TermsViewer.tsx:11-19` | × |
| WA-017 | `seedAdminUser` 失敗で initDb throw | High | `server/db.ts:43` で initDb 失敗時 throw → `server/index.ts` の top-level await でアプリ起動失敗、ホワイト（HTTP 自体応答せず） | DB マイグレーション中、users テーブル schema 不整合 | `server/db.ts:23-50`、`server/index.ts:120-122` | ◎ |
| WA-018 | Logbook の差分日数計算と range 指定 | Medium | `processEntries` で常に `for (let i = 0; i < days; i++)` を走らせ、`days = 30` 時に毎日 30 件分の Map を構築。 React 19 の StrictMode 二重実行で軽い paint blocking、低スペック端末で paint 遅延 → 体感白 | 旧 Android、月表示切替時 | `client/src/pages/Logbook.tsx:91-105` | △ |
| WA-019 | `Entry.tsx` の自動計算 useEffect 依存に `getInsulinTimingInfo` (object) | Medium | `useMemo` の戻り値を依存に入れているため再生成 → effect 再発火可能性。新フォーム値→ effect → setState→再 memo→ effect の半閉ループ。直前と同値時 setState を skip するガード有 (BUG-001 fix) で実害低 | プリセット切替頻発操作 | `client/src/pages/Entry.tsx:487-537` | △ |
| WA-020 | `unhandledRejection` ログのみで送信なし | Low | `main.tsx` ハンドラは `console.error` のみ。Sentry TODO 残存 | 観測欠落 | `client/src/main.tsx:24-39` | × |

---

## 2. 将来発生しそうなリスク（preventive）

| ID | 領域 | 重大度 | 想定シナリオ | 根拠 |
|----|------|--------|--------------|------|
| WA-PRE-001 | Code Splitting 未導入 | High | 将来ページ追加で 1MB 超え。iOS Safari は `Largest Contentful Paint` 4s 超過で「広告ブロックの誤検知」キャッシュ消去ボタン表示が出る等のリスク | `vite.config.ts` (manualChunks/lazy 未使用) |
| WA-PRE-002 | Service Worker 後追い導入時 | High | 後から PWA 化する際 `skipWaiting` を誤実装すると古いタブで `index-NEW.js` を要求し古い SW がキャッシュした古い HTML を返してホワイト | (現状未導入) |
| WA-PRE-003 | Sentry / Datadog 連携 | Medium | window.onerror で event.error = null (cross-origin) → Sentry に空エラー大量送信 → 重要シグナルがノイズ化 | `client/src/main.tsx:25-32` の TODO |
| WA-PRE-004 | Recharts を実際に使い出す | High | 832KB → 1.2MB へ。chart 描画でモバイル GPU メモリ枯渇 | `package.json:64`、`client/src/components/ui/chart.tsx` |
| WA-PRE-005 | `useSuspenseQuery` 移行時 | High | 既定 `getQueryFn({on401:"throw"})` のまま `useSuspenseQuery` を使うと 401 が ErrorBoundary に escalate → ログイン未済ユーザに即「問題が発生しました」UI | `client/src/lib/queryClient.ts:23-43` |
| WA-PRE-006 | DB pool max 未設定 | Medium | `pg.Pool` のオプション未指定で default = max:10。Replit 同居スレッドで他リクエストとカチ合うと長時間ハングし fetch がタイムアウト→ TanStack Query retry: false なので即 error 状態→ Spinner 出っぱなし | `server/db.ts:11` |
| WA-PRE-007 | Express trust proxy + Cookie secure | Low | `trust proxy:1` + `secure: true` でローカル debug 時に Cookie が来ない罠 | `server/index.ts:13,42` |
| WA-PRE-008 | iOS Safari bfcache pageshow `persisted` | Low | wouter ではフォーム state が bfcache 復帰で残るが、TanStack Query キャッシュも残るのでステイル表示。新規セッションを期待して操作→401 連発 | `client/src/main.tsx` (pageshow 未捕捉) |

---

## 3. AP-XXX 三重管理対応マッピング

| 種別 | 対象 | 提案 |
|------|------|------|
| 共通モジュール化 | iOS viewport meta + safe-area meta + apple-touch-icon + manifest | `client/index.html` の `<head>` テンプレ化、`scripts/build-html.ts` でビルド時注入 |
| 共通モジュール化 | `min-h-screen` の置換 | Tailwind plugin で `min-h-screen` を `min-h-[100svh]` に shim する utility 追加（将来 `100dvh` も） |
| 共通モジュール化 | サーバ uncaught handler | `server/process-handlers.ts` 新設し `index.ts` で `import "./process-handlers"` |
| 共通モジュール化 | SPA fallback の Asset/HTML 分岐 | `serveStatic` 内で `req.path` が `/assets/` で始まる場合は **404 を返す**（fallback 対象外） |
| 単体テスト追加候補 | `safeFormat` / `safeParseDate` / `formatJstDate` の境界値 | `test/lib/date-utils.test.ts` (空文字, "abc", null, JST 境界 23:30 UTC など) |
| 単体テスト追加候補 | `ErrorBoundary` の `componentDidCatch` 動作 | `test/components/ErrorBoundary.test.tsx` |
| 単体テスト追加候補 | `getBasalDosesFromPresets` 参照安定性 (B-001) | `test/hooks/use-insulin-presets.test.tsx` (renderHook で `getByName` 参照同一性チェック) |
| Playwright E2E 追加 | iPhone 12 / iPhone SE エミュレーションでの 5 ページ巡回スモーク | `test/e2e/mobile-smoke.spec.ts` |
| Playwright E2E 追加 | アセットハッシュ齟齬の再現 | `test/e2e/asset-mismatch.spec.ts` (古い HTML で新ハッシュ要求 → 404 期待) |
| ドキュメント追加候補 | `docs/runbook/whiteout-troubleshooting.md` | サポート問い合わせから「どのファイルを見るべきか」即引ける手順書 |
| ドキュメント追加候補 | `docs/architecture/error-handling.md` | ErrorBoundary 2 層 + window.onerror + サーバ process.on の責務分担 |

---

## 4. Sprint 計画

### Sprint 1: クリティカル即修正（◎） — 推定 3-5 営業日

| Item | 対象ID | 受け入れ基準 (Acceptance Criteria) | 影響範囲 | ロールバック |
|------|--------|-----------------------------------|---------|-------------|
| **S1-1** SPA fallback の `/assets/*` 除外 | WA-006 | `curl -I https://prod/assets/index-NONEXISTENT.js` が **404 を返す** (現状: 200 + index.html); 既存ページパスは引き続き 200 + index.html | `server/static.ts` のみ | git revert で即 |
| **S1-2** `process.on('uncaughtException'/'unhandledRejection')` 追加 | WA-005, WA-017 | 意図的に `Promise.reject(new Error("test"))` を投げてもプロセス継続; ログに `[fatal-uncaught]` 出力 | `server/index.ts` 冒頭 | revert |
| **S1-3** iOS viewport meta 強化 | WA-001, WA-002 | `<meta name="viewport" content="...viewport-fit=cover">` 追加; `apple-mobile-web-app-capable` `apple-touch-icon` `theme-color` 確認; iPhone 14 Safari でノッチ切れなし (Playwright + Mobile Safari emulation スクショ比較) | `client/index.html`, ビルド成果物の HTML テンプレ | revert |
| **S1-4** `min-h-screen` → `min-h-[100svh]` 置換 (コンテナ 13 箇所) | WA-003 | iPhone 12 Safari でアドレスバー伸縮時にもフッタ見切れなし; Lighthouse Mobile スコア低下 < 3 点 | 13 ファイル一括 + Tailwind config 確認 | revert |
| **S1-5** `recharts` の dead import 除去 or `chart.tsx` ファイル自体を削除 | WA-004 | `dist/public/assets/index-*.js` が **600KB 以下**; ビルド成功; 既存ページ動作に影響なし | `client/src/components/ui/chart.tsx` 削除 + `package.json` から recharts 削除 | revert + `npm i recharts` |

**Sprint 1 完了条件 (Evaluator PASS/FAIL 基準)**:
- [ ] iPhone 12 / iPhone SE Mobile Safari エミュで 5 主要ページ (`/`, `/login`, `/entry`, `/logbook`, `/settings`) がホワイトアウトせず描画
- [ ] アセットハッシュ齟齬 e2e (S1-1 検証) が PASS
- [ ] 意図 reject e2e (S1-2 検証) でプロセス継続を確認
- [ ] ビルド後 JS バンドル ≤ 600KB
- [ ] 既存 BUG-001〜BUG-016 のリグレッション無し（既存 Playwright/手動 QA）

---

### Sprint 2: 高優先（○） — 推定 4-6 営業日

| Item | 対象ID | 受け入れ基準 |
|------|--------|--------------|
| **S2-1** サーバ Error Handler の Accept ヘッダ分岐 | WA-007 | `/assets/*` 等で 5xx 発生時に `text/html` クライアントには「サービスが混雑しています」HTML を返す。JSON クライアントには JSON |
| **S2-2** Adsense ロード失敗の影響隔離 | WA-008 | `<script>` 失敗を `onerror` で捕捉、`AdBanner` を非表示にして本体 UI を止めない E2E |
| **S2-3** `AdminProtectedRoute` を ProtectedRoute と同じ Spinner パターンへ統一 | WA-011 | `null` 返却を `<Spinner>` に置換、test 追加 |
| **S2-4** TZ 統一 (JST 固定) | WA-012 | `Dashboard.tsx`/`Logbook.tsx`/`Entry.tsx` の `format(new Date(), "yyyy-MM-dd")` を `formatJstDate(new Date())` に置換。海外 TZ の Playwright プロファイルで日付一致を E2E |
| **S2-5** Code Splitting 第一弾 | WA-004, WA-PRE-001 | `wouter` の各 Route を `React.lazy` 化 + `Suspense` の fallback を Spinner に。ビルド時 chunk 数 ≥ 5、初期 chunk ≤ 300KB |
| **S2-6** ConsentGate の dialog open 競合 | WA-015 確認 | dialog open 中の二重 invalidation で fetch 無限ループしない E2E |

**Sprint 2 完了条件**:
- [ ] S2-5 後の Lighthouse Mobile Performance ≥ 70
- [ ] 海外 TZ（America/New_York）プロファイルで Logbook が今日日付の記録を表示
- [ ] Adsense ドメインを Playwright で block しても全ページが操作可能

---

### Sprint 3: 予防 (△ + WA-PRE) — 推定 5-7 営業日

| Item | 対象ID | 受け入れ基準 |
|------|--------|--------------|
| **S3-1** `pg.Pool` 設定の明示化 | WA-PRE-006 | `max`, `idleTimeoutMillis`, `connectionTimeoutMillis`, `application_name` を明示。プール枯渇 e2e で graceful 降格 |
| **S3-2** Service Worker 導入を**敢えて延期する**判断記録 | WA-PRE-002 | `docs/architecture/no-service-worker.md` に CTO 判断として明文化。導入時の `skipWaiting` チェックリスト先出し |
| **S3-3** `useSuspenseQuery` 禁止規約 | WA-PRE-005 | ESLint カスタムルール or CONTRIBUTING.md に明記。違反時 PR ブロック |
| **S3-4** `getQueryFn({on401:"returnNull"})` 既定への切替検討 | WA-014, WA-PRE-005 | 影響範囲を全 useQuery で精査。既存 throw 前提コードがあれば個別 override |
| **S3-5** Logbook の月表示パフォーマンス | WA-018 | `processEntries` を `useMemo` 化、月表示時の Long Task < 50ms (Performance Observer 計測) |
| **S3-6** Entry 自動計算 useEffect の参照安定化 | WA-019 | `getInsulinTimingInfo` を primitive 依存だけに展開、二重発火が無いことを React DevTools Profiler で確認 |

---

### Sprint 4: 計装・観測強化（オプション） — 推定 3-5 営業日

| Item | 対象ID | 受け入れ基準 |
|------|--------|--------------|
| **S4-1** Sentry / OpenTelemetry 導入 (TODO 解消) | WA-020, WA-PRE-003 | `main.tsx` の `// TODO: Sentry...` を実装。cross-origin null event を filter |
| **S4-2** `pageshow` (bfcache 復帰) 検出 | WA-PRE-008 | `event.persisted === true` の場合 TanStack Query を invalidate して再フェッチ |
| **S4-3** 本番 Real User Monitoring (Web Vitals) | - | `web-vitals` パッケージ導入、CLS/LCP/INP を console + Sentry 送信 |
| **S4-4** Replit ヘルスチェック → Slack #insulia-ops | - | 5xx率 > 1% / 2分でアラート |

---

## 5. 各Sprintの完了条件（Evaluator が PASS/FAIL 判定）

### Sprint 1 (Must-have, ホワイトアウトを"統計的にゼロ"に)
- [PASS 条件] iPhone 12 / iPhone SE / Pixel 6 のモバイル Safari & Chrome エミュレーションで 5 主要ページのホワイトアウト 0 件 (Playwright スクショ全件で `<div id="root">` 内に DOM ノード ≥ 1)
- [PASS 条件] バンドル `dist/public/assets/index-*.js` ≤ 600KB
- [PASS 条件] 意図 `process` クラッシュ test でプロセス継続
- [PASS 条件] アセット 404 test でレスポンスステータスが 404 (200 + HTML ではない)
- [PASS 条件] BUG-001〜BUG-016 リグレッション 0 件

### Sprint 2 (Should-have, 周辺リスクを許容範囲に圧縮)
- [PASS 条件] Lighthouse Mobile Performance ≥ 70
- [PASS 条件] Lighthouse Mobile Best Practices ≥ 90
- [PASS 条件] 海外 TZ で Logbook 動作 PASS
- [PASS 条件] Adsense ブロック下でホワイトアウト無し

### Sprint 3 (Nice-to-have, 中長期の保険)
- [PASS 条件] 全予防項目に対して「実装」または「明示的非実装(理由付き)」が決着
- [PASS 条件] DB pool 障害時のフォールバック e2e PASS

### Sprint 4 (Optional, 観測強化)
- [PASS 条件] Sentry に過去 7 日で 1 件以上の実エラーが収集される（観測動作確認）
- [PASS 条件] Web Vitals (LCP/CLS/INP) が prod で取得・可視化

---

## 主要ファイル（実装着手時のフォーカス）

- `/home/runner/workspace/client/index.html` (WA-001/002/008/009)
- `/home/runner/workspace/server/static.ts` (WA-006)
- `/home/runner/workspace/server/index.ts` (WA-005/007)
- `/home/runner/workspace/client/src/components/layout/AppLayout.tsx` (WA-003)
- `/home/runner/workspace/client/src/components/ui/chart.tsx` + `/home/runner/workspace/package.json` (WA-004 recharts 除去)
- `/home/runner/workspace/client/src/components/admin/AdminProtectedRoute.tsx` (WA-011)
- `/home/runner/workspace/client/src/lib/date-utils.ts` (S2-4 で `formatJstDate` を呼ぶ側に展開)
- `/home/runner/workspace/server/db.ts` (WA-PRE-006)
- `/home/runner/workspace/client/src/App.tsx` (S2-5 で `React.lazy` 導入)
- `/home/runner/workspace/vite.config.ts` (manualChunks 設定追加)
