import { 
  type User, 
  type InsertUser, 
  type AdjustmentRule, 
  type InsertAdjustmentRule,
  users,
  adjustmentRules 
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
  
  // Adjustment Rule methods
  getAdjustmentRules(userId: string): Promise<AdjustmentRule[]>;
  getAdjustmentRule(id: string, userId: string): Promise<AdjustmentRule | undefined>;
  createAdjustmentRule(rule: InsertAdjustmentRule & { userId: string }): Promise<AdjustmentRule>;
  updateAdjustmentRule(id: string, userId: string, rule: Partial<InsertAdjustmentRule>): Promise<AdjustmentRule | undefined>;
  deleteAdjustmentRule(id: string, userId: string): Promise<boolean>;
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
}

export const storage = new DbStorage();
