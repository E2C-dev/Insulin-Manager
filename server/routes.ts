import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import passport, { hashPassword, isAuthenticated } from "./auth";
import { insertUserSchema, insertAdjustmentRuleSchema, type User } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // 登録エンドポイント
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
      res.status(500).json({ 
        message: "サーバーエラーが発生しました: " + (error instanceof Error ? error.message : String(error))
      });
    }
  });

  // ログインエンドポイント
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
        req.login(user, (err) => {
          if (err) {
            console.error("❌ ログインエラー:", err);
            console.log("===========================================\n");
            return res.status(500).json({ message: "ログインに失敗しました" });
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

  // 保護されたエンドポイントの例
  app.get("/api/protected", isAuthenticated, (req: Request, res: Response) => {
    res.json({ message: "認証されたユーザーのみアクセス可能です" });
  });

  // ===== 調整ルールのエンドポイント =====
  
  // ルール一覧取得
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

  return httpServer;
}
