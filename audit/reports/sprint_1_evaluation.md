# Sprint 1 評価レポート

**評価者**: Evaluator (Dev Quality Team)
**日時**: 2026-05-04
**対象ブランチ**: main (ahead 24 commits, unpushed)
**評価方式**: SSH read-only 静的解析 + TypeScript build + grep ベース検証
**実機 HTTP テスト**: SKIPPED (Replit サーバー起動制約)

---

## 総合判定: **CONDITIONAL_PASS**

- **Sprint 1 の実装そのものは 5/5 項目すべてコードレベルで完了**
- バンドルサイズ目標 (≤600KB) は **DEFERRED to Sprint 2** (S1-5 単独で達成不可と判明)
- HTTP 実機検証は Sprint 2 で再実施推奨 (静的解析でロジックは PASS)
- **commit GO 推奨** — 上記 2 点の限定条件付き

---

## 評価詳細

| カテゴリ | 結果 | 詳細 |
|---------|------|------|
| 機能完全性 | PASS | S1-1〜S1-5 すべて達成 (5/5) |
| エラーハンドリング | PASS | S1-1 静的アセット 404 / S1-2 fatal-uncaught 両パターン正しく処理 |
| コード品質 | PASS | TypeScript noEmit 通過 (exit 0) / grep 残存ゼロ |
| HTML品質 | PASS | head/body/html 各閉じタグ 1 件、manifest JSON valid |
| バンドルサイズ | DEFERRED | 830KB (目標 ≤600KB)、Sprint 2 Code Splitting で達成予定 |
| BUG-001〜016 リグレッション | PASS | 主要 5 項目すべて健全 |

---

## 各 S1 項目の検証結果

### S1-1: SPA fallback /assets/* 除外 — **PASS**

**実装確認** (`server/static.ts`):
- STATIC_EXTENSIONS Set に 28 拡張子 (.js/.mjs/.cjs/.css/.map/.png/.jpg/.svg/.ico/.woff/.woff2/.ttf/.eot/.otf/.json/.webmanifest/.txt/.xml/.pdf/.mp4/.webm/.mp3/.wav 等) を const 抽出
- STATIC_PREFIXES に /assets/, /favicon, /robots.txt, /manifest, /sw., /apple-touch-icon, /images/ の 7 prefix
- isStaticAssetRequest(req) が prefix と extname の両方をチェック
- マッチ時 `res.status(404).type('text/plain').send(...)` を返す
- 非マッチは従来どおり `index.html` フォールスルー → SPA route 互換性維持

**Live HTTP test**: SKIPPED (Replit サーバー起動禁止制約)。コードロジックは完全に検証可能なため、Sprint 2 で実機 curl 検証を推奨。

**判定**: PASS — blocklist 設計妥当、漏れカバー (.txt/.json も含む)、ロジック明確。

### S1-2: process handler — **PASS**

**実装確認** (`server/process-handlers.ts`):
- `process.on('uncaughtException', ...)` 登録 OK
- `process.on('unhandledRejection', ...)` 登録 OK
- ログプレフィックス `[fatal-uncaught]` 両方に付与 OK
- `process.exit()` を呼ばない設計 (KEEP SERVING ポリシー) OK
- err が Error インスタンスでない場合の防御的 stack 取得 OK
- `export {}` で side-effect import モジュール宣言 OK

**配置確認** (`server/index.ts`):
- 1 行目コメント、2 行目 `import "./process-handlers";` OK
- 他 import (express, session, passport, etc.) より前に配置 OK
- 他モジュールの async 初期化前にハンドラ登録される順序

**判定**: PASS — 共通モジュール化、最先頭配置、ポリシー明確。

### S1-3: viewport / manifest — **PASS** (ただし theme-color は CEO 確認要)

**`client/index.html` 確認**:
| 項目 | 確認結果 |
|------|---------|
| viewport-fit=cover | OK `viewport-fit=cover` を viewport content に追加済 |
| apple-mobile-web-app-capable | OK `content="yes"` |
| apple-mobile-web-app-status-bar-style | OK `content="default"` |
| apple-mobile-web-app-title | OK "インスリア" (追加実装) |
| theme-color | OK `#ffffff` (CEO 仕様通り、ただし旧 `#2563EB` から変更) |
| apple-touch-icon | OK `/apple-touch-icon.png` (画像ファイルは未作成、後続 Sprint) |
| manifest | OK `/manifest.webmanifest` |

**`client/public/manifest.webmanifest` 確認**:
- JSON 構文 valid (node JSON.parse 通過) OK
- 必須フィールド: name, short_name, start_url, display, theme_color, background_color すべて設定 OK
- icons は空配列 (Sprint 1 スコープ外、要 Sprint 後続)

**HTML 構造**:
- `</head>` 1 件、`</body>` 1 件、`</html>` 1 件 → タグ破壊なし OK

