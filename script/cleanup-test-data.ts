import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { users, insulinEntries, glucoseEntries, insulinPresets, adjustmentRules } from "../shared/schema";
import { eq } from "drizzle-orm";

const { Pool } = pg;

async function cleanup() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  const testUser = await db.select().from(users).where(eq(users.username, "testuser_demo")).limit(1);
  if (testUser.length === 0) {
    console.log("テストユーザーは存在しません");
    await pool.end();
    return;
  }

  const userId = testUser[0].id;
  // CASCADEなのでuser削除で全データ削除
  await db.delete(users).where(eq(users.id, userId));
  console.log("✅ テストデータを削除しました（ユーザーID:", userId, "）");
  await pool.end();
}

cleanup().catch(e => { console.error(e); process.exit(1); });
