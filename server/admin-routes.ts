import type { Express, Request, Response } from "express";
import { isAdmin, isAdminWritable } from "./auth";
import { adminStorage } from "./admin-storage";
import { createAuditLog } from "./audit";
import { storage } from "./storage";
import type { UserWithRole } from "@shared/schema";

export function registerAdminRoutes(app: Express): void {
  // ===== 管理者情報 =====

  // GET /api/admin/me - 管理者情報取得
  app.get("/api/admin/me", isAdmin, async (req: Request, res: Response) => {
    const user = req.user as UserWithRole;
    const { password: _password, ...safe } = user;
    res.json({ user: safe });
  });

  // POST /api/admin/logout - 管理者ログアウト
  app.post(
    "/api/admin/logout",
    isAdmin,
    (req: Request, res: Response) => {
      req.logout((err) => {
        if (err) {
          return res.status(500).json({ message: "ログアウトに失敗しました" });
        }
        res.json({ message: "ログアウトしました" });
      });
    }
  );

  // ===== ユーザー管理 =====

  // GET /api/admin/users - ユーザー一覧（?page, ?limit, ?search）
  app.get("/api/admin/users", isAdmin, async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(
        100,
        Math.max(1, parseInt(req.query.limit as string) || 20)
      );
      const search = (req.query.search as string) || undefined;
      const result = await adminStorage.listUsers({ page, limit, search });
      res.json(result);
    } catch (error) {
      console.error("ユーザー一覧取得エラー:", error);
      res.status(500).json({ message: "ユーザー一覧の取得に失敗しました" });
    }
  });

  // GET /api/admin/users/:id - ユーザー詳細
  app.get(
    "/api/admin/users/:id",
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const user = await adminStorage.getUserDetail(req.params.id);
        if (!user) {
          return res.status(404).json({ message: "ユーザーが見つかりません" });
        }
        res.json({ user });
      } catch (error) {
        console.error("ユーザー詳細取得エラー:", error);
        res.status(500).json({ message: "ユーザー情報の取得に失敗しました" });
      }
    }
  );

  // PATCH /api/admin/users/:id/status - ユーザー有効/無効切り替え
  app.patch(
    "/api/admin/users/:id/status",
    isAdminWritable,
    async (req: Request, res: Response) => {
      try {
        const { isActive } = req.body;
        if (typeof isActive !== "boolean") {
          return res.status(400).json({ message: "isActiveはboolean値が必要です" });
        }
        const admin = req.user as UserWithRole;
        const target = await adminStorage.getUserDetail(req.params.id);
        if (!target) {
          return res.status(404).json({ message: "ユーザーが見つかりません" });
        }
        if (target.id === admin.id) {
          return res
            .status(400)
            .json({ message: "自分自身のステータスは変更できません" });
        }

        await adminStorage.updateUserStatus(req.params.id, isActive);
        await createAuditLog(req, {
          adminId: admin.id,
          action: isActive ? "user.activate" : "user.deactivate",
          targetType: "user",
          targetId: req.params.id,
          previousValue: JSON.stringify({ isActive: target.isActive }),
          newValue: JSON.stringify({ isActive }),
        });
        res.json({
          message: `ユーザーを${isActive ? "有効化" : "無効化"}しました`,
        });
      } catch (error) {
        console.error("ユーザーステータス更新エラー:", error);
        res.status(500).json({ message: "ステータスの更新に失敗しました" });
      }
    }
  );

  // DELETE /api/admin/users/:id - ユーザー削除
  app.delete(
    "/api/admin/users/:id",
    isAdminWritable,
    async (req: Request, res: Response) => {
      try {
        const admin = req.user as UserWithRole;
        const target = await adminStorage.getUserDetail(req.params.id);
        if (!target) {
          return res.status(404).json({ message: "ユーザーが見つかりません" });
        }
        if (target.id === admin.id) {
          return res
            .status(400)
            .json({ message: "自分自身を削除することはできません" });
        }

        await adminStorage.deleteUser(req.params.id);
        await createAuditLog(req, {
          adminId: admin.id,
          action: "user.delete",
          targetType: "user",
          targetId: req.params.id,
          previousValue: JSON.stringify({ username: target.username }),
        });
        res.json({ message: "ユーザーを削除しました" });
      } catch (error) {
        console.error("ユーザー削除エラー:", error);
        res.status(500).json({ message: "ユーザーの削除に失敗しました" });
      }
    }
  );

  // ===== フィーチャーフラグ =====

  // GET /api/admin/feature-flags - フラグ一覧
  app.get(
    "/api/admin/feature-flags",
    isAdmin,
    async (_req: Request, res: Response) => {
      try {
        const flags = await adminStorage.getFeatureFlags();
        res.json({ flags });
      } catch (error) {
        console.error("フィーチャーフラグ取得エラー:", error);
        res
          .status(500)
          .json({ message: "フィーチャーフラグの取得に失敗しました" });
      }
    }
  );

  // PATCH /api/admin/feature-flags/:key - フラグ更新
  app.patch(
    "/api/admin/feature-flags/:key",
    isAdminWritable,
    async (req: Request, res: Response) => {
      try {
        const { value } = req.body;
        if (typeof value !== "boolean") {
          return res.status(400).json({ message: "valueはboolean値が必要です" });
        }
        const admin = req.user as UserWithRole;
        const existing = await adminStorage.getFeatureFlag(req.params.key);
        if (!existing) {
          return res
            .status(404)
            .json({ message: "フィーチャーフラグが見つかりません" });
        }

        await adminStorage.updateFeatureFlag(req.params.key, value, admin.id);
        await createAuditLog(req, {
          adminId: admin.id,
          action: "feature_flag.update",
          targetType: "feature_flag",
          targetId: req.params.key,
          previousValue: JSON.stringify({ value: existing.value }),
          newValue: JSON.stringify({ value }),
        });
        res.json({ message: "フィーチャーフラグを更新しました" });
      } catch (error) {
        console.error("フィーチャーフラグ更新エラー:", error);
        res
          .status(500)
          .json({ message: "フィーチャーフラグの更新に失敗しました" });
      }
    }
  );

  // ===== システム統計 =====

  // GET /api/admin/stats - ダッシュボード用集計データ
  app.get(
    "/api/admin/stats",
    isAdmin,
    async (_req: Request, res: Response) => {
      try {
        const stats = await adminStorage.getSystemStats();
        res.json({ stats });
      } catch (error) {
        console.error("統計情報取得エラー:", error);
        res.status(500).json({ message: "統計情報の取得に失敗しました" });
      }
    }
  );

  // ===== 監査ログ =====

  // GET /api/admin/audit-logs - 監査ログ一覧（?page, ?limit）
  app.get(
    "/api/admin/audit-logs",
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(
          100,
          Math.max(1, parseInt(req.query.limit as string) || 50)
        );
        const result = await adminStorage.getAuditLogs({ page, limit });
        res.json(result);
      } catch (error) {
        console.error("監査ログ取得エラー:", error);
        res.status(500).json({ message: "監査ログの取得に失敗しました" });
      }
    }
  );

  // ===== ユーザーフィードバック管理 =====

  // GET /api/admin/feedback - フィードバック一覧
  app.get("/api/admin/feedback", isAdmin, async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      const feedbacks = await storage.getFeedbacks(status);
      res.json({ feedbacks });
    } catch (error) {
      console.error("フィードバック取得エラー:", error);
      res.status(500).json({ message: "フィードバックの取得に失敗しました" });
    }
  });

  // PATCH /api/admin/feedback/:id/status - ステータス更新
  app.patch(
    "/api/admin/feedback/:id/status",
    isAdmin,
    isAdminWritable,
    async (req: Request, res: Response) => {
      try {
        const { status } = req.body;
        const allowed = ["open", "in_review", "done", "closed"];
        if (!status || !allowed.includes(status)) {
          return res.status(400).json({ message: "無効なステータスです" });
        }
        const updated = await storage.updateFeedbackStatus(req.params.id, status);
        if (!updated) return res.status(404).json({ message: "フィードバックが見つかりません" });
        return res.json({ feedback: updated });
      } catch (error) {
        console.error("フィードバックステータス更新エラー:", error);
        return res.status(500).json({ message: "更新に失敗しました" });
      }
    }
  );
}
