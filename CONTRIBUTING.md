# Contributing — Insulin Manager (Insulia)

このリポジトリは、1型糖尿病患者の血糖値・インスリン記録を管理する個人開発SaaS。
**ホワイトアウト = インスリン未投与リスク** という性質上、可用性・安全性に関する
規約は厳格に運用する。

## TanStack Query 利用ルール

### 禁止事項

- **`useSuspenseQuery` の使用禁止**
  - 根拠: `client/src/lib/queryClient.ts` の既定 queryFn が `on401: "throw"` のため、
    `useSuspenseQuery` と組み合わせると 401 が ErrorBoundary に escalate し、
    未ログインユーザに「問題が発生しました」UIが出る（Audit `WA-PRE-005`）
  - 例: ログイン直前のページで `useSuspenseQuery` を使うと、
    セッション切れの初訪問者にホワイトアウト系画面を提示してしまう
- **やむを得ず使う場合の条件**:
  1. queryFn を上書きして `on401: "returnNull"` を明示
  2. ErrorBoundary 側でも 401 case を skip するハンドリング必須
  3. PR 説明欄に「`useSuspenseQuery` を使う理由 + 401対策」を必ず記載
  4. レビュアーは Audit `WA-PRE-005` を参照して妥当性を確認

### 推奨パターン

- **通常クエリ**:
  ```tsx
  const { data, isLoading } = useQuery({
    queryKey: ["/api/items"],
    queryFn: ...,
  });
  ```
  既定 `on401: "throw"` で catch される → 認証ガードに任せる。
- **認証必須ページ**:
  `<ProtectedRoute>` でログイン状態をチェックしてからクエリ実行する。
- **mutation の onSuccess**:
  `invalidateQueries` の `queryKey` は最小スコープで指定する。
  全体 invalidate は再フェッチが連鎖してホワイトアウトの遠因になる。

### コードレビュー観点

PR で TanStack Query を新規追加・変更する場合、以下をチェック:

- [ ] `useSuspenseQuery` を使っていない
- [ ] `useQuery` の `queryKey` が他箇所と衝突していない
- [ ] mutation 後の `invalidateQueries` の scope が広すぎない
- [ ] 既定 `on401` 挙動を変える場合は理由が明記されている

## ホワイトアウト関連の必須参照

新機能・バグ修正で UI 描画ロジックを触る場合は、以下を必ず先読みすること:

- `audit/specs/whiteout_bug_audit.md` — 既知のホワイトアウト要因 (WA-PRE-001〜005)
- `docs/architecture/no-service-worker.md` — Service Worker 不採用の判断
- `audit/reports/sprint_*_self_review.md` — Sprint 1〜3 の対策履歴

## 開発フロー

1. Replit でローカル開発 (`npm run dev`)
2. ビルド検証 (`npm run build` && `npx tsc --noEmit`)
3. PR 作成（main 直 push 禁止）
4. Sprint レビューを Dev Quality Team で実施
5. CEO 承認 → デプロイ

## DB 変更ルール

- マイグレーションは Drizzle で管理
- スキーマ変更は **CEO 承認必須**（マスタ系特に）
- 推測値で DB を埋めない（feedback ルール）

## セキュリティ

- 個人情報・血糖値データは個人開発レベルでも秘密情報扱い
- API キー・DATABASE_URL は環境変数のみ。コードに含めない
- 401/403 の扱いは TanStack Query 規約（上記）に従う
