import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { users } from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL環境変数が設定されていません");
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

// データベース接続を確認
pool.on("error", (err) => {
  console.error("データベース接続エラー:", err);
});

// テーブルが存在することを確認
export async function initDb() {
  try {
    // usersテーブルの存在確認（簡易チェック）
    await db.select().from(users).limit(1);
    console.log("✅ データベース接続成功");
  } catch (error) {
    console.error("❌ データベース初期化エラー:", error);
    throw error;
  }
}

