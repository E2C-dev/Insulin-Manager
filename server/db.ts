import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq } from "drizzle-orm";
import { users } from "@shared/schema";
import bcrypt from "bcrypt";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL環境変数が設定されていません");
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

pool.on("error", (err) => {
  console.error("データベース接続エラー:", err);
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

