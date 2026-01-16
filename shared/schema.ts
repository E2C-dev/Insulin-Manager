import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// 調整ルールテーブル
export const adjustmentRules = pgTable("adjustment_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // ルールの基本情報
  name: text("name").notNull(), // ルール名（例: "夜間低血糖対応"）
  timeSlot: text("time_slot").notNull(), // 時間帯（朝、昼、夜、眠前など）
  
  // 条件設定
  conditionType: text("condition_type").notNull(), // 条件タイプ（夜間低血糖、食後1h など）
  threshold: integer("threshold").notNull(), // 閾値（70, 140 など）
  comparison: text("comparison").notNull(), // 比較演算子（以下、以上、超える、未満）
  
  // 調整内容
  adjustmentAmount: integer("adjustment_amount").notNull(), // 調整量（+2, -1 など）
  targetTimeSlot: text("target_time_slot").notNull(), // 調整対象の時間帯（眠前、翌日同食事など）
  
  // タイムスタンプ
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertAdjustmentRuleSchema = createInsertSchema(adjustmentRules, {
  name: z.string().min(1, "ルール名を入力してください"),
  timeSlot: z.string().min(1, "時間帯を選択してください"),
  conditionType: z.string().min(1, "条件タイプを入力してください"),
  threshold: z.number().int().min(0, "閾値は0以上の整数で入力してください"),
  comparison: z.enum(["以下", "以上", "未満", "超える"], {
    errorMap: () => ({ message: "比較演算子を選択してください" })
  }),
  adjustmentAmount: z.number().int().min(-20).max(20, "調整量は-20〜+20の範囲で入力してください"),
  targetTimeSlot: z.string().min(1, "調整対象の時間帯を入力してください"),
}).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export type AdjustmentRule = typeof adjustmentRules.$inferSelect;
export type InsertAdjustmentRule = z.infer<typeof insertAdjustmentRuleSchema>;