**判定**: PASS — タグ破壊なし、必須メタすべて配置。theme-color 変更はCEO決定待ち（後述）。

### S1-4: min-h-screen 置換 — **PASS**

**残存件数チェック**:
- `grep -rn 'min-h-screen' client/src` → **ZERO HITS** OK
- `grep -rn 'min-h-\[100svh\]' client/src` → **14 件確認** (想定通り)

**置換確認ファイル一覧** (14 箇所):
1. components/layout/AppLayout.tsx:93
2. components/admin/AdminProtectedRoute.tsx:22
3. components/admin/AdminLayout.tsx:33
4. components/ProtectedRoute.tsx:24, :36 (2 箇所)
5. pages/admin/AdminLogin.tsx:72
6. pages/not-found.tsx:6
7. pages/Login.tsx:127, :134 (2 箇所)
8. pages/LandingPage.tsx:368, :416 (2 箇所)
9. pages/TermsViewer.tsx:52
10. pages/Register.tsx:128, :135 (2 箇所)

**Tailwind 既存ユーティリティ** (置換対象外、別概念):
- sidebar.tsx:142 `min-h-svh`、sidebar.tsx:378 `min-h-0`、button.tsx:34 `min-h-10`、LandingPage.tsx:1331 `min-h-[400px]`
→ これらは別目的のクラス、誤検知ではない

**判定**: PASS — `min-h-screen` 完全絶滅、置換対象 14 件すべてカバー。

### S1-5: recharts 削除 — **PASS** (バンドルサイズは別判定)

**削除確認**:
- `grep -i recharts package.json` → **ZERO HITS** OK
- `grep -rn recharts client/src` → **ZERO HITS** OK
- `ls client/src/components/ui/chart.tsx` → **No such file** OK
- `grep -rn '@/components/ui/chart' client/src` → **ZERO HITS** OK

**バンドルサイズ実測**:
- 旧: 830.40 KB
- 新: 830.43 KB (index-BjgwrAb5.js, 850,360 bytes)
- 差分: +26 bytes (ノイズ)
- CSS: 138,794 → 136,456 bytes (-2,338 bytes、chart.tsx 由来 utility 除去)

**結論**:
- chart.tsx は孤立コンポーネント (どこからも import なし) のため Vite tree-shaker が元から除外していた
- 物理削除の効果はソースコード整理 + node_modules スリム化 (37 packages 削除) のみ
- **600KB 目標は S1-5 単独では達成不可** が確定 → Sprint 2 Code Splitting (S2-5) に委譲

**判定**: PASS (削除作業) / バンドルサイズは DEFERRED

---

## バンドルサイズ判定 (Audit 計画上の見落とし)

Audit セクション 5 「Sprint 1 PASS 条件」では `dist/public/assets/index-*.js ≤ 600KB` を必須条件としていたが、Generator 実装で以下が判明:

- recharts は孤立 import のため tree-shaking で本番バンドル除外済 (削除前から)
- 真の削減には Sprint 2 S2-5 「wouter Route の React.lazy 化 + manualChunks 設定」が必要
- 現バンドル 830KB の主要因は recharts ではなく、main chunk に全 page component が含まれること

**評価判定**: Sprint 1 の FAIL 要因とは**しない** (Audit の計画上の見落とし)。代わりに Sprint 2 必須化を強調する。CEO 判断要請事項として明示。

---

## BUG-001〜016 リグレッション抜き打ちチェック — **PASS**

| BUG | 確認内容 | 結果 |
|-----|---------|------|
| BUG-006 ProtectedRoute Spinner | `isLoading` 時に `<Spinner>` フォールバック残存 | OK PASS (min-h-[100svh] への置換も同時) |
| BUG-007 localStorage 安全ラッパ | `storage-utils.ts` に safeParseLocalStorage + safeGetLocalStorage | OK PASS |
| B-001 useCallback メモ化 | `use-insulin-presets.ts:77` で `getBasalDosesFromPresets` を useCallback 化 | OK PASS (.tsx → .ts はファイル拡張子の差異のみ、ロジック健全) |
| BUG-014 JST | `date-utils.ts:69` jstNow + :79 formatJstDate 実装健全 | OK PASS |
| ErrorBoundary 2層 | App.tsx:45 PageBoundary + components/ErrorBoundary.tsx の 2 層構成 | OK PASS |

**結論**: Sprint 1 の変更はすべて既存 BUG fix に副作用なし。

---

## 発見されたバグ・懸念点

### [BUG-S1-001] apple-touch-icon.png 未配置 — **Severity: Low**
- HTML から `/apple-touch-icon.png` を参照しているが、`client/public/apple-touch-icon.png` ファイル自体は未作成
- S1-1 で /apple-touch-icon prefix が STATIC_PREFIXES にあるため 404 text/plain を正しく返す → ホワイトアウトの原因にはならない
- iOS ホーム画面追加時のアイコンが表示されない (デフォルトに置換) のみの影響
- **対応**: 後続 Sprint で 180×180 PNG を配置

