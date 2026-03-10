import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import passport, { hashPassword, verifyPassword, isAuthenticated } from "./auth";
import {
  insertUserSchema,
  insertInsulinPresetSchema,
  insertAdjustmentRuleSchema,
  insertInsulinEntrySchema,
  insertGlucoseEntrySchema,
  insertUserFeedbackSchema,
  changePasswordSchema,
  users,
  type User
} from "@shared/schema";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { registerAdminRoutes } from "./admin-routes";
import { adminStorage } from "./admin-storage";
import { db } from "./db";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  console.log("\n===========================================");
  console.log("🚀 APIルート登録開始");
  console.log("===========================================");
  
  // 登録エンドポイント
  console.log("✅ POST /api/auth/register");
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const timestamp = new Date().toISOString();
    console.log("\n===========================================");
    console.log(`[${timestamp}] 新規登録リクエスト開始`);
    console.log("リクエストボディ:", { 
      username: req.body?.username, 
      passwordLength: req.body?.password?.length 
    });
    
    try {
      // リクエストボディのバリデーション
      console.log("[STEP 1] バリデーションチェック");
      const validatedData = insertUserSchema.parse(req.body);
      console.log("✅ バリデーション成功:", { username: validatedData.username });
      
      // 既存ユーザーのチェック
      console.log("[STEP 2] 既存ユーザーチェック");
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        const errorMsg = "このユーザー名は既に使用されています";
        console.error(`❌ 登録失敗: ${errorMsg}`);
        console.error(`   既存ユーザー: ${existingUser.username} (ID: ${existingUser.id})`);
        console.log("===========================================\n");
        return res.status(400).json({ message: errorMsg });
      }
      console.log("✅ ユーザー名は使用可能");

      // パスワードをハッシュ化
      console.log("[STEP 3] パスワードのハッシュ化");
      const hashedPassword = await hashPassword(validatedData.password);
      console.log("✅ パスワードハッシュ化完了");
      
      // ユーザーを作成
      console.log("[STEP 4] ユーザー作成");
      const user = await storage.createUser({
        username: validatedData.username,
        password: hashedPassword,
      });
      console.log(`✅ ユーザー作成成功: ${user.username} (ID: ${user.id})`);

      // 自動ログイン
      console.log("[STEP 5] 自動ログイン処理");
      req.login(user, (err) => {
        if (err) {
          console.error("❌ ログインエラー:", err);
          console.log("===========================================\n");
          return res.status(500).json({ message: "ログインに失敗しました" });
        }
        
        console.log("✅ ログイン成功");
        // パスワードを除外してレスポンス
        const { password, ...userWithoutPassword } = user;
        console.log("✅ 登録プロセス完全完了");
        console.log("===========================================\n");
        return res.status(201).json({ 
          message: "アカウントが作成されました",
          user: userWithoutPassword 
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("❌ バリデーションエラー:", error.errors);
        const errorDetails = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(", ");
        console.error(`   詳細: ${errorDetails}`);
        console.log("===========================================\n");
        return res.status(400).json({ 
          message: `入力データが無効です: ${errorDetails}`,
          errors: error.errors 
        });
      }
      console.error("❌ 予期しないエラー:", error);
      console.error("   エラータイプ:", error instanceof Error ? error.constructor.name : typeof error);
      console.error("   エラーメッセージ:", error instanceof Error ? error.message : String(error));
      if (error instanceof Error && error.stack) {
        console.error("   スタックトレース:", error.stack);
      }
      console.log("===========================================\n");
      return res.status(500).json({
        message: "サーバーエラーが発生しました: " + (error instanceof Error ? error.message : String(error))
      });
    }
  });

  // ログインエンドポイント
  console.log("✅ POST /api/auth/login");
  app.post("/api/auth/login", (req: Request, res: Response, next) => {
    const timestamp = new Date().toISOString();
    console.log("\n===========================================");
    console.log(`[${timestamp}] ログインリクエスト開始`);
    console.log("ユーザー名:", req.body?.username);
    
    try {
      passport.authenticate("local", (err: any, user: User | false, info: any) => {
        if (err) {
          console.error("❌ 認証エラー:", err);
          console.log("===========================================\n");
          return res.status(500).json({ message: "サーバーエラーが発生しました" });
        }
        
        if (!user) {
          const errorMsg = info?.message || "認証に失敗しました";
          console.error(`❌ 認証失敗: ${errorMsg}`);
          console.log("===========================================\n");
          return res.status(401).json({ message: errorMsg });
        }

        console.log(`✅ 認証成功: ${user.username} (ID: ${user.id})`);
        req.login(user, async (err) => {
          if (err) {
            console.error("❌ ログインエラー:", err);
            console.log("===========================================\n");
            return res.status(500).json({ message: "ログインに失敗しました" });
          }

          // 最終ログイン日時を更新
          try {
            await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
          } catch (e) {
            console.warn("lastLoginAt更新エラー:", e);
          }

          console.log("✅ ログイン完了");
          console.log("===========================================\n");
          // パスワードを除外してレスポンス
          const { password, ...userWithoutPassword } = user;
          return res.json({
            message: "ログインに成功しました",
            user: userWithoutPassword
          });
        });
      })(req, res, next);
    } catch (error) {
      console.error("❌ ログインエンドポイントエラー:", error);
      console.log("===========================================\n");
      return res.status(500).json({ message: "サーバーエラーが発生しました" });
    }
  });

  // ログアウトエンドポイント
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ログアウトリクエスト`);
    
    try {
      const user = req.user as User | undefined;
      console.log("ログアウトユーザー:", user?.username || "不明");
      
      req.logout((err) => {
        if (err) {
          console.error("❌ ログアウトエラー:", err);
          return res.status(500).json({ message: "ログアウトに失敗しました" });
        }
        console.log("✅ ログアウト成功");
        return res.json({ message: "ログアウトしました" });
      });
    } catch (error) {
      console.error("❌ ログアウトエンドポイントエラー:", error);
      return res.status(500).json({ message: "サーバーエラーが発生しました" });
    }
  });

  // 現在のユーザー情報を取得
  console.log("✅ GET /api/auth/me");
  app.get("/api/auth/me", (req: Request, res: Response) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ユーザー情報取得リクエスト`);
    
    try {
      if (!req.isAuthenticated() || !req.user) {
        console.log("❌ 未認証");
        return res.status(401).json({ message: "認証されていません" });
      }
      
      const user = req.user as User;
      console.log(`✅ ユーザー情報取得: ${user.username} (ID: ${user.id})`);
      const { password, ...userWithoutPassword } = user;
      return res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("❌ ユーザー情報取得エラー:", error);
      return res.status(500).json({ message: "サーバーエラーが発生しました" });
    }
  });

  // チュートリアル閲覧済みを記録
  console.log("✅ POST /api/auth/tutorial-seen");
  app.post("/api/auth/tutorial-seen", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      await db.update(users)
        .set({ tutorialSeenAt: new Date() })
        .where(eq(users.id, user.id));
      return res.json({ ok: true });
    } catch (error) {
      console.error("❌ tutorial-seen更新エラー:", error);
      return res.status(500).json({ message: "サーバーエラーが発生しました" });
    }
  });

  // 保護されたエンドポイントの例
  console.log("✅ GET /api/protected");
  app.get("/api/protected", isAuthenticated, (req: Request, res: Response) => {
    res.json({ message: "認証されたユーザーのみアクセス可能です" });
  });

  // ===== 調整ルールのエンドポイント =====
  console.log("\n--- 調整ルールのエンドポイント ---");
  
  // ルール一覧取得
  console.log("✅ GET /api/adjustment-rules");
  app.get("/api/adjustment-rules", isAuthenticated, async (req: Request, res: Response) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 調整ルール一覧取得リクエスト`);
    
    try {
      const user = req.user as User;
      console.log(`ユーザー: ${user.username} (ID: ${user.id})`);
      
      const rules = await storage.getAdjustmentRules(user.id);
      console.log(`✅ ルール取得成功: ${rules.length}件`);
      
      return res.json({ rules });
    } catch (error) {
      console.error("❌ ルール一覧取得エラー:", error);
      return res.status(500).json({ message: "ルールの取得に失敗しました" });
    }
  });

  // ルール詳細取得
  app.get("/api/adjustment-rules/:id", isAuthenticated, async (req: Request, res: Response) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 調整ルール詳細取得リクエスト`);
    console.log("ルールID:", req.params.id);
    
    try {
      const user = req.user as User;
      const rule = await storage.getAdjustmentRule(req.params.id, user.id);
      
      if (!rule) {
        console.log("❌ ルールが見つかりません");
        return res.status(404).json({ message: "ルールが見つかりません" });
      }
      
      console.log(`✅ ルール取得成功: ${rule.name}`);
      return res.json({ rule });
    } catch (error) {
      console.error("❌ ルール詳細取得エラー:", error);
      return res.status(500).json({ message: "ルールの取得に失敗しました" });
    }
  });

  // ルール作成
  console.log("✅ POST /api/adjustment-rules");
  app.post("/api/adjustment-rules", isAuthenticated, async (req: Request, res: Response) => {
    const timestamp = new Date().toISOString();
    console.log("\n===========================================");
    console.log(`[${timestamp}] 調整ルール作成リクエスト`);
    console.log("リクエストボディ:", req.body);
    
    try {
      const user = req.user as User;
      console.log(`ユーザー: ${user.username} (ID: ${user.id})`);
      
      // バリデーション
      console.log("[STEP 1] バリデーション");
      const validatedData = insertAdjustmentRuleSchema.parse(req.body);
      console.log("✅ バリデーション成功");
      
      // ルール作成
      console.log("[STEP 2] ルール作成");
      const rule = await storage.createAdjustmentRule({
        ...validatedData,
        userId: user.id,
      });
      console.log(`✅ ルール作成成功: ${rule.name} (ID: ${rule.id})`);
      console.log("===========================================\n");
      
      return res.status(201).json({ 
        message: "ルールを作成しました",
        rule 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("❌ バリデーションエラー:", error.errors);
        const errorDetails = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(", ");
        console.log("===========================================\n");
        return res.status(400).json({ 
          message: `入力データが無効です: ${errorDetails}`,
          errors: error.errors 
        });
      }
      console.error("❌ ルール作成エラー:", error);
      console.log("===========================================\n");
      return res.status(500).json({ 
        message: "ルールの作成に失敗しました" 
      });
    }
  });

  // ルール更新
  console.log("✅ PUT /api/adjustment-rules/:id");
  app.put("/api/adjustment-rules/:id", isAuthenticated, async (req: Request, res: Response) => {
    const timestamp = new Date().toISOString();
    console.log("\n===========================================");
    console.log(`[${timestamp}] 調整ルール更新リクエスト`);
    console.log("ルールID:", req.params.id);
    console.log("更新データ:", req.body);
    
    try {
      const user = req.user as User;
      console.log(`ユーザー: ${user.username} (ID: ${user.id})`);
      
      // バリデーション
      console.log("[STEP 1] バリデーション");
      const validatedData = insertAdjustmentRuleSchema.partial().parse(req.body);
      console.log("✅ バリデーション成功");
      
      // ルール更新
      console.log("[STEP 2] ルール更新");
      const rule = await storage.updateAdjustmentRule(
        req.params.id,
        user.id,
        validatedData
      );
      
      if (!rule) {
        console.log("❌ ルールが見つかりません");
        console.log("===========================================\n");
        return res.status(404).json({ message: "ルールが見つかりません" });
      }
      
      console.log(`✅ ルール更新成功: ${rule.name} (ID: ${rule.id})`);
      console.log("===========================================\n");
      
      return res.json({ 
        message: "ルールを更新しました",
        rule 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("❌ バリデーションエラー:", error.errors);
        const errorDetails = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(", ");
        console.log("===========================================\n");
        return res.status(400).json({ 
          message: `入力データが無効です: ${errorDetails}`,
          errors: error.errors 
        });
      }
      console.error("❌ ルール更新エラー:", error);
      console.log("===========================================\n");
      return res.status(500).json({ 
        message: "ルールの更新に失敗しました" 
      });
    }
  });

  // ルール削除
  app.delete("/api/adjustment-rules/:id", isAuthenticated, async (req: Request, res: Response) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 調整ルール削除リクエスト`);
    console.log("ルールID:", req.params.id);
    
    try {
      const user = req.user as User;
      console.log(`ユーザー: ${user.username} (ID: ${user.id})`);
      
      const success = await storage.deleteAdjustmentRule(req.params.id, user.id);
      
      if (!success) {
        console.log("❌ ルールが見つかりません");
        return res.status(404).json({ message: "ルールが見つかりません" });
      }
      
      console.log("✅ ルール削除成功");
      return res.json({ message: "ルールを削除しました" });
    } catch (error) {
      console.error("❌ ルール削除エラー:", error);
      return res.status(500).json({ message: "ルールの削除に失敗しました" });
    }
  });

  // ===== インスリン投与記録のエンドポイント =====
  console.log("\n--- インスリン投与記録のエンドポイント ---");
  
  // インスリン記録一覧取得
  console.log("✅ GET /api/insulin-entries");
  app.get("/api/insulin-entries", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
      const entries = await storage.getInsulinEntries(user.id, startDate, endDate);
      return res.json({ entries });
    } catch (error) {
      console.error("❌ インスリン記録取得エラー:", error);
      return res.status(500).json({ message: "記録の取得に失敗しました" });
    }
  });

  // インスリン記録作成
  console.log("✅ POST /api/insulin-entries");
  app.post("/api/insulin-entries", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const validatedData = insertInsulinEntrySchema.parse(req.body);
      const entry = await storage.createInsulinEntry({
        ...validatedData,
        userId: user.id,
      });
      return res.status(201).json({ message: "記録を作成しました", entry });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "入力データが無効です",
          errors: error.errors 
        });
      }
      console.error("❌ インスリン記録作成エラー:", error);
      return res.status(500).json({ message: "記録の作成に失敗しました" });
    }
  });

  // インスリン記録更新
  console.log("✅ PUT /api/insulin-entries/:id");
  app.put("/api/insulin-entries/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const validatedData = insertInsulinEntrySchema.partial().parse(req.body);
      const entry = await storage.updateInsulinEntry(req.params.id, user.id, validatedData);
      
      if (!entry) {
        return res.status(404).json({ message: "記録が見つかりません" });
      }
      
      return res.json({ message: "記録を更新しました", entry });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "入力データが無効です",
          errors: error.errors 
        });
      }
      console.error("❌ インスリン記録更新エラー:", error);
      return res.status(500).json({ message: "記録の更新に失敗しました" });
    }
  });

  // インスリン記録削除
  console.log("✅ DELETE /api/insulin-entries/:id");
  app.delete("/api/insulin-entries/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const success = await storage.deleteInsulinEntry(req.params.id, user.id);
      
      if (!success) {
        return res.status(404).json({ message: "記録が見つかりません" });
      }
      
      return res.json({ message: "記録を削除しました" });
    } catch (error) {
      console.error("❌ インスリン記録削除エラー:", error);
      return res.status(500).json({ message: "記録の削除に失敗しました" });
    }
  });

  // ===== 血糖値測定記録のエンドポイント =====
  console.log("\n--- 血糖値測定記録のエンドポイント ---");
  
  // 血糖値記録一覧取得
  console.log("✅ GET /api/glucose-entries");
  app.get("/api/glucose-entries", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
      const entries = await storage.getGlucoseEntries(user.id, startDate, endDate);
      return res.json({ entries });
    } catch (error) {
      console.error("❌ 血糖値記録取得エラー:", error);
      return res.status(500).json({ message: "記録の取得に失敗しました" });
    }
  });

  // 血糖値記録作成
  console.log("✅ POST /api/glucose-entries");
  app.post("/api/glucose-entries", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const validatedData = insertGlucoseEntrySchema.parse(req.body);
      const entry = await storage.createGlucoseEntry({
        ...validatedData,
        userId: user.id,
      });
      return res.status(201).json({ message: "記録を作成しました", entry });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "入力データが無効です",
          errors: error.errors 
        });
      }
      console.error("❌ 血糖値記録作成エラー:", error);
      return res.status(500).json({ message: "記録の作成に失敗しました" });
    }
  });

  // 血糖値記録更新
  console.log("✅ PUT /api/glucose-entries/:id");
  app.put("/api/glucose-entries/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const validatedData = insertGlucoseEntrySchema.partial().parse(req.body);
      const entry = await storage.updateGlucoseEntry(req.params.id, user.id, validatedData);
      
      if (!entry) {
        return res.status(404).json({ message: "記録が見つかりません" });
      }
      
      return res.json({ message: "記録を更新しました", entry });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "入力データが無効です",
          errors: error.errors 
        });
      }
      console.error("❌ 血糖値記録更新エラー:", error);
      return res.status(500).json({ message: "記録の更新に失敗しました" });
    }
  });

  // 血糖値記録削除
  console.log("✅ DELETE /api/glucose-entries/:id");
  app.delete("/api/glucose-entries/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const success = await storage.deleteGlucoseEntry(req.params.id, user.id);
      
      if (!success) {
        return res.status(404).json({ message: "記録が見つかりません" });
      }
      
      return res.json({ message: "記録を削除しました" });
    } catch (error) {
      console.error("❌ 血糖値記録削除エラー:", error);
      return res.status(500).json({ message: "記録の削除に失敗しました" });
    }
  });

  // ===== インスリンプリセットのエンドポイント =====
  console.log("\n--- インスリンプリセットのエンドポイント ---");

  // プリセット一覧取得
  console.log("✅ GET /api/insulin-presets");
  app.get("/api/insulin-presets", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const presets = await storage.getInsulinPresets(user.id);
      return res.json({ presets });
    } catch (error) {
      console.error("❌ プリセット一覧取得エラー:", error);
      return res.status(500).json({ message: "プリセットの取得に失敗しました" });
    }
  });

  // プリセット作成
  console.log("✅ POST /api/insulin-presets");
  app.post("/api/insulin-presets", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const validatedData = insertInsulinPresetSchema.parse(req.body);
      const preset = await storage.createInsulinPreset({ ...validatedData, userId: user.id });
      return res.status(201).json({ message: "プリセットを作成しました", preset });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "入力データが無効です", errors: error.errors });
      }
      console.error("❌ プリセット作成エラー:", error);
      return res.status(500).json({ message: "プリセットの作成に失敗しました" });
    }
  });

  // プリセット更新
  console.log("✅ PUT /api/insulin-presets/:id");
  app.put("/api/insulin-presets/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const validatedData = insertInsulinPresetSchema.partial().parse(req.body);
      const preset = await storage.updateInsulinPreset(req.params.id, user.id, validatedData);
      if (!preset) return res.status(404).json({ message: "プリセットが見つかりません" });
      return res.json({ message: "プリセットを更新しました", preset });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "入力データが無効です", errors: error.errors });
      }
      console.error("❌ プリセット更新エラー:", error);
      return res.status(500).json({ message: "プリセットの更新に失敗しました" });
    }
  });

  // プリセット削除（ソフトデリート）
  console.log("✅ DELETE /api/insulin-presets/:id");
  app.delete("/api/insulin-presets/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const success = await storage.deleteInsulinPreset(req.params.id, user.id);
      if (!success) return res.status(404).json({ message: "プリセットが見つかりません" });
      return res.json({ message: "プリセットを削除しました" });
    } catch (error) {
      console.error("❌ プリセット削除エラー:", error);
      return res.status(500).json({ message: "プリセットの削除に失敗しました" });
    }
  });

  // ===== ユーザーフィードバック =====
  // フィードバック送信（認証不要 — ログイン前のユーザーからも受付）
  app.post("/api/feedback", async (req: Request, res: Response) => {
    try {
      const validatedData = insertUserFeedbackSchema.parse(req.body);
      const userId = req.isAuthenticated() ? (req.user as User).id : undefined;
      const feedback = await storage.createFeedback({ ...validatedData, userId });
      return res.status(201).json({ message: "フィードバックを送信しました", feedback });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "入力内容が正しくありません", errors: error.errors });
      }
      console.error("❌ フィードバック送信エラー:", error);
      return res.status(500).json({ message: "フィードバックの送信に失敗しました" });
    }
  });

  // フィーチャーフラグ公開API（認証不要、フロントエンドの表示制御用）
  app.get("/api/feature-flags/public", async (_req: Request, res: Response) => {
    try {
      const flags = await adminStorage.getFeatureFlags();
      const flagMap = flags.reduce(
        (acc, f) => ({ ...acc, [f.key]: f.value }),
        {} as Record<string, boolean>
      );
      res.json({ flags: flagMap });
    } catch (error) {
      console.error("フィーチャーフラグ取得エラー:", error);
      // エラー時はデフォルト値を返す
      res.json({ flags: { show_ads: false, enable_user_registration: true } });
    }
  });

  // パスワード変更（ユーザー本人）
  app.put("/api/auth/password", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const validated = changePasswordSchema.parse(req.body);

      // 現在のパスワード検証
      const isValid = await verifyPassword(validated.currentPassword, user.password);
      if (!isValid) {
        return res.status(400).json({ message: "現在のパスワードが正しくありません" });
      }

      const hashed = await hashPassword(validated.newPassword);
      await storage.updateUserPassword(user.id, hashed);

      return res.json({ message: "パスワードを変更しました" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "入力内容を確認してください", errors: error.errors });
      }
      console.error("パスワード変更エラー:", error);
      return res.status(500).json({ message: "パスワードの変更に失敗しました" });
    }
  });

  // 管理者ルート登録
  registerAdminRoutes(app);

  console.log("===========================================");
  console.log("🎉 すべてのAPIルート登録完了");
  console.log("   - 認証: 4エンドポイント");
  console.log("   - 調整ルール: 5エンドポイント");
  console.log("   - インスリン記録: 4エンドポイント");
  console.log("   - 血糖値記録: 4エンドポイント");
  console.log("   - インスリンプリセット: 4エンドポイント");
  console.log("   - その他: 1エンドポイント");
  console.log("   - 管理者API: 10エンドポイント");
  console.log("===========================================\n");

  return httpServer;
}
