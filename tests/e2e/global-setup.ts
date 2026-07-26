import { execFileSync } from "node:child_process";
import pg from "pg";

const { Pool } = pg;

/**
 * Playwright グローバルセットアップ。
 *
 * 目的: テストの前提状態を毎回同じクリーンな状態にリセットし、
 * 「前回のテストで作られたルール/プリセットが残っていて今回のテストが
 * 誤って PASS/FAIL する」flaky を防ぐ。
 *
 * 安全対策 (Codexレビューで denylist 方式の不備を指摘され allowlist に修正 — 2026-07-26):
 * - DATABASE_URL 環境変数のみを参照する (本番は NEON_DATABASE_URL を使う
 *   プロジェクト規約になっており、このスクリプトは NEON_DATABASE_URL には
 *   一切触れない)。
 * - ホスト名の denylist (neon.tech等の文字列一致) では Replit内蔵Postgres等
 *   パターンに一致しない本番ホストを見逃す。localhost/127.0.0.1 以外を
 *   一律拒否する allowlist 方式に変更。
 * - 加えて環境変数 E2E_ALLOW_DB_RESET=true の明示指定を必須にし、
 *   .env の DATABASE_URL 設定ミス単体では実行できない二重ガードにする。
 * - users テーブルは TRUNCATE しない (CASCADE 範囲が読みにくくなるため)。
 *   代わりに既存の script/create-test-user.ts をそのまま呼び出してテスト
 *   ユーザーの存在を保証する (既存なら何もしない冪等スクリプト)。
 */
export default async function globalSetup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL が未設定です。ローカル開発用 Postgres を起動し .env に設定してから実行してください。"
    );
  }

  let hostname: string;
  try {
    hostname = new URL(databaseUrl).hostname;
  } catch {
    throw new Error("DATABASE_URL の形式が不正で接続先ホストを判定できません。");
  }
  const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1";
  if (!isLocalHost) {
    throw new Error(
      `DATABASE_URL の接続先ホスト "${hostname}" はローカル (localhost/127.0.0.1) ではありません。` +
        "Playwright の globalSetup は誤って本番/共有DBをTRUNCATEする事故を避けるため、" +
        "ローカルホスト以外への接続を一律拒否します。"
    );
  }
  if (process.env.E2E_ALLOW_DB_RESET !== "true") {
    throw new Error(
      "E2E_ALLOW_DB_RESET=true が未設定です。このセットアップは対象DBの全記録テーブルをTRUNCATEするため、" +
        "実行者が明示的に同意したことを示す環境変数の指定を必須にしています。"
    );
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    // テスト対象テーブルのみをリセットする (users は触らない)。
    await pool.query(
      `TRUNCATE glucose_entries, insulin_entries, adjustment_rules, insulin_presets, audit_logs RESTART IDENTITY CASCADE`
    );
  } finally {
    await pool.end();
  }

  // テストユーザー作成は既存スクリプトを再利用する (冪等: 既存なら skip)。
  execFileSync("npx", ["tsx", "script/create-test-user.ts"], {
    stdio: "inherit",
    env: process.env,
  });

  // 新規ユーザーは初回ログイン時に TutorialModal (AppLayout.tsx:
  // `if (user && !user.tutorialSeenAt) setShowTutorial(true)`) が自動表示され、
  // 以降のクリック操作を全てブロックしてしまう。ログイン直後に API 経由で
  // 既読化しても React Query のキャッシュ済み user オブジェクトには反映されない
  // レースがあるため、テスト実行前に一度だけ確実に既読化しておく。
  const pool2 = new Pool({ connectionString: databaseUrl });
  try {
    await pool2.query(
      `UPDATE users SET tutorial_seen_at = now() WHERE username = 'testuser_demo' AND tutorial_seen_at IS NULL`
    );
  } finally {
    await pool2.end();
  }
}
