# 認証機能の実装

ログイン・アカウント登録機能が実装されました。

## 実装内容

### バックエンド

1. **認証システム** (`server/auth.ts`)
   - Passport.jsを使用したローカル認証戦略
   - bcryptによるパスワードハッシュ化
   - セッションベースの認証管理
   - 認証ミドルウェア（isAuthenticated）

2. **APIエンドポイント** (`server/routes.ts`)
   - `POST /api/auth/register` - 新規ユーザー登録
   - `POST /api/auth/login` - ログイン
   - `POST /api/auth/logout` - ログアウト
   - `GET /api/auth/me` - 現在のユーザー情報取得
   - `GET /api/protected` - 保護されたエンドポイントの例

3. **データベース** (`server/db.ts`, `server/storage.ts`)
   - Drizzle ORMを使用したPostgreSQL接続
   - ユーザーテーブルのCRUD操作

### フロントエンド

1. **認証ページ**
   - `client/src/pages/Login.tsx` - ログインページ
   - `client/src/pages/Register.tsx` - 新規登録ページ

2. **認証管理** (`client/src/hooks/use-auth.ts`)
   - カスタムフック: useAuth
   - ユーザー情報の取得と管理
   - ログアウト機能

3. **ルート保護** (`client/src/components/ProtectedRoute.tsx`)
   - プライベートルートの保護
   - 未認証ユーザーの自動リダイレクト

4. **UI統合**
   - AppLayoutにユーザー情報とログアウトボタンを追加
   - 設定ページにログアウトボタンを追加
   - 全ての既存ページをプライベートルートとして保護

## セットアップ手順

### 1. 環境変数の設定

`.env`ファイル（またはReplitのシークレット）に以下を設定：

```bash
DATABASE_URL=postgresql://...  # PostgreSQLの接続文字列
SESSION_SECRET=your-secret-key-change-this-in-production
```

### 2. データベースのセットアップ

以下のコマンドでデータベーステーブルを作成：

```bash
npm run db:push
```

### 3. アプリケーションの起動

```bash
npm run dev
```

## 使用方法

### 新規ユーザー登録

1. ブラウザで `/register` にアクセス
2. ユーザー名（3文字以上）とパスワード（6文字以上）を入力
3. 「登録」ボタンをクリック
4. 自動的にログインし、ホームページにリダイレクトされます

### ログイン

1. ブラウザで `/login` にアクセス
2. ユーザー名とパスワードを入力
3. 「ログイン」ボタンをクリック
4. ホームページにリダイレクトされます

### ログアウト

以下のいずれかの方法でログアウトできます：
- ヘッダーの設定アイコンをクリックし、「ログアウト」を選択
- 設定ページの「ログアウト」ボタンをクリック

## セキュリティ機能

- ✅ パスワードのbcryptハッシュ化
- ✅ セッションベースの認証
- ✅ HTTPOnlyクッキーの使用
- ✅ HTTPS使用時のSecureクッキー
- ✅ プライベートルートの保護
- ✅ 認証エラーの適切な処理

## 技術スタック

- **認証**: Passport.js + passport-local
- **セッション管理**: express-session
- **パスワードハッシュ化**: bcrypt
- **データベース**: PostgreSQL + Drizzle ORM
- **バリデーション**: Zod
- **フロントエンド**: React + TypeScript + TanStack Query
- **ルーティング**: Wouter
- **UI**: Radix UI + Tailwind CSS

## 注意事項

- セッションは7日間有効です
- パスワードは最低6文字必要です
- ユーザー名は最低3文字必要で、重複不可です
- 本番環境では必ず`SESSION_SECRET`環境変数を強力なランダム文字列に設定してください