### [BUG-S1-002] manifest.webmanifest icons 空配列 — **Severity: Low**
- PWA 完全対応には 192×192 + 512×512 PNG icon が必要
- 現状 `"icons": []` のため Lighthouse PWA スコア減点
- ホワイトアウトとは無関係
- **対応**: 後続 Sprint で アイコン配置

### [BUG-S1-003] OG/Twitter image URL が Replit dev domain — **Severity: Low / スコープ外**
- `https://replit.com/public/images/opengraph.png` を指す
- Sprint 1 スコープ外 (Generator 自己評価でも記載)
- **対応**: 本番ドメイン確定時に修正

---

## 改善提案 (Sprint 2 以降への引継ぎ)

1. **S2-5 Code Splitting を最優先**: バンドル 830KB → 300KB 以下初期 chunk + lazy loading で Audit Sprint 1 の 600KB 目標も同時達成
2. **process-handlers.ts の単体テスト**: Sprint 4 (Vitest 導入時) で `setImmediate(() => Promise.reject(...))` の e2e テスト追加
3. **HTTP curl 検証**: Sprint 2 開始時に dev server 立てて `/assets/NONEXISTENT.js → 404`、`/dashboard → 200+HTML` の実機検証
4. **theme-color 変更の UX 確認**: PWA 起動時の status bar 色が青→白に変わるため、実機 iOS ホーム追加→起動でブランド体験を確認
5. **apple-touch-icon.png 作成**: 180×180 PNG をブランドアセットとして用意し配置
6. **manifest icons 充実**: 192×192 + 512×512 + maskable variant
7. **Audit 文書の修正**: Sprint 1 PASS 条件から「バンドル 600KB 以下」を Sprint 2 に移動するよう Audit 本体を改訂

---

## CEO への判断要請事項

### 1. theme-color 変更 (#2563EB → #ffffff): 維持 / 巻き戻し
- **現状**: Generator が CEO スコープ仕様通り `#ffffff` (白) に変更済
- **影響**: PWA 起動時の Android Chrome status bar 色 / iOS Safari address bar tint
- **ブランド一貫性**: Insulia ブランド主軸が青系の場合、status bar が白だと不整合の懸念
- **推奨**: CEO の意図確認。仕様通りなら維持、ブランド優先なら旧 `#2563EB` (青) に巻き戻し
- **対応コスト**: いずれも HTML 1 行修正のみ、5 分

### 2. バンドルサイズ目標は Sprint 2 で達成: 承認 / 別計画
- **現状**: Audit Sprint 1 PASS 条件 `600KB 以下` は技術的に S1-5 単独で達成不可と判明
- **理由**: recharts は元々 tree-shaking 除外済、削除しても -26 bytes
- **真の解**: Sprint 2 S2-5 (Route lazy 化 + manualChunks) で初期 chunk 300KB 以下を狙う
- **推奨**: Sprint 1 を CONDITIONAL_PASS で commit、Sprint 2 で必達目標として再設定
- **代替案**: もし即達成必須なら Sprint 1 に S2-5 を追加組込 (推定追加 1-2 営業日)

---

## ジェネレーターへのフィードバック

**FAIL 該当項目なし**。

特筆すべき良い実装:
1. STATIC_EXTENSIONS / STATIC_PREFIXES の const 抽出 (再利用性 + テスト容易性)
2. process-handlers.ts の独立モジュール化 (AP三重管理「共通モジュール」担保)
3. process.exit() を呼ばない判断 + コメントで根拠明示 (運用思想の明確化)
4. `err` が Error 以外の場合の防御的 stack 取得 (TypeScript unknown 対応)
5. min-h-screen 置換時に Tailwind 既存ユーティリティ (`min-h-svh`, `min-h-0`) を誤置換していない (sed の robust 性確認済)
6. recharts 削除時の影響範囲調査の徹底 (chart.tsx 孤立確認 → 安全削除)

軽微な改善余地 (Sprint 2 で対応可):
- manifest.webmanifest に `description`, `scope`, `orientation` フィールド追加余地
- server/static.ts の 404 レスポンスで Cache-Control ヘッダ付与 (再リクエスト抑制)

---

## 評価サマリー

- **Sprint 1 機能実装**: 5/5 PASS
- **コード品質**: TypeScript clean / grep 残存ゼロ / HTML 健全
- **既存 BUG リグレッション**: ゼロ
- **バンドルサイズ**: Sprint 1 単独では達成不能と確定 → Sprint 2 必達
- **commit 推奨**: GO (CONDITIONAL_PASS)
- **CEO 判断要請**: 2 件 (theme-color / バンドル目標移行)
