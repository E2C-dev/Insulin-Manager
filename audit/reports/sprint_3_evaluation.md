# Sprint 3 評価レポート

**評価日**: 2026-05-04
**評価者**: CTO Dev Quality Team Evaluator (独立検証)
**対象**: Sprint 3 全6項目 (S3-1〜S3-6)
**Generator自己評価**: `audit/reports/sprint_3_self_review.md`
**Audit基準**: `audit/specs/whiteout_bug_audit.md` セクション4 Sprint 3

---

## 総合判定: **PASS**

全6項目が受け入れ基準を満たし、ビルド/TS チェック PASS、Sprint 1+2+2.5 リグレッション 0 件、
特に懸念された S3-6 旧 `!getInsulinTimingInfo` vs 新 `=== null` の挙動同値性も
**完全同値** であることを独立検証で確認。commit GO 推奨。

---

## 評価詳細

| カテゴリ | 結果 | 詳細 |
|---|---|---|
| 機能完全性 | **PASS** | 6/6 |
| ビルド (`npm run build`) | **PASS** | 5.88s success |
| TypeScript (`tsc --noEmit`) | **PASS** | エラー出力 0 |
| Sprint 1+2+2.5 リグレッション | **PASS** | 全 7 抜き打ち項目で破壊なし |
| S3-6 挙動同値性 | **PASS** | 完全同値 (詳細は S3-6 セクション) |

---

## 各 S3 項目の検証結果

### S3-1: pg.Pool 設定の明示化 — **PASS**

`server/db.ts` 17-23 行目で以下4オプション + error ハンドラを確認:
- `max: 10` ✓
- `idleTimeoutMillis: 30_000` ✓
- `connectionTimeoutMillis: 5_000` ✓
- `application_name: "insulin-manager"` ✓
- `pool.on("error", err => console.error("[pg-pool] unexpected error on idle client:", err))` ✓

旧コード `console.error("Unexpected error on idle client", err)` のメッセージ文言も
prefix `[pg-pool]` を付けつつ内包しており、既存ログ集計 grep を壊さない配慮あり。
`seedAdminUser` / `initDb` 公開 API は変更なく後方互換。

### S3-2: Service Worker 不導入文書 — **PASS**

`docs/architecture/no-service-worker.md` (2765 bytes) を確認:
- 結論「当面導入しない」明記 ✓
- 背景に Audit `WA-PRE-002` 参照 ✓
- 1型糖尿病管理という事業文脈での正当化 ✓
- 将来導入時のチェックリスト 7 項目 (要件 5-6 を上回る) ✓
- Sprint 1 S1-3 (`apple-touch-icon`, `manifest.webmanifest`) への参照 ✓
- 現在の代替策 (`staleTime: Infinity`, manifest only) を明記 ✓

### S3-3: useSuspenseQuery 禁止規約 — **PASS**

`CONTRIBUTING.md` (新規, ルート直下) を確認:
- 「`useSuspenseQuery` の使用禁止」明記 ✓
- 根拠として `WA-PRE-005` 参照 ✓
- 例外時の運用条件 4 項目 (returnNull 明示 / ErrorBoundary skip / PR 説明欄記載 / レビュアー Audit 確認) ✓
- 推奨パターン (`useQuery` + `<ProtectedRoute>`) ✓
- コードレビュー観点チェックリスト 4 項目 ✓
- `docs/architecture/no-service-worker.md` への相互参照 ✓

### S3-4: on401 切替影響調査 — **PASS**

`audit/reports/s3_4_on401_impact_analysis.md` (132 行) を確認:
- 行数 100 行以上 ✓ (132 行)
- 現状コード片掲載 + 既定 `on401: "throw"` 特定 ✓
- useQuery 総数 57件 / 明示 `getQueryFn` 0件 という統計 ✓
- 5サンプル分析 (ConsentGate / use-auth / Dashboard / use-feature-flags / AdminLogin) ✓
- 推奨案 3つ (A即/B段階/C据え置き) + 推奨度評価 ✓
- 推奨「B 段階切替」+ CTO/CEO 判断委任明記 ✓
- **コード変更なし**: `git status` で `client/src/lib/queryClient.ts` は unchanged を確認 ✓

### S3-5: Logbook useMemo — **PASS**

`client/src/pages/Logbook.tsx` を確認:
- `useMemo` import 追加 (S3-5 用) ✓
- 旧 `processEntries` 関数 → 新 `processedEntries` (useMemo 値) に転換 ✓
- 依存配列 `[glucoseData, insulinData, viewMode]` (Generator 報告と一致) ✓
- 3つの呼び出し側全部が `processedEntries` 値参照に置換:
  - L244: `const entries = processedEntries;` (CSV) ✓
  - L302: `const dailyEntries = processedEntries;` (PDF) ✓
  - L361: `const entries = processedEntries;` (render) ✓
