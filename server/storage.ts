import {
  type User,
  type InsertUser,
  type AdjustmentRule,
  type InsertAdjustmentRule,
  type InsulinPreset,
  type InsertInsulinPreset,
  type InsulinEntry,
  type InsertInsulinEntry,
  type GlucoseEntry,
  type InsertGlucoseEntry,
  users,
  adjustmentRules,
  insulinPresets,
  insulinEntries,
  glucoseEntries
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Insulin Preset methods
  getInsulinPresets(userId: string): Promise<InsulinPreset[]>;
  getInsulinPreset(id: string, userId: string): Promise<InsulinPreset | undefined>;
  createInsulinPreset(preset: InsertInsulinPreset & { userId: string }): Promise<InsulinPreset>;
  updateInsulinPreset(id: string, userId: string, preset: Partial<InsertInsulinPreset>): Promise<InsulinPreset | undefined>;
  deleteInsulinPreset(id: string, userId: string): Promise<boolean>;

  // Adjustment Rule methods
  getAdjustmentRules(userId: string): Promise<AdjustmentRule[]>;
  getAdjustmentRule(id: string, userId: string): Promise<AdjustmentRule | undefined>;
  createAdjustmentRule(rule: InsertAdjustmentRule & { userId: string }): Promise<AdjustmentRule>;
  updateAdjustmentRule(id: string, userId: string, rule: Partial<InsertAdjustmentRule>): Promise<AdjustmentRule | undefined>;
  deleteAdjustmentRule(id: string, userId: string): Promise<boolean>;
  
  // Insulin Entry methods
  getInsulinEntries(userId: string, startDate?: string, endDate?: string): Promise<InsulinEntry[]>;
  getInsulinEntry(id: string, userId: string): Promise<InsulinEntry | undefined>;
  createInsulinEntry(entry: InsertInsulinEntry & { userId: string }): Promise<InsulinEntry>;
  updateInsulinEntry(id: string, userId: string, entry: Partial<InsertInsulinEntry>): Promise<InsulinEntry | undefined>;
  deleteInsulinEntry(id: string, userId: string): Promise<boolean>;
  
  // Glucose Entry methods
  getGlucoseEntries(userId: string, startDate?: string, endDate?: string): Promise<GlucoseEntry[]>;
  getGlucoseEntry(id: string, userId: string): Promise<GlucoseEntry | undefined>;
  createGlucoseEntry(entry: InsertGlucoseEntry & { userId: string }): Promise<GlucoseEntry>;
  updateGlucoseEntry(id: string, userId: string, entry: Partial<InsertGlucoseEntry>): Promise<GlucoseEntry | undefined>;
  deleteGlucoseEntry(id: string, userId: string): Promise<boolean>;
}

