import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import bcrypt from "bcrypt";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  const username = "testuser_demo";
  const password = "TestPass123";

  const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (existing.length > 0) {
    console.log("✅ テストユーザーは既に存在します:", username);
    await pool.end();
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  const result = await db.insert(users).values({
    username,
    password: hashed,
    role: "user",
    isActive: true,
  }).returning();

  console.log("✅ テストユーザーを作成しました");
  console.log("  ユーザー名:", username);
  console.log("  パスワード:", password);
  console.log("  ID:", result[0].id);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
