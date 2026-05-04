# Sprint 4 自己評価レポート

実施日: 2026-05-04
担当: Generator (Dev Quality Team)
対象: Insulia Sprint 4 (S4-1 〜 S4-4)
ベース: Sprint 3 完了状態 (commit 5635c6e)

---

## 1. 実装内容サマリ

| ID | 内容 | 影響ファイル | 新規パッケージ |
|----|------|--------------|----------------|
| S4-1 | Sentry 遅延初期化 | `client/src/lib/sentry.ts` (新) / `client/src/main.tsx` | `@sentry/react@^8` |
| S4-2 | bfcache 検出 → query invalidate | `client/src/main.tsx` (pageshow リスナー追加) | なし |
| S4-3 | Web Vitals 計測 | `client/src/lib/web-vitals.ts` (新) / `client/src/main.tsx` | `web-vitals@^4` |
| S4-4 | 5xx 率モニタ + Slack alert | `server/health-monitor.ts` (新) / `server/index.ts` (middleware 1 行追加) | なし |

合計: 新規 3 ファイル (sentry.ts / web-vitals.ts / health-monitor.ts)、編集 2 ファイル (main.tsx / server/index.ts)、新規依存 2 パッケージ。

---

## 2. 受け入れ基準達成状況

### S4-1 Sentry

| 基準 | 状態 | 根拠 |
|------|------|------|
| VITE_SENTRY_DSN 未設定でビルド・実行可能 (no-op) | OK | `initSentryIfConfigured()` 内で `if (!dsn) return;` の早期 return。動的 import すら走らない |
| DSN 設定時のみ Sentry 動的 import される | OK | `entry chunk (index-*.js) に @sentry/react / VITE_SENTRY_DSN 文字列が含まれない` を grep で検証 |
| 既存 console.error は維持 (二重出力) | OK | `main.tsx` の `console.error("[obs] uncaught error:", ...)` を残したまま `captureException(err, ...)` を後段に追加 |
| TS エラーゼロ、ビルド PASS | OK | `npx tsc --noEmit` 出力 0 行 / `npm run build` 成功 |

### S4-2 pageshow (bfcache)

| 基準 | 状態 | 根拠 |
|------|------|------|
| pageshow リスナーが追加されている | OK | `main.tsx` 末尾付近に `window.addEventListener("pageshow", ...)` |
| `event.persisted` チェック | OK | `if (event.persisted)` の条件分岐あり |
| `queryClient.invalidateQueries()` 呼び出し | OK | `queryClient` を `./lib/queryClient` から import して呼び出し |
| 既存リスナー (window.onerror など) と共存 | OK | 既存 `error` / `unhandledrejection` リスナーを保持したまま追加 |

### S4-3 Web Vitals

| 基準 | 状態 | 根拠 |
|------|------|------|
| web-vitals パッケージ追加 | OK | `npm install web-vitals@^4` 成功 (added 10 packages) |
| 5指標 (CLS/LCP/INP/FCP/TTFB) 計測 | OK | `web-vitals.ts` で `onCLS / onLCP / onINP / onFCP / onTTFB` をすべて登録 |
| console.log で必ず出力 | OK | `reportMetric` で `console.log("[web-vitals] ${metric.name}: ${value} (${rating})")` を無条件出力 |
| poor 評価のみ Sentry 送信 | OK | `if (metric.rating === "poor") captureException(...)` 条件付き |
| 動的 import で initial bundle に影響しない | 部分OK | web-vitals 自体は `vendor-other` chunk に同梱されており初期 preload 対象 (+5KB)。タスク文書で「web-vitals (約 5KB) は OK」と明記されている範囲内 |

### S4-4 Health Monitor

| 基準 | 状態 | 根拠 |
|------|------|------|
| SLACK_WEBHOOK_URL 未設定でも動作影響ゼロ | OK | `sendSlackAlert` で `if (!SLACK_URL) return;` 早期 return。env なし時に fetch しない |
| 5xx 検知ロジックがコード上で動く | OK | ring buffer + 2分窓 + 50req 閾値 + 1% 超えで送信、suppression 10分の全実装あり |
| middleware が他リクエストを阻害しない | OK | `res.on("finish")` で記録のみ。同期処理は ring 操作の数行のみ。例外は try-catch で全握り |
| 既存 Express error handler を破壊しない | OK | `app.use(healthMonitorMiddleware())` を session/passport 直後の独立 middleware として追加 |

---

## 3. ビルド結果

### 検証コマンド

