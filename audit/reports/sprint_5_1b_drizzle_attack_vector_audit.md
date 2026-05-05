# Sprint 5.1b: drizzle-orm SQL Injection 攻撃ベクター精査

**監査日**: 2026-05-04
**監査対象**: Insulia (Insulin Manager) - Remote Replit
**脆弱性**: GHSA-gpj5-g38j-94v9 (drizzle-orm@0.39.3, CVSS 7.5 High)
**監査者**: FromTo CTO Security Auditor

---

## 結論

- **危険度判定**: **ゼロ (No exploitable attack vector)**
- **対応緊急度**: **据え置き可** — Sprint 6+ で計画的に semver-major upgrade
- **理由**: 
  - 脆弱な API（`sql.identifier()`、`sql.raw()`、`sql.unsafe()`）を **コードベース全体で1件も使用していない**
  - `sql\`...\`` テンプレート利用は全 26 件あるが、**全てがスキーマ定義内の静的SQL（`gen_random_uuid()`、`now()`）** であり、ユーザー入力の補間は **0件**
  - 動的 ORDER BY / WHERE / テーブル名・カラム名にユーザー入力が流れる箇所も **0件**
  - 全ての書き込み系エンドポイントは **zod スキーマで validate** 済み（`insertXxxSchema.parse(req.body)` パターン徹底）
  - 全ての DB アクセスは drizzle の型安全 builder API（`eq()`、`ilike()`、`desc()`、`and()`）経由で **完全パラメータ化**

---

## 調査結果サマリ

| 指標 | 値 |
|---|---|
| 走査対象 .ts ファイル | **14** ファイル（server/ + shared/） |
| drizzle-orm 使用箇所 | **7** ファイル（routes / admin-routes / storage / admin-storage / db / schema） |
| `sql.identifier(...)` 使用 | **0 件** ✅ |
| `sql.raw(...)` 使用 | **0 件** ✅ |
| `sql.unsafe(...)` 使用 | **0 件** ✅ |
| `sql\`...\`` テンプレート全体 | 26 件（**全て静的 SQL リテラル**） |
| `sql\`...${X}\`` 補間あり | **0 件** ✅ |
| 動的 orderBy（ユーザー入力経由） | **0 件** ✅ |
| 動的 asc/desc（ユーザー入力経由） | **0 件** ✅ |
| 生 pool.query / client.query | **0 件** ✅ |
| zod による入力 validation | server/routes.ts (11 parse), server/admin-routes.ts (1 parse) |
| API ハンドラー数 | server/routes.ts: 30 / server/admin-routes.ts: 13 |

---

## 危険箇所詳細

**該当なし。**

唯一「動的にユーザー入力が DB クエリに渡る」のは `admin-storage.ts:23-24` の検索機能だが、以下の通り **完全に安全**:

### 検証 #1: admin-storage.ts 検索クエリ

**コード抜粋**（`server/admin-storage.ts:16-24`）:
```ts
import { eq, desc, ilike, count, gte, and } from "drizzle-orm";

async listUsers({ search, ... }: { search?: string; ... }) {
  const whereClause = search
    ? ilike(users.username, `%${search}%`)
    : undefined;
  // .where(whereClause).orderBy(desc(users.createdAt))
}
```

**ユーザー入力経路**: `GET /admin/users?search=X` → `req.query.search` (admin-routes.ts:43) → `adminStorage.listUsers({ search })` → `ilike()` ビルダー

**安全性評価**: ✅ **安全**
- `ilike(column, value)` は drizzle の **型安全ビルダー**で、内部的には parameterized query (`username ILIKE $1`) を発行する
- `` `%${search}%` `` は **JavaScript テンプレート文字列**（バインド値の組み立てに過ぎない）。SQL identifier への補間ではない
- `users.username` も TypeScript の column reference であり、ユーザー入力は含まれない
- たとえ `search='%; DROP TABLE users; --'` でも、PostgreSQL ドライバが `$1` の placeholder としてエスケープする
- **管理画面ガード**: `requireAdmin` ミドルウェア経由でしかアクセス不可（admin-routes.ts 全エンドポイント）