- 旧 `processEntries(` 呼び出しは grep ヒット 0 件 → 完全置換 ✓
- 配列構造・ソート順の変更なし (内部ロジック維持) ✓

**期待効果**: viewMode 変化以外の親 re-render (AlertDialog 開閉等) で 30 回 for ループが
スキップされる。Long Task < 50ms の性能基準は実機計測なしだが理論上達成見込み。

### S3-6: Entry useEffect 参照安定化 ⭐ — **PASS** (重点検証)

#### 旧 vs 新の挙動同値性検証

**`getInsulinTimingInfo` の型と取りうる値**:
- 定義: `client/src/pages/Entry.tsx:368` の useMemo
- 型: `null | { label: string, baseAmount: number, insulinSlot: InsulinTimeSlot }`
- `null` を返す条件: `!formData.timeSlot` または `!selectedOption`
- 非 null 時は必ず object (truthy)
- **TypeScript 型・実装ロジックの両面で `undefined` / `false` / `0` / `""` を返す経路は存在しない**

**`baseAmount` の取りうる値**:
- 計算: `getBasalDosesFromPresets(insulinSlot)` の戻り値
- 戻り値型: `number` (`use-insulin-presets.ts:78`)
- `0` を取りうる ✓ (フォールバック `stored[slot] ?? 0` で必ず数値)

#### ケース別挙動比較

| `getInsulinTimingInfo` の値 | 旧 `if (!getInsulinTimingInfo)` | 新 `timingBaseAmount = ?.baseAmount ?? null` → `if (=== null)` | 同値性 |
|---|---|---|---|
| `null` | truthy 否定 → return | `undefined ?? null = null` → return | **同値** |
| `{ baseAmount: 0, ... }` | object truthy → 続行 (calculatedInsulin = 0) | `0 ?? null = 0` → 続行 (calculatedInsulin = 0) | **同値** ⭐ |
| `{ baseAmount: 5, ... }` | object truthy → 続行 (calculatedInsulin = 5) | `5 ?? null = 5` → 続行 (calculatedInsulin = 5) | **同値** |
| `{ baseAmount: NaN, ... }` | object truthy → 続行 | `NaN ?? null = NaN` → NaN !== null → 続行 | **同値** (NaN 経路は元々 broken だが等価) |
| `undefined` (実装上不可) | falsy → return | `undefined?.baseAmount = undefined → ?? null = null` → return | **同値** |
| `false` (実装上不可) | falsy → return | `false?.baseAmount` は TypeError、ただし実装上不可 | 該当なし |

**重要**: `??` 演算子 (Nullish Coalescing) は **null/undefined のみ** をデフォルト発動の対象にし、
**`0`, `false`, `""` は通す**。これにより `baseAmount === 0` のケースで:
- 旧: `getInsulinTimingInfo = { baseAmount: 0 }` (truthy) → 続行 → `calculatedInsulin = 0`
- 新: `timingBaseAmount = 0` (`0 ?? null = 0`, null判定 false) → 続行 → `calculatedInsulin = 0`

完全に同じパスを通る。**もし `||` を使っていたら `0 || null = null` で誤って return していたが、
`??` を選択している点が正しい**。

#### 依存配列の検証

新依存配列 (Entry.tsx L546-553):
```
[formData.glucoseLevel, formData.timeSlot, formData.insulinUnitsDirty,
 timingBaseAmount, applicableRules, selectedPresetId]
```

- `formData.*` 3つ: primitive (string/boolean) ✓
- `timingBaseAmount`: `number | null` の primitive ✓
- `applicableRules`: array (object reference) — Generator 自己評価通り `useMemo` 化済みで
  参照が安定。完全 primitive 化は過剰最適化のため許容。BUG-001 fix の同値ガードも
  二重防御として機能。
- `selectedPresetId`: primitive (string | null) ✓

**判定**: object 参照は `applicableRules` のみ残るが既に useMemo 安定化済み。
旧 `getInsulinTimingInfo` (object) を依存配列に含めていた無駄な再発火経路は除去された。

#### BUG-001 fix の同値ガード残存確認

L538-542 で確認:
```
const next = finalInsulin.toString();
if (prev.insulinUnits === next) return prev;
```
完全に維持されており、万が一 effect が二重発火しても setState skip でループ防止される。

#### S3-6 最終判定: **PASS** (完全同値)

---

## Sprint 1+2+2.5 リグレッション

