# Sprint 3 自己評価レポート

**スプリント**: Sprint 3 — バグ予防・観測強化系（6項目）
**実装日**: 2026-05-04
**Generator**: CTO Dev Quality Team
**前提コミット**: Sprint 1 (09852d2) / Sprint 2 (beb0309) / Sprint 2.5 PDF配線 (bb9f5ad)
**Audit基準**: `audit/specs/whiteout_bug_audit.md` セクション4 Sprint 3

---

## 1. 実装内容サマリー

| ID | 概要 | 種別 | ファイル |
|---|---|---|---|
| S3-1 | pg.Pool 設定の明示化 | コード変更 | `server/db.ts` |
| S3-2 | Service Worker 不導入の意思決定文書化 | 新規ドキュメント | `docs/architecture/no-service-worker.md` |
| S3-3 | useSuspenseQuery 禁止規約 | 新規ドキュメント | `CONTRIBUTING.md` |
| S3-4 | on401 既定切替 影響範囲調査 | 調査レポート | `audit/reports/s3_4_on401_impact_analysis.md` |
| S3-5 | Logbook の月表示パフォーマンス改善 | コード変更 | `client/src/pages/Logbook.tsx` |
| S3-6 | Entry.tsx 自動計算 useEffect 参照安定化 | コード変更 | `client/src/pages/Entry.tsx` |

---

## 2. 各項目の詳細

### S3-1: pg.Pool 設定の明示化

**変更**:
- `new pg.Pool({ connectionString: process.env.DATABASE_URL })` のみだったものを、
  以下4オプションを明示化:
  - `max: 10`（同時接続数上限）
  - `idleTimeoutMillis: 30_000`（アイドル接続切断 30s）
  - `connectionTimeoutMillis: 5_000`（接続タイムアウト 5s）
  - `application_name: "insulin-manager"`（pg_stat_activity 識別用）
- error イベントハンドラに `[pg-pool]` プレフィックス追加（既存のメッセージ文言は内包）。

**受け入れ基準**:
- [x] 4オプション + error ハンドラ追加 → **OK**
- [x] 既存の `seedAdminUser` 等の動作に影響なし（公開API変更なし）→ **OK**
- [x] TS エラーなし → **OK**（後述ビルド結果）

**懸念点**:
- Neon serverless は接続あたり課金。`max: 10` で適切と判断したが、本番運用で
  pg_stat_activity の active connection 数が上限に張り付く場合は `max` 引き上げを
  別 Sprint で検討すること。

### S3-2: Service Worker 不導入の意思決定文書化

**変更**:
- `docs/architecture/` ディレクトリを新設（`mkdir -p`）。
- `no-service-worker.md` を新規作成。Audit WA-PRE-002 の根拠 + 将来導入時の
  チェックリスト6項目 + 現在の代替策を明記。

**受け入れ基準**:
- [x] ファイル新設、結論明示、導入時チェックリスト先出し → **OK**

### S3-3: useSuspenseQuery 禁止規約

**変更**:
- `CONTRIBUTING.md` を新規作成（既存なし）。
- 「TanStack Query 利用ルール」セクションで `useSuspenseQuery` 禁止を明文化。
- 推奨パターン・コードレビュー観点・例外運用条件を記述。
- Audit WA-PRE-005 への参照リンク。

**受け入れ基準**:
- [x] `useSuspenseQuery` の文字列がレポート内に出現（grep カウント = 5） → **OK**
- [x] 推奨パターン/レビュー観点/例外条件あり → **OK**

### S3-4: on401 既定切替 影響範囲調査

**実施内容**:
1. useQuery 総使用数: **57 件**（grep カウント）
2. 明示的 `getQueryFn` / `on401` 参照: **0 件**（コードベースでは誰も明示呼びしていない）
3. `client/src/lib/queryClient.ts` 既定の特定: `on401: "throw"`
4. 抜き打ち5サンプル（ConsentGate, use-auth, Dashboard×2, use-feature-flags, AdminLogin）→
   **全件が独自 queryFn を明示しており、既定 queryFn の挙動が実際に効いている箇所は
   ほぼゼロ** という結論

