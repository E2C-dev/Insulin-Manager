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
 * 安全対策:
 * - DATABASE_URL 環境変数のみを参照する (本番は NEON_DATABASE_URL を使う
 *   プロジェクト規約になっており、このスクリプトは NEON_DATABASE_URL には
 *   一切触れない)。
 * - ホスト名に本番/クラウドDBらしき文字列が含まれる場合は即座に中断する
 *   defense-in-depth ガードを入れる。
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
  if (/neon\.tech|amazonaws\.com|render\.com|supabase\.co/i.test(databaseUrl)) {
    throw new Error(
      "DATABASE_URL が本番/クラウドDBらしきホストを指しています。Playwright の globalSetup は" +
        "ローカル開発DB専用のため中断します。"
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
