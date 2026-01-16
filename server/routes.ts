import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import passport, { hashPassword, isAuthenticated } from "./auth";
import { insertUserSchema, type User } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // 登録エンドポイント
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      // リクエストボディのバリデーション
      const validatedData = insertUserSchema.parse(req.body);
      
      // 既存ユーザーのチェック
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).json({ message: "このユーザー名は既に使用されています" });
      }

      // パスワードをハッシュ化
      const hashedPassword = await hashPassword(validatedData.password);
      
      // ユーザーを作成
      const user = await storage.createUser({
        username: validatedData.username,
        password: hashedPassword,
      });

      // 自動ログイン
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "ログインに失敗しました" });
        }
        
        // パスワードを除外してレスポンス
        const { password, ...userWithoutPassword } = user;
        return res.status(201).json({ 
          message: "アカウントが作成されました",
          user: userWithoutPassword 
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "入力データが無効です",
          errors: error.errors 
        });
      }
      console.error("登録エラー:", error);
      res.status(500).json({ message: "サーバーエラーが発生しました" });
    }
  });

  // ログインエンドポイント
  app.post("/api/auth/login", (req: Request, res: Response, next) => {
    try {
      passport.authenticate("local", (err: any, user: User | false, info: any) => {
        if (err) {
          console.error("認証エラー:", err);
          return res.status(500).json({ message: "サーバーエラーが発生しました" });
        }
        
        if (!user) {
          return res.status(401).json({ message: info?.message || "認証に失敗しました" });
        }

        req.login(user, (err) => {
          if (err) {
            console.error("ログインエラー:", err);
            return res.status(500).json({ message: "ログインに失敗しました" });
          }
          
          // パスワードを除外してレスポンス
          const { password, ...userWithoutPassword } = user;
          return res.json({ 
            message: "ログインに成功しました",
            user: userWithoutPassword 
          });
        });
      })(req, res, next);
    } catch (error) {
      console.error("ログインエンドポイントエラー:", error);
      return res.status(500).json({ message: "サーバーエラーが発生しました" });
    }
  });

  // ログアウトエンドポイント
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    try {
      req.logout((err) => {
        if (err) {
          console.error("ログアウトエラー:", err);
          return res.status(500).json({ message: "ログアウトに失敗しました" });
        }
        return res.json({ message: "ログアウトしました" });
      });
    } catch (error) {
      console.error("ログアウトエンドポイントエラー:", error);
      return res.status(500).json({ message: "サーバーエラーが発生しました" });
    }
  });

  // 現在のユーザー情報を取得
  app.get("/api/auth/me", (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "認証されていません" });
      }
      
      const user = req.user as User;
      const { password, ...userWithoutPassword } = user;
      return res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("ユーザー情報取得エラー:", error);
      return res.status(500).json({ message: "サーバーエラーが発生しました" });
    }
  });

  // 保護されたエンドポイントの例
  app.get("/api/protected", isAuthenticated, (req: Request, res: Response) => {
    res.json({ message: "認証されたユーザーのみアクセス可能です" });
  });

  return httpServer;
}