**推奨**:
- **段階切替（B案）** を推奨。理由は S3-3 規約で WA-PRE-005 主要発火経路は塞がれており、
  即座切替の追加リターンが薄いため。
- A案（即座切替）も低リスクなため、CTO/CEO 判断に委任。
- C案（据え置き + ESLint カスタムルール追加）も可。

**レポート**: `/home/runner/workspace/audit/reports/s3_4_on401_impact_analysis.md` (132行)

**受け入れ基準**:
- [x] 調査レポートのみ。コード変更なし → **OK**
- [x] 5サンプル分析・推奨案3つ・判断委任先明記 → **OK**

### S3-5: Logbook の月表示パフォーマンス改善

**変更**:
- `import { useState }` → `import { useMemo, useState }`
- `processEntries`（plain function）→ `processedEntries`（`useMemo` 値）に転換
- 依存配列: `[glucoseData, insulinData, viewMode]`
- 3つの呼び出し側を `processEntries()` → `processedEntries` に置換:
  - `handleExportCSV` 内（line 244）
  - `runExportPdf` 内（line 302）
  - render 直前（line 361）
- 関連コメント1箇所も `processedEntries` 表記に更新

**受け入れ基準**:
- [x] `useMemo` で結果がメモ化 → **OK**
- [x] 月切替（viewMode 変化）・データ取得時は再計算、それ以外の親再renderで再実行されない → **OK**
- [x] TS エラーなし → **OK**
- [x] 既存の Logbook 表示挙動に変化なし → **OK**（出力配列の構造・ソート順すべて維持）

**期待される効果**:
- viewMode = "month" 時、30回 for ループ + sort + map が
  「`glucoseData/insulinData/viewMode` 変化時のみ実行」になる。
- AlertDialog 開閉・hover 等の親 re-render では再計算しない。

### S3-6: Entry.tsx 自動計算 useEffect 参照安定化

**変更**:
- `getInsulinTimingInfo` (object | null) を依存配列に直接入れていたパターンを、
  `timingBaseAmount = getInsulinTimingInfo?.baseAmount ?? null` という primitive に展開。
- useEffect 本体内の `getInsulinTimingInfo.baseAmount` 参照を `timingBaseAmount` に置換。
- 早期 return ガード `if (!getInsulinTimingInfo) return` を `if (timingBaseAmount === null) return` に置換。
- 依存配列: `getInsulinTimingInfo` → `timingBaseAmount`。
- 既存の「直前と同値時 setState skip」ガード (BUG-001 fix) は維持。
- `applicableRules` (array) は **既に useMemo で安定化済み** のため依存配列に残置（参照安定）。

**受け入れ基準**:
- [x] useEffect 依存配列に object 参照（getInsulinTimingInfo）が直接入らない → **OK**
- [x] BUG-001 fix の同値ガード維持 → **OK**
- [x] TS エラーなし → **OK**

**懸念点**:
- `applicableRules` も object（array）だが、こちらは `useMemo` 化済みで参照が安定しており、
  実害は出ない判断（依存配列に残置）。完全に primitive 化するなら
  `JSON.stringify(applicableRules)` 等になるが、それは過剰最適化のためスコープ外。

---

## 3. ビルド・型チェック結果

### TypeScript チェック

```bash
npx tsc --noEmit
```

**結果**: **PASS**（エラー出力なし）

### ビルド

```bash
npm run build
```

**結果**: **PASS**（6.34s）

#### 主要 chunk サイズ（変更前後比較）

| chunk | サイズ | gzip | 備考 |
|---|---|---|---|
| Entry-B2F51UZ6.js | 19.09 kB | 5.45 kB | S3-6 反映 |
| Logbook-D6FRXI0o.js | 20.55 kB | 5.66 kB | S3-5 反映 |
| index-BCW-bhLh.js | 25.98 kB | 8.57 kB | エントリ |
| vendor-react | 197.47 kB | 61.92 kB | 不変 |
| vendor-tanstack | 33.26 kB | 9.89 kB | 不変 |
| vendor-other | 537.91 kB | 162.90 kB | 不変 |
| vendor-pdf | 373.56 kB | 120.90 kB | 不変 |

