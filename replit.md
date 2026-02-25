# Insulin Manager

## Overview

A Type 1 Diabetes management application that helps users track insulin doses, blood glucose levels, and manage automated insulin adjustment rules. The app provides a mobile-first interface for daily logging with a spreadsheet-style view, supporting four daily time slots (breakfast, lunch, dinner, bedtime) for both insulin administration and glucose measurements.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS v4 with custom medical-themed color variables

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Authentication**: Passport.js with Local Strategy, session-based auth using express-session
- **Password Security**: bcrypt for password hashing
- **API Design**: RESTful API endpoints under `/api/` prefix

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Tables**:
  - `users` - User accounts with hashed passwords
  - `insulin_entries` - Insulin dose records by date and time slot
  - `glucose_entries` - Blood glucose measurements by date and time slot
  - `adjustment_rules` - Automated insulin adjustment rules based on glucose thresholds

### Key Design Patterns
- **Shared Schema**: Database schema defined in `shared/` directory for use by both client and server
- **Protected Routes**: Client-side route protection via `ProtectedRoute` component
- **Storage Interface**: `IStorage` interface in `server/storage.ts` abstracts database operations
- **Mobile-First**: UI designed for mobile devices with max-width container

### Build Configuration
- Client builds to `dist/public/`
- Server bundles with esbuild to `dist/index.cjs`
- Development uses Vite dev server with HMR

## External Dependencies

### Database
- PostgreSQL database (required `DATABASE_URL` environment variable)
- Drizzle ORM for type-safe database queries
- `connect-pg-simple` for session storage

### Authentication
- `passport` and `passport-local` for authentication strategy
- `express-session` for session management
- `bcrypt` for password hashing

### UI Libraries
- Full shadcn/ui component set via Radix UI
- `date-fns` for date formatting with Japanese locale support
- `jspdf` and `jspdf-autotable` for PDF export functionality
- `lucide-react` for icons

### Development Tools
- Vite with React plugin
- TypeScript for type safety
- Tailwind CSS v4 with `@tailwindcss/vite` plugin

## Claude Code プラグイン（開発者向け）

Replit 等のエフェメラル環境では、ユーザースコープで入れたプラグインはセッションごとに消えるため「毎回表示されない」ことがあります。**プロジェクトスコープ**でプラグインを有効にすると、設定が `.claude/settings.json` に保存され、リポジトリにコミットすれば永続化されます。

- **推奨**: プラグインは `/plugin` の UI で「プロジェクトスコープ」を選んでインストールするか、`--scope project` 付きでインストールする。
- **インストール例**（公式マーケットプレイス）:
  - `/plugin install commit-commands@claude-plugins-official`（プロジェクトスコープの場合は UI でスコープを選択）
- インストール後は `.claude/settings.json` の `enabledPlugins` が更新されるため、その変更をコミットする。
- プラグインが一覧に表示されない場合は、キャッシュ削除後に再起動・再インストールを試す: `rm -rf ~/.claude/plugins/cache`

**Replit での永続化**: このリポジトリでは、起動時に `~/.claude` をワークスペース内の `.claude-user` へシンボリックリンクする [script/setup-claude-home.sh](script/setup-claude-home.sh) を `.replit` の `run` で実行しています。これにより、Claude Code のプラグイン・キャッシュがワークスペースに保存され、毎回の設定は不要です。

詳細は [docs/development/claude-code-plugins.md](docs/development/claude-code-plugins.md) を参照。