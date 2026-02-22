/**
 * 管理者ユーザー作成スクリプト
 *
 * 使い方:
 *   ADMIN_PASSWORD=秘密のパスワード npx tsx scripts/create-admin.ts
 *
 * オプション:
 *   ADMIN_USERNAME=admin (デフォルト: "admin")
 *   ADMIN_ROLE=admin または admin_readonly (デフォルト: "admin")
 */
import pg from "pg";
import bcrypt from "bcrypt";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function createAdmin() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD;
  const role = process.env.ADMIN_ROLE || "admin";

  if (!password) {
    console.error("❌ ADMIN_PASSWORD 環境変数を設定してください");
    console.error("   例: ADMIN_PASSWORD=秘密のパスワード npx tsx scripts/create-admin.ts");
    process.exit(1);
  }

  if (!["admin", "admin_readonly"].includes(role)) {
    console.error("❌ ADMIN_ROLE は 'admin' または 'admin_readonly' を指定してください");
    process.exit(1);
  }

  console.log(`\n管理者ユーザーを作成します...`);
  console.log(`  ユーザー名: ${username}`);
  console.log(`  ロール: ${role}`);

  try {
    // 既存ユーザーの確認
    const existing = await pool.query(
      "SELECT id, username, role FROM users WHERE username = $1",
      [username]
    );

    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      if (user.role === "admin" || user.role === "admin_readonly") {
        console.log(`\n✅ 管理者ユーザー "${username}" は既に存在します (ロール: ${user.role})`);
        console.log("   既存のパスワードは変更されません。");
        console.log("   パスワードを変更する場合は、直接DBを更新してください。");
      } else {
        // 一般ユーザーを管理者に昇格
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
          "UPDATE users SET role = $1, password = $2 WHERE username = $3",
          [role, hashedPassword, username]
        );
        console.log(`\n✅ ユーザー "${username}" を管理者に昇格しました (ロール: ${role})`);
      }
    } else {
      // 新規作成
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await pool.query(
        `INSERT INTO users (username, password, role, is_active)
         VALUES ($1, $2, $3, true)
         RETURNING id, username, role`,
        [username, hashedPassword, role]
      );
      const created = result.rows[0];
      console.log(`\n✅ 管理者ユーザーを作成しました`);
      console.log(`   ID: ${created.id}`);
      console.log(`   ユーザー名: ${created.username}`);
      console.log(`   ロール: ${created.role}`);
    }

    console.log(`\n管理画面: http://localhost:5000/admin/login\n`);
  } catch (error) {
    console.error("❌ エラー:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createAdmin();