export class DbStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db
      .insert(users)
      .values(insertUser)
      .returning();
    
    return result[0];
  }

  // Insulin Preset methods
  async getInsulinPresets(userId: string): Promise<InsulinPreset[]> {
    return db
      .select()
      .from(insulinPresets)
      .where(and(eq(insulinPresets.userId, userId), eq(insulinPresets.isActive, "true")))
      .orderBy(insulinPresets.sortOrder, insulinPresets.createdAt);
  }

  async getInsulinPreset(id: string, userId: string): Promise<InsulinPreset | undefined> {
    const result = await db
      .select()
      .from(insulinPresets)
      .where(and(eq(insulinPresets.id, id), eq(insulinPresets.userId, userId)))
      .limit(1);
    return result[0];
  }

  async createInsulinPreset(preset: InsertInsulinPreset & { userId: string }): Promise<InsulinPreset> {
    const result = await db
      .insert(insulinPresets)
      .values(preset)
      .returning();
    return result[0];
  }

  async updateInsulinPreset(
    id: string,
    userId: string,
    preset: Partial<InsertInsulinPreset>
  ): Promise<InsulinPreset | undefined> {
    const result = await db
      .update(insulinPresets)
      .set({ ...preset, updatedAt: new Date() })
      .where(and(eq(insulinPresets.id, id), eq(insulinPresets.userId, userId)))
      .returning();
    return result[0];
  }

  async deleteInsulinPreset(id: string, userId: string): Promise<boolean> {
    // ソフトデリート: 過去の記録との連携を保持するため削除フラグを立てる
    const result = await db
      .update(insulinPresets)
      .set({ isActive: "false", updatedAt: new Date() })
      .where(and(eq(insulinPresets.id, id), eq(insulinPresets.userId, userId)))
      .returning();
    return result.length > 0;
  }

  // Adjustment Rule methods
  async getAdjustmentRules(userId: string): Promise<AdjustmentRule[]> {
    const result = await db
      .select()
      .from(adjustmentRules)
      .where(eq(adjustmentRules.userId, userId))
      .orderBy(desc(adjustmentRules.createdAt));
    
    return result;
  }

  async getAdjustmentRule(id: string, userId: string): Promise<AdjustmentRule | undefined> {
    const result = await db
      .select()
      .from(adjustmentRules)
      .where(and(
        eq(adjustmentRules.id, id),
        eq(adjustmentRules.userId, userId)
      ))
      .limit(1);
    
    return result[0];
  }

  async createAdjustmentRule(rule: InsertAdjustmentRule & { userId: string }): Promise<AdjustmentRule> {
    const result = await db
      .insert(adjustmentRules)
      .values(rule)
      .returning();
    
    return result[0];
  }

  async updateAdjustmentRule(
    id: string, 
    userId: string, 
    rule: Partial<InsertAdjustmentRule>
  ): Promise<AdjustmentRule | undefined> {
    const result = await db
      .update(adjustmentRules)
      .set({ ...rule, updatedAt: new Date() })
      .where(and(
        eq(adjustmentRules.id, id),
        eq(adjustmentRules.userId, userId)
      ))
      .returning();
    
    return result[0];
  }

  async deleteAdjustmentRule(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(adjustmentRules)
      .where(and(
        eq(adjustmentRules.id, id),
        eq(adjustmentRules.userId, userId)
      ))
      .returning();
    
    return result.length > 0;
  }

  // Insulin Entry methods
  async getInsulinEntries(userId: string, startDate?: string, endDate?: string): Promise<InsulinEntry[]> {
    let query = db
      .select()
      .from(insulinEntries)
      .where(eq(insulinEntries.userId, userId))
      .orderBy(desc(insulinEntries.date), desc(insulinEntries.createdAt));
    
    // Date filtering can be added here if needed
    const result = await query;
    return result;
  }

  async getInsulinEntry(id: string, userId: string): Promise<InsulinEntry | undefined> {
    const result = await db
      .select()
      .from(insulinEntries)
      .where(and(
        eq(insulinEntries.id, id),
        eq(insulinEntries.userId, userId)
      ))
      .limit(1);
    
    return result[0];
  }

  async createInsulinEntry(entry: InsertInsulinEntry & { userId: string }): Promise<InsulinEntry> {
    const result = await db
      .insert(insulinEntries)
      .values(entry)
      .returning();
    
    return result[0];
  }

  async updateInsulinEntry(
    id: string, 
    userId: string, 
    entry: Partial<InsertInsulinEntry>
  ): Promise<InsulinEntry | undefined> {
    const result = await db
      .update(insulinEntries)
      .set({ ...entry, updatedAt: new Date() })
      .where(and(
        eq(insulinEntries.id, id),
        eq(insulinEntries.userId, userId)
      ))
      .returning();
    
    return result[0];
  }

  async deleteInsulinEntry(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(insulinEntries)
      .where(and(
        eq(insulinEntries.id, id),
        eq(insulinEntries.userId, userId)
      ))
      .returning();
    
    return result.length > 0;
  }

  // Glucose Entry methods
  async getGlucoseEntries(userId: string, startDate?: string, endDate?: string): Promise<GlucoseEntry[]> {
    let query = db
      .select()
      .from(glucoseEntries)
      .where(eq(glucoseEntries.userId, userId))
      .orderBy(desc(glucoseEntries.date), desc(glucoseEntries.createdAt));
    
    // Date filtering can be added here if needed
    const result = await query;
    return result;
  }

  async getGlucoseEntry(id: string, userId: string): Promise<GlucoseEntry | undefined> {
    const result = await db
      .select()
      .from(glucoseEntries)
      .where(and(
        eq(glucoseEntries.id, id),
        eq(glucoseEntries.userId, userId)
      ))
      .limit(1);
    
    return result[0];
  }

  async createGlucoseEntry(entry: InsertGlucoseEntry & { userId: string }): Promise<GlucoseEntry> {
    const result = await db
      .insert(glucoseEntries)
      .values(entry)
      .returning();
    
    return result[0];
  }

  async updateGlucoseEntry(
    id: string, 
    userId: string, 
    entry: Partial<InsertGlucoseEntry>
  ): Promise<GlucoseEntry | undefined> {
    const result = await db
      .update(glucoseEntries)
      .set({ ...entry, updatedAt: new Date() })
      .where(and(
        eq(glucoseEntries.id, id),
        eq(glucoseEntries.userId, userId)
      ))
      .returning();
    
    return result[0];
  }

  async deleteGlucoseEntry(id: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(glucoseEntries)
      .where(and(
        eq(glucoseEntries.id, id),
        eq(glucoseEntries.userId, userId)
      ))
      .returning();
    
    return result.length > 0;
  }
}

export const storage = new DbStorage();