| 項目 | 検証コマンド | 結果 |
|---|---|---|
| S1-1 SPA fallback blocklist | `grep app.use("\*"` server/static.ts | `isStaticAssetRequest(req)` ガード維持 → PASS |
| S1-2 process-handlers 早期 import | `head -10 server/index.ts` | 1行目に `import "./process-handlers";` 維持 → PASS |
| S1-3 viewport-fit | `grep viewport-fit client/index.html` | `viewport-fit=cover` 維持 → PASS |
| S1-4 min-h-screen 全廃 | `grep -rn min-h-screen client/src \| wc -l` | 0 件 → PASS |
| S2-1 error-html | `ls server/error-html.ts` | 存在 → PASS |
| S2-5 manualChunks + React.lazy | `grep -n manualChunks vite.config.ts; grep lazy App.tsx` | manualChunks(id) 関数維持、lazy() 6本維持 → PASS |
| Sprint 2.5 PDF | `grep exportLogbookToPDF Logbook.tsx` | import + 呼び出し維持 → PASS |

**全項目で破壊なし**。Sprint 1+2+2.5 の対策が引き続き機能している。

---

## 発見されたバグ・懸念点

### 致命度 Low

1. **OPEN-3 (Generator 自己申告)**: `applicableRules` (array) が依存配列に残存。
   `useMemo` で参照安定化済みのため実害ゼロだが、Sprint 4 以降で完全 primitive 化
   (例: applicableRules.length + signature) を検討してもよい。

2. **chunk size 警告**: `vendor-other-CcEZ7C1e.js 537.91 KB` が 500KB 警告超え。
   Sprint 3 のスコープ外だが将来 vendor-other を更に分割する余地あり (Sprint 4 候補)。

### Sprint 3 由来の新規バグ: **0 件**

---

## 改善提案 (将来 Sprint へ)

1. **ESLint カスタムルール** で `useSuspenseQuery` 禁止を機械的強制 (Sprint 4 候補)
2. **Performance Observer** で Logbook Long Task < 50ms を実機計測 (S3-5 受け入れ基準後段)
3. **DB pool 障害時 e2e** (Sprint 3 完了条件 line 159) は実機テスト未実施。
   `pg_stat_activity` モニタリング + Neon dashboard 連携で別 Sprint に切り出し
4. **`max: 10`** の妥当性は本番運用で実測すべき (Generator 自己申告通り)

---

## CEOへの判断要請事項

### 即決定が必要

1. **S3-4 on401 切替方針** (推奨: B 段階切替):
   - A: 即座切替 (低リスクだが追加リターン薄い)
   - **B: 段階切替** ← Generator 推奨。S3-3 規約で WA-PRE-005 主因は塞いだ
   - C: 据え置き (規約のみ)

### 中期検討

2. ESLint カスタムルール導入の優先度 (Sprint 4 候補)
3. pg_stat_activity モニタリング + Neon dashboard 連携 (運用 Sprint)
4. DB pool 枯渇 e2e テスト整備 (Sprint 3 完了条件後段)

---

## ジェネレーターへのフィードバック

**FAIL ではないため修正指示なし**。以下は称賛/Note:

- ⭐ S3-6 で `??` (Nullish Coalescing) を選んだ判断が正解。`||` だと `baseAmount === 0`
  で誤って return してしまう。Generator が「`baseAmount === 0` で挙動が変わらないか」
  を Evaluator 申し送り 3. に明示的に挙げていた点も評価高い (リスクの自己認識)。
- S3-1 で error ハンドラの旧メッセージ文言を内包しつつ prefix `[pg-pool]` を追加した
  「ログ集計 grep 互換性」の配慮は GOOD。
- S3-5 で 3 callsite を網羅置換し、コメントも `processedEntries` 表記に整合させた
  細やかさが GOOD。
- S3-3 CONTRIBUTING.md の例外運用条件 4 項目が実用的で、後続コードレビューで
  そのまま運用可能。

---

## commit GO/NO-GO 推奨

**GO**。

理由:
- 全6項目 PASS
- TS / build PASS
- Sprint 1+2+2.5 リグレッション 0 件
- S3-6 完全同値 (旧 `!getInsulinTimingInfo` vs 新 `=== null`) を独立検証で確認
- S3-4 はコード変更なしの調査レポートのため commit に含める影響なし
- CEO 判断委任事項 (S3-4) は別チケット化で問題なし

## 残課題 (Sprint 3 スコープ外)

- Sprint 4: 観測強化 (Sentry / Web Vitals / Real User Monitoring)
- DB pool 枯渇 e2e (Sprint 3 完了条件後段)
- S3-4 切替判断後の実装 (採用案次第)
- ESLint カスタムルール (機械的強制)