**初期 entry chunk への影響**: ±0 KB（コメント・useMemo 1個追加程度のため、minify後はノイズレベル）。
**vendor chunk 構成への影響**: なし（依存追加なし）。

#### サーバビルド

```
dist/index.cjs  1.1mb ⚠️
⚡ Done in 84ms
```

S3-1 の Pool オプション追加分は数十バイト程度。サーバビルドサイズ実質変化なし。

---

## 4. 既知の問題・懸念点

| ID | 内容 | 対応 |
|---|---|---|
| OPEN-1 | S3-4 は調査のみ。CTO/CEO 判断待ち | Sprint 4 でルール採用なら ESLint カスタムルール追加検討 |
| OPEN-2 | S3-1 で `max: 10` の妥当性は本番運用で実測必要 | 別 Sprint で pg_stat_activity モニタリング追加 |
| OPEN-3 | S3-6 で `applicableRules` (array) は依存配列に残した | 既に useMemo 化済みのため実害なし。Sprint 4 以降で完全 primitive 化検討可 |
| OPEN-4 | Service Worker 導入は将来課題 | `docs/architecture/no-service-worker.md` のチェックリスト遵守 |

---

## 5. AP三重管理（アンチパターン番号）

Sprint 3 はバグ予防・観測強化系のため、新規 AP 番号は付与しない。
ただし以下既存 AP / WA への対応として位置付ける:

| Audit ID | Sprint 3 での対応 |
|---|---|
| WA-PRE-002（SW誤実装ホワイトアウト） | S3-2: 不導入を文書化 |
| WA-PRE-005（useSuspenseQuery 401 escalate） | S3-3: 規約禁止 + S3-4: 切替検討 |
| BUG-001（Entry useEffect 同値ガード） | S3-6: 既存ガード維持しつつ依存配列改善 |

---

## 6. Evaluator への申し送り

### 特にチェックしてほしい箇所

1. **`server/db.ts`**: pool オプション値（max=10, idle=30s, conn=5s）が
   Insulia の規模に対して適切か。Neon dashboard と比較して判断願う。
2. **`client/src/pages/Logbook.tsx`**:
   - `useMemo` 依存配列 `[glucoseData, insulinData, viewMode]` が漏れなく必要分を網羅しているか
   - 3つの呼び出し側（CSV/PDF/render）すべて `processedEntries` に置換済みか
3. **`client/src/pages/Entry.tsx`**:
   - `timingBaseAmount` extraction が既存 `getInsulinTimingInfo?.baseAmount` 同値か
   - 早期 return 条件 `if (timingBaseAmount === null)` が以前の `if (!getInsulinTimingInfo)` と
     **意味的に同値**か（`baseAmount === 0` の場合に分岐が変わらないか）
4. **`audit/reports/s3_4_on401_impact_analysis.md`**:
   - 5サンプル分析の妥当性 + 推奨案 (B 段階切替) が CTO 視点で OK か

### 既知のスコープ外項目

- ESLint カスタムルール追加（Sprint 4 候補）
- 単体テスト追加（Sprint 4）
- pg_stat_activity モニタリング追加（別 Sprint）

### 受入テスト推奨手順

1. ローカル `npm run dev` 起動 → Logbook 月表示 → 月→週→月切替で再計算が走ることを確認
2. Entry 画面で血糖値入力 → 自動インスリン計算が以前と同じ値を出すこと
3. インスリン量を手入力 (insulinUnitsDirty=true) → 以後自動上書きされないこと（BUG-001 fix）
4. ログイン/ログアウトを繰り返して 401 ハンドリングに変化がないこと
5. Replit の Pool 接続数が稼働中に 10 以下に収まること（pg_stat_activity 確認）

---

## 7. 結論

**全6項目 OK**。ビルド・TS チェックともに PASS。
Evaluator 実行に進んで問題ない。

CTO/CEO 判断委任事項は S3-4 の「on401 既定切替の採用可否」のみ。
それ以外は既定 GO。
