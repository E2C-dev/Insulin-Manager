import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq } from "drizzle-orm";
import { users } from "@shared/schema";
import bcrypt from "bcrypt";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL環境変数が設定されていません");
}

// Sprint 3 (S3-1): pg.Pool オプションを明示化
// - max: 同時接続数上限。Neon serverless 想定で過剰スケールを抑制
// - idleTimeoutMillis: アイドル接続を 30s で切断 (Neon の cold idle 対策)
// - connectionTimeoutMillis: 接続確立に 5s 以上かかる場合は失敗扱い
// - application_name: pg_stat_activity / Neon dashboard で識別しやすくする
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  application_name: "insulin-manager",
});

export const db = drizzle(pool);

// アイドルクライアントで起きた予期せぬエラーをログに残す
// (既存挙動互換: メッセージ文言は維持しつつ prefix を追加)
pool.on("error", (err) => {
  console.error("[pg-pool] unexpected error on idle client:", err);
});

async function seedAdminUser() {
  const existing = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
  if (existing.length === 0) {
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || "admin123";
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    await db.insert(users).values({
      username: "admin",
      password: hashedPassword,
      role: "admin",
      isActive: true,
    });
    console.log("✅ 管理者アカウントを自動作成しました（ユーザー名: admin）");
  }
}

export async function initDb() {
  try {
    await db.select().from(users).limit(1);
    console.log("✅ データベース接続成功");
    await seedAdminUser();
  } catch (error) {
    console.error("❌ データベース初期化エラー:", error);
    throw error;
  }
}