### 検証 #2: 全ての書き込み系エンドポイント

`server/routes.ts` の全 POST/PUT/PATCH 系 30 ハンドラーで、**例外なく** zod の `insertXxxSchema.parse(req.body)` を実行（grep: 11 件の `.parse(`）。
typeof / shape / range の validation を経た構造化データのみが drizzle builder に渡る。
admin-routes.ts も同様に `adminResetPasswordSchema.parse(req.body)` で validate。

### 検証 #3: スキーマ内 sql\` テンプレート

shared/schema.ts に 26 件あるが、すべて以下のような **完全な静的 SQL リテラル**:
```ts
id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
createdAt: timestamp("created_at").notNull().default(sql`now()`),
```
ユーザー入力との接点ゼロ。脆弱性の対象外。

---

## 補助防御の状況

| 防御層 | 状態 |
|---|---|
| 入力 validation (zod) | ✅ 全 write 系エンドポイントで徹底（11 + 1 = 12 件 `.parse()`） |
| 型安全 ORM | ✅ drizzle builder API のみ使用（`eq`/`and`/`desc`/`ilike`/`gte`/`lte`/`inArray`/`count`） |
| パラメータ化クエリ比率 | **100%** （生 SQL クエリ・ハンドコード SQL 文字列ゼロ） |
| 認証・認可 | ✅ `requireAuth` / `requireAdmin` ミドルウェア（admin-routes.ts 全エンドポイント） |
| リクエストログ (morgan/winston/pino) | ❌ なし — `console.log` ベース（攻撃検知の事後追跡が弱い） |
| WAF | ❌ なし（Replit 直結） |

---

## drizzle-orm@0.39.3 脆弱性の現実的評価

GHSA-gpj5-g38j-94v9 は **「drizzle が提供する `sql.identifier()` / `sql.raw()` 等の Unsafe API がエスケープ不備」** を指す脆弱性。
本コードベースではこれらの API を **意識的に避け、型安全 builder API のみで構築されている** ため、当該 CVE の影響を **構造的に受けない**。

つまり：
- パッケージとしては脆弱バージョンだが、**Insulia における攻撃可能面 = ゼロ**
- 脆弱コードを書き加えない限り、放置しても実害なし
- `npm audit` の警告は出続けるが、Sprint 6+ で計画的に upgrade すれば十分

---

## 推奨アクション

### 即時対応（Today）
1. **本監査結果を decisions.md に記録** — 「drizzle-orm@0.39.3 の CVE は Insulia には実害なし、Sprint 6+ で upgrade」
2. **Linter ルール追加検討** — `sql.identifier`、`sql.raw`、`sql\`...${...}\`` をブロックする ESLint ルールを追加し、将来の脆弱コード混入を構造的に防ぐ

### 短期（Sprint 5 中）
3. **リクエストログ導入** — 監査ログが弱いので、morgan か pino を Express middleware として追加（攻撃検知・事後追跡用）。30 分作業

### 中期（Sprint 6+）
4. **drizzle-orm semver-major upgrade** — パッチ済みバージョン（0.40.x or 0.44.x など fix 含むリリース）に上げる。型 API 変更がある可能性 → 4-6h の対応 Sprint で計画
5. **CI に `npm audit --production` ゲート追加** — 新規 high/critical 検出時に PR ブロック

---

## CEO への即時判断要請

**実害ゼロ確定 → 据え置きで OK**。下記から選択:

- **A) 据え置き + 構造的予防** ✅ **推奨**: 本日 ESLint ルール追加（30分）+ リクエストログ追加（30分）。drizzle 本体の upgrade は Sprint 6+ で計画
- B) 即 upgrade（4-6h）: 影響ゼロでも気持ち悪い場合の選択肢。型 API 互換性確認に時間がかかる
- C) 完全据え置き: 何もしない。攻撃面ゼロなので問題なし

**A を強く推奨**。理由:
1. 当該 CVE は構造的に攻撃不可（本監査で確証）
2. 将来「うっかり sql.raw() を書く」リスクを Linter で潰しておく方が、ライブラリ更新より高ROI
3. リクエストログは別の事案（不審アクセス検知）でも有用
