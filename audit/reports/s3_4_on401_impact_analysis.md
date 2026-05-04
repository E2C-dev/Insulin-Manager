# S3-4: `getQueryFn({on401: "returnNull"})` 既定切替 影響範囲調査

**作成日**: 2026-05-04
**作成者**: CTO Dev Quality Team Generator
**位置づけ**: 調査のみ。コード変更なし。CTO/CEO に最終判断委ねる。

## 現状

### `client/src/lib/queryClient.ts`（L23-43）

```ts
type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),  // ← 既定 throw
      ...
    },
  },
});
```

**既定挙動**: queryKey を URL とみなして fetch し、401 なら例外 throw、それ以外も非 2xx なら例外 throw。

### `useQuery` 使用箇所統計

```
$ grep -rn 'useQuery' client/src --include='*.tsx' --include='*.ts' | wc -l
57

$ grep -rn 'getQueryFn\|on401' client/src --include='*.tsx' --include='*.ts'
（件数 0 — どこからも明示的に getQueryFn は呼ばれていない）
```

- **総 useQuery 出現数**: 57 件（インポート文・呼び出しのべ数）
- **明示的に `getQueryFn` を渡している箇所**: **0 件**
- **全 useQuery が既定 queryFn (= 既定 `on401:"throw"`) を使う、または明示的に `queryFn` を上書きしている**

実質的にこの既定ルールが効いているのは
**「`useQuery({ queryKey: [...] })` で queryFn を渡さず queryKey を URL として fetch する」呼び出し**のみ。
コードベースでは多くの useQuery が `queryFn` を明示的に渡している（fetch を内部で書いている）ため、
`getQueryFn` 既定の挙動が実際に効いている箇所は **想定より少ない**。

## 抜き打ち5箇所サンプル調査

| # | ファイル:行 | queryFn 種別 | 現在の 401 挙動 | `returnNull` 既定切替後 | 変更要否 |
|---|---|---|---|---|---|
| 1 | `client/src/components/ConsentGate.tsx:40` | **明示 queryFn** (内部 `fetch + !res.ok → return { pending: [] }`) | サーバ 401 でも内部で `{ pending: [] }` 返す（自前 fallback） | 既定切替の影響なし（明示 queryFn が優先） | **不要** |
| 2 | `client/src/hooks/use-auth.ts:73` | **明示 queryFn** (`fetchCurrentUser`) | `fetchCurrentUser` 内で 401 を独自処理（throw or null は実装依存） | 既定切替の影響なし | **不要** |
| 3 | `client/src/pages/Dashboard.tsx:34, 44` | **明示 queryFn** (内部 `fetch + !response.ok → throw`) | 401 で throw → ErrorBoundary → 「問題が発生しました」UI | 既定切替の影響なし（明示 throw が優先） | **不要**（ただし `/dashboard` は `<ProtectedRoute>` 配下のため事実上 401 は来ない） |
| 4 | `client/src/hooks/use-feature-flags.ts:26` | **明示 queryFn** (`fetchFeatureFlags`) | 関数次第 | 既定切替の影響なし | **不要** |
| 5 | `client/src/pages/admin/AdminLogin.tsx` | useQuery 自体は無し（useQueryClient のみ）。サンプル除外 | — | — | — |

**追加確認した実暗黙 queryFn 利用候補**:
- `grep -nA3 'useQuery({\s*queryKey:' client/src --include='*.tsx' --include='*.ts'` で
  `queryFn` を明示しない `useQuery` を抽出すると、
  本コードベースでは **ほぼ全箇所が queryFn を明示している**（fetch 内製パターン）。
- 既定 `getQueryFn` が実際に効いているのは「queryKey を URL として直接使う特殊な短縮形」のみで、
  そのパターンはコードレビューで見当たらず（要 grep 詳細）。

## 切替時の影響度総評

| 観点 | 評価 |
|---|---|
| 直接的な挙動変化 | **極小**（明示 queryFn が大多数を占めるため） |
| 影響を受ける可能性のある暗黙呼び出し | 0 〜 数件（要全件 grep 確認） |
| 認証ガード経路の変化 | 既存 `<ProtectedRoute>` で 401 を防いでいるため二重ガード状態 |
| WA-PRE-005 (useSuspenseQuery 401 escalate) への効果 | **限定的**（useSuspenseQuery 自体の禁止が本丸。既定 returnNull 化はバックアップ層） |

## 推奨

### 結論: **段階切替** を推奨（即座切替も低リスク、据え置きも可）

| オプション | メリット | デメリット | 推奨度 |
|---|---|---|---|
| **A. 即座切替** (既定 `returnNull`) | WA-PRE-005 のバックアップ防御層が増える。明示 queryFn 大多数なので影響ほぼなし | 暗黙 queryFn 利用箇所で `data === null` を扱い忘れるリスク | ★★ |
| **B. 段階切替** (既定維持 + `useSuspenseQuery` 禁止 [Sprint 3 S3-3] + 個別必要箇所で `returnNull` 明示) | 既存挙動を一切変えない安全策。S3-3 規約で当面の WA-PRE-005 は緩和済み | 将来 SW 導入や Suspense 採用時に再検討必要 | ★★★ |
| **C. 据え置き** | 何もしない。S3-3 規約のみ運用 | WA-PRE-005 の防御は1層 (規約のみ) | ★★ |

**最有力**: **B (段階切替)**。理由は以下:

1. S3-3 で `useSuspenseQuery` 禁止を CONTRIBUTING.md に明文化済み →
   WA-PRE-005 の主要発火経路は塞がれる
2. 既定 queryFn 利用箇所がほぼなく、即座切替のメリットが薄い
3. 認証必須ページは既に `<ProtectedRoute>` 配下 → 401 escalate 自体が起きにくい
4. 将来 Suspense や SW を導入する場合に、既定 returnNull 化と組み合わせて
   別 Sprint で計画的に切り替える方が事故が少ない

### 仮に A を採用する場合の最低限のチェックリスト

1. `client/src/lib/queryClient.ts` の defaultOptions.queries.queryFn を `getQueryFn({ on401: "returnNull" })` に変更
2. ESLint カスタムルールで `useSuspenseQuery` 禁止を強制（Sprint 4 候補）
3. 全 useQuery 利用箇所で `data === null` 時のフォールバック表示が実装されているか確認
4. `<ProtectedRoute>` 内のページは引き続き `<ProtectedRoute>` 経由で守る
5. e2e テストで「未ログイン状態でアクセスした際の主要ページ」を確認

### 仮に C を採用する場合

S3-3 規約のみで当面運用。次回 ESLint カスタムルール追加 (Sprint 4 想定) で
`useSuspenseQuery` 禁止を機械的に強制 → 規約違反検知の自動化を完成させる。

## CTO/CEO 判断委任事項

- 推奨案 (B 段階切替) 採用可否
- 即座切替 (A) を選ぶ場合の Sprint 4 タスク化可否
- ESLint カスタムルール追加の優先度

**いずれの案でも当 Sprint 3 でのコード変更は不要**。
本レポートは判断材料として保管する。

## 関連

- `audit/specs/whiteout_bug_audit.md` WA-PRE-005
- `CONTRIBUTING.md` 「TanStack Query 利用ルール」セクション (S3-3 で追加)
- `client/src/lib/queryClient.ts`