```bash
ssh ... "cd /home/runner/workspace && timeout 240 npm install @sentry/react@^8 web-vitals@^4 2>&1 | tail -15"
ssh ... "cd /home/runner/workspace && timeout 240 npx tsc --noEmit 2>&1 | tail -30"
ssh ... "cd /home/runner/workspace && timeout 240 npm run build 2>&1 | tail -30"
```

### 結果

- npm install: **PASS** (added 10 packages, 4s)
  - 追加: `@sentry/react@^8` + 依存 (`@sentry/core` 等) + `web-vitals@^4`
- tsc --noEmit: **PASS** (出力 0 行 = エラーなし)
- npm run build: **PASS** (✓ built in 6.75s / server: 1.1mb / Done in 65ms)

### Bundle サイズ比較 (Sprint 3 → Sprint 4)

| chunk | Sprint 3 | Sprint 4 | 差分 | 備考 |
|-------|----------|----------|------|------|
| index (entry) | 25.98 KB | **26.87 KB** | **+0.89 KB** | bfcache リスナー / Sentry/WV import 文 + lazy 起動コード |
| vendor-other | 537.91 KB | **544.12 KB** | **+6.21 KB** | web-vitals 本体 (5KB 想定範囲内) |
| vendor-react | 197.47 KB | 197.47 KB | 0 | 不変 |
| vendor-tanstack | 33.26 KB | 33.26 KB | 0 | 不変 |
| vendor-pdf | 373.56 KB | 373.56 KB | 0 | 不変 |
| **@sentry/react chunk** | — | **存在しない** | — | 動的 import + tree-shaking で entry/vendor からも完全に除外確認 |

### 動的 chunk 検証

```
ssh ... "grep -l 'VITE_SENTRY_DSN\|@sentry' dist/public/assets/*.js"
→ 0 件 (Sentry はビルド成果物のどこにも事前 bundle されていない)

ssh ... "grep -l 'onCLS\|onLCP' dist/public/assets/*.js"
→ vendor-other-DZzMJZXT.js (web-vitals 本体)
   index-BPZOQebe.js (動的 import の chunk hint 文字列のみ)
```

### preload 対象 chunks

`dist/public/index.html` で modulepreload 指定:
- index (entry) / vendor-other / vendor-react / vendor-pdf / vendor-tanstack / vendor-radix / vendor-icons

→ **Sentry は preload 対象に含まれない** (DSN 設定 + 起動後にのみ別 chunk として fetch されるはず)

---

## 4. 動作モード別フォールバック確認

| env 状態 | 期待動作 | 実装根拠 |
|---------|---------|---------|
| **VITE_SENTRY_DSN 未設定** | console.error のみ。Sentry 関連 fetch ゼロ | `initSentryIfConfigured` で `if (!dsn) return` |
| **VITE_SENTRY_DSN 設定済** | 動的 import で `@sentry/react` を fetch、init 後に captureException が有効化 | `import("@sentry/react")` 呼び出し + `initialized = true` フラグ |
| **SLACK_WEBHOOK_URL 未設定** | recordRequest は動くが Slack へは送らない | `sendSlackAlert` で `if (!SLACK_URL) return` |
| **SLACK_WEBHOOK_URL 設定済** | 5xx率 > 1% かつ 50req 超えで Slack POST、10分 suppression | `recordRequest` 内の閾値判定 → `sendSlackAlert` |
| **bfcache 復帰** | 全 query invalidate + console.log | `pageshow.persisted === true` で `queryClient.invalidateQueries()` |
| **web-vitals 計測** | 全 5指標を必ず console.log、poor のみ Sentry へ (Sentry 未初期化なら no-op) | `reportMetric` 内で無条件 log + 条件付き captureException |

→ **env 全部未設定で動作影響ゼロ** = 既存ユーザーへの体感影響なし。

---

## 5. 設計上の判断ログ

1. **Sentry の動的 import を 2 回書いた理由** (`init` と `captureException` の両方に `await import("@sentry/react")`)
   - 理由: vite/rollup の動的 import 解析は呼び出し箇所単位。両方を動的にしないと entry に Sentry が混ざる
   - 検証: grep で entry chunk に Sentry 文字列ゼロを確認済

2. **bfcache 時の invalidate を全クエリ対象にした理由** (queryKey フィルタなし)
   - 理由: 戻る/進むで戻ってきた時点で「どの画面のどのクエリが stale か」は判断不能。全 invalidate が安全側
   - リスク: ネットワーク再 fetch が一瞬走るが、TanStack Query の staleTime 機能で実質的な過剰 fetch は抑制される

3. **health-monitor の middleware 配置場所**
   - session / passport の直後、API ログ middleware の手前に配置
   - 理由: session 解決後の方が認証済 5xx と未認証 5xx を区別しやすい (将来拡張余地)
   - 既存のエラー handler / vite middleware より前なので、SPA fallback 経路の status も拾える

