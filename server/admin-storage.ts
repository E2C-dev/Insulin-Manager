import { db } from "./db";
import {
  users,
  featureFlags,
  auditLogs,
  insulinEntries,
  glucoseEntries,
} from "@shared/schema";
import { eq, desc, ilike, count, gte, and } from "drizzle-orm";

export class AdminStorage {
  // ユーザー一覧（ページネーション + ユーザー名検索）
  async listUsers({
    page,
    limit,
    search,
  }: {
    page: number;
    limit: number;
    search?: string;
  }) {
    const offset = (page - 1) * limit;
    const whereClause = search
      ? ilike(users.username, `%${search}%`)
      : undefined;

    const [userList, totalCount] = await Promise.all([
      db
        .select({
          id: users.id,
          username: users.username,
          role: users.role,
          isActive: users.isActive,
          createdAt: users.createdAt,
          lastLoginAt: users.lastLoginAt,
        })
        .from(users)
        .where(whereClause)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(users).where(whereClause),
    ]);

    return {
      users: userList,
      pagination: { page, limit, total: Number(totalCount[0].count) },
    };
  }

  // ユーザー詳細（パスワード除外、記録数を含む）
  async getUserDetail(userId: string) {
    const userList = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!userList[0]) return null;

    const [insulinCount, glucoseCount] = await Promise.all([
      db
        .select({ count: count() })
        .from(insulinEntries)
        .where(eq(insulinEntries.userId, userId)),
      db
        .select({ count: count() })
        .from(glucoseEntries)
        .where(eq(glucoseEntries.userId, userId)),
    ]);

    const { password: _password, ...safeUser } = userList[0];
    return {
      ...safeUser,
      insulinEntryCount: Number(insulinCount[0].count),
      glucoseEntryCount: Number(glucoseCount[0].count),
    };
  }

  async updateUserStatus(userId: string, isActive: boolean) {
    return db.update(users).set({ isActive }).where(eq(users.id, userId));
  }

  async deleteUser(userId: string) {
    // CASCADE DELETEにより関連データも全て削除される
    return db.delete(users).where(eq(users.id, userId));
  }

  // フィーチャーフラグ操作
  async getFeatureFlags() {
    return db.select().from(featureFlags).orderBy(featureFlags.key);
  }

  async getFeatureFlag(key: string) {
    const result = await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.key, key))
      .limit(1);
    return result[0];
  }

  async updateFeatureFlag(key: string, value: boolean, updatedBy: string) {
    return db
      .update(featureFlags)
      .set({ value, updatedBy, updatedAt: new Date() })
      .where(eq(featureFlags.key, key));
  }

  // システム統計
  async getSystemStats() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [totalUsers, activeUsers, newUsers, flagCount] = await Promise.all([
      db
        .select({ count: count() })
        .from(users)
        .where(eq(users.role, "user")),
      db
        .select({ count: count() })
        .from(users)
        .where(and(eq(users.isActive, true), eq(users.role, "user"))),
      db
        .select({ count: count() })
        .from(users)
        .where(
          and(eq(users.role, "user"), gte(users.createdAt, sevenDaysAgo))
        ),
      db.select({ count: count() }).from(featureFlags),
    ]);

    return {
      totalUsers: Number(totalUsers[0].count),
      activeUsers: Number(activeUsers[0].count),
      newUsersLast7Days: Number(newUsers[0].count),
      featureFlagCount: Number(flagCount[0].count),
    };
  }

  // 監査ログ
  async getAuditLogs({ page, limit }: { page: number; limit: number }) {
    const offset = (page - 1) * limit;

    const logs = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        previousValue: auditLogs.previousValue,
        newValue: auditLogs.newValue,
        createdAt: auditLogs.createdAt,
        adminUsername: users.username,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.adminId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const [total] = await db.select({ count: count() }).from(auditLogs);
    return {
      logs,
      pagination: { page, limit, total: Number(total.count) },
    };
  }

  // 監査ログ記録
  async createAuditLog(data: {
    adminId: string;
    action: string;
    targetType: string;
    targetId?: string;
    previousValue?: string;
    newValue?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return db.insert(auditLogs).values(data);
  }
}

export const adminStorage = new AdminStorage();
