import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, date, decimal, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),            // "user" | "admin" | "admin_readonly"
  isActive: boolean("is_active").notNull().default(true),  // アカウント無効化用
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  lastLoginAt: timestamp("last_login_at"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UserWithRole = typeof users.$inferSelect;

// フィーチャーフラグテーブル（管理者がON/OFFを制御する機能フラグ）
export const featureFlags = pgTable("feature_flags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),        // 例: "show_ads", "enable_user_registration"
  value: boolean("value").notNull().default(false),
  description: text("description"),
  updatedBy: varchar("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export type FeatureFlag = typeof featureFlags.$inferSelect;

// 監査ログテーブル（管理者の操作履歴）
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),             // "user.deactivate", "flag.update" など
  targetType: text("target_type").notNull(),    // "user", "feature_flag"
  targetId: varchar("target_id"),
  previousValue: text("previous_value"),        // JSON文字列
  newValue: text("new_value"),                  // JSON文字列
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export type AuditLog = typeof auditLogs.$inferSelect;

// インスリンプリセットテーブル（ユーザーが使用するインスリン製品の設定）
export const insulinPresets = pgTable("insulin_presets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // カスタム名（例: "朝のノボラピッド"）
  category: text("category").notNull(), // 超速効型 | 速効型 | 中間型 | 持効型 | 超持効型 | 混合型
  brand: text("brand").notNull(), // ブランド名
  defaultBreakfastUnits: decimal("default_breakfast_units", { precision: 5, scale: 1 }), // null=このタイミングには使わない
  defaultLunchUnits: decimal("default_lunch_units", { precision: 5, scale: 1 }),
  defaultDinnerUnits: decimal("default_dinner_units", { precision: 5, scale: 1 }),
  defaultBedtimeUnits: decimal("default_bedtime_units", { precision: 5, scale: 1 }),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: text("is_active").notNull().default("true"), // ソフトデリート用
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// インスリン投与記録テーブル
export const insulinEntries = pgTable("insulin_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  presetId: varchar("preset_id").references(() => insulinPresets.id, { onDelete: "set null" }), // 使用したプリセット
  date: date("date").notNull(), // 日付
  timeSlot: text("time_slot").notNull(), // Breakfast, Lunch, Dinner, Bedtime
  units: decimal("units", { precision: 5, scale: 1 }).notNull(), // 投与量
  note: text("note"), // メモ
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// 血糖値測定記録テーブル
export const glucoseEntries = pgTable("glucose_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: date("date").notNull(), // 日付
  timeSlot: text("time_slot").notNull(), // BreakfastBefore, BreakfastAfter1h, etc.
  glucoseLevel: integer("glucose_level").notNull(), // 血糖値 (mg/dL)
  note: text("note"), // メモ
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertInsulinPresetSchema = createInsertSchema(insulinPresets, {
  name: z.string().min(1, "名前を入力してください").max(50, "名前は50文字以内で入力してください"),
  category: z.enum(["超速効型", "速効型", "中間型", "持効型", "超持効型", "混合型"], {
    errorMap: () => ({ message: "カテゴリを選択してください" }),
  }),
  brand: z.string().min(1, "ブランドを選択してください"),
  defaultBreakfastUnits: z.string().nullable().optional(),
  defaultLunchUnits: z.string().nullable().optional(),
  defaultDinnerUnits: z.string().nullable().optional(),
  defaultBedtimeUnits: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  isActive: z.string().default("true"),
}).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInsulinEntrySchema = createInsertSchema(insulinEntries, {
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付形式が正しくありません (YYYY-MM-DD)"),
  timeSlot: z.enum(["Breakfast", "Lunch", "Dinner", "Bedtime"], {
    errorMap: () => ({ message: "投与タイミングを選択してください" })
  }),
  units: z.string().transform((val) => val).refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0 && num <= 100;
  }, "投与量は0〜100の範囲で入力してください"),
  presetId: z.string().nullable().optional(),
  note: z.string().optional(),
}).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGlucoseEntrySchema = createInsertSchema(glucoseEntries, {
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付形式が正しくありません (YYYY-MM-DD)"),
  timeSlot: z.enum([
    "BreakfastBefore",    // 朝食前
    "BreakfastAfter1h",   // 朝食後1h
    "LunchBefore",        // 昼食前
    "LunchAfter1h",       // 昼食後1h
    "DinnerBefore",       // 夕食前
    "DinnerAfter1h",      // 夕食後1h
    "BeforeSleep",        // 眠前
    "Night"               // 夜間
  ], {
    errorMap: () => ({ message: "測定タイミングを選択してください" })
  }),
  glucoseLevel: z.number().int().min(20).max(600, "血糖値は20〜600の範囲で入力してください"),
  note: z.string().optional(),
}).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export type InsulinPreset = typeof insulinPresets.$inferSelect;
export type InsertInsulinPreset = z.infer<typeof insertInsulinPresetSchema>;
export type InsulinEntry = typeof insulinEntries.$inferSelect;
export type InsertInsulinEntry = z.infer<typeof insertInsulinEntrySchema>;
export type GlucoseEntry = typeof glucoseEntries.$inferSelect;
export type InsertGlucoseEntry = z.infer<typeof insertGlucoseEntrySchema>;

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
  presetId: varchar("preset_id").references(() => insulinPresets.id, { onDelete: "set null" }), // 使用するインスリンプリセット（省略可）
  
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
  presetId: z.string().nullable().optional(),
}).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export type AdjustmentRule = typeof adjustmentRules.$inferSelect;
export type InsertAdjustmentRule = z.infer<typeof insertAdjustmentRuleSchema>;