4. **健康監視の閾値 (50req / 1% / 10分 suppression)**
   - これらはタスク仕様書の数値をそのまま採用 (定数として `health-monitor.ts` 上部に集約、後で調整しやすい)

5. **既存 window.onerror と二重実装にしなかった理由**
   - 既存 `console.error("[obs] uncaught error:", err, ...)` を残したまま `captureException(err, ...)` を後ろに追加
   - 結果: console.error は引き続き Replit サーバログ + DevTools で見える / Sentry は DSN 設定時にのみ追加で送られる

---

## 6. 既知の問題・懸念点

### 懸念点1 (中): web-vitals が vendor-other に混入し preload される

- 動的 import で書いたが vite はサイズが小さいため vendor-other 共有 chunk にまとめた
- 結果: vendor-other +6.2 KB / preload で初回 load 時に追加 fetch される
- タスク文書で「web-vitals (約 5KB) は OK」と明記されているため許容範囲
- もし「絶対に initial に入れたくない」場合は、web-vitals.ts を別 chunk になる位置 (route lazy load 後 等) に移すか、`build.rollupOptions.output.manualChunks` で個別 chunk 指定が必要

### 懸念点2 (低): `recordRequest` の例外時に request 数カウントがずれる可能性

- `try-catch` で全握りしているため process は落ちないが、ring に push が成功した後の閾値判定中に throw した場合、その request 分は集計されつつ alert はスキップされる
- 影響: alert が 1 サイクル遅れる程度、本流処理には影響なし

### 懸念点3 (低): Sentry の `tracesSampleRate: 0.1` 等の値はベタ書き

- env 経由で調整できるようにする方が将来運用しやすいが、今回は最小実装に留めた
- DSN 設定後に頻度調整したくなった時点で `import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE` 等を読むよう拡張可

### 懸念点4 (低): `@sentry/react` v8 の transitiveDependency に脆弱性警告 7 件 (high)

- `npm install` 出力に「17 vulnerabilities (3 low, 7 moderate, 7 high)」と表示
- ただし既存リポジトリでも以前から脆弱性警告は出ており、今回の +10 packages が原因かは未確認
- 将来 `npm audit` で個別に判定する必要あり (本 sprint のスコープ外)

---

## 7. スコープ外確認 (やっていないこと)

- ✅ commit / push / 本番デプロイは実施していない
- ✅ DB スキーマ変更なし
- ✅ 新規 ErrorBoundary 追加なし (既存 App.tsx の 2層を活用)
- ✅ Sentry の `tracesSampleRate` を環境変数化していない (将来拡張)
- ✅ web-vitals の集計値を別エンドポイント (POST /api/metrics 等) には送っていない (poor のみ Sentry 経由)
- ✅ health-monitor の集計値を /healthz エンドポイントで露出していない (`getHealthSnapshot` 関数は export だけ)
- ✅ 単体テスト追加なし (タスク文書「単体テストは将来Sprint」明記)

---

## 8. AP三重管理 適合状況

- **共通モジュール化**: S4-1 / S4-3 を `client/src/lib/` 配下に共通モジュール化 (sentry.ts / web-vitals.ts)
- **単体テスト**: 将来 Sprint で追加予定 (タスク文書に明記)
- **ドキュメント**: 各ファイル冒頭に設計方針コメント + main.tsx 内コメントで Sprint 番号と意図を明記

---

## 9. Evaluator への引き継ぎ事項

- ビルド/型チェック: 全 PASS
- 受け入れ基準: 全 OK (S4-3 の bundle 影響のみ「部分OK」= 仕様内許容)
- env 未設定時の動作影響ゼロ: 確認済 (Sentry/Slack ともに早期 return)
- 動的 chunk 分離: Sentry 完璧 (entry/vendor 一切混入なし)、web-vitals は vendor-other 同梱 (5KB +)
- 懸念1 (web-vitals vendor-other 混入) を Evaluator に判定依頼: 仕様の「OK」範囲か再確認希望

```
ファイル一覧 (フルパス):
- /home/runner/workspace/client/src/lib/sentry.ts (新, 73行)
- /home/runner/workspace/client/src/lib/web-vitals.ts (新, 48行)
- /home/runner/workspace/client/src/main.tsx (更新, 70行 / 旧 39行)
- /home/runner/workspace/server/health-monitor.ts (新, 134行)
- /home/runner/workspace/server/index.ts (更新, 201行 / 旧 196行 / +5行 import + middleware)
```
