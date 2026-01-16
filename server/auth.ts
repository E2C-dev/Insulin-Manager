import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import type { User } from "@shared/schema";

// パスワードをハッシュ化する関数
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

// パスワードを検証する関数
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

// Passport Local Strategy の設定
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return done(null, false, { message: "ユーザー名またはパスワードが正しくありません" });
      }

      const isValid = await verifyPassword(password, user.password);
      
      if (!isValid) {
        return done(null, false, { message: "ユーザー名またはパスワードが正しくありません" });
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  })
);

// セッションにユーザーIDを保存
passport.serializeUser((user, done) => {
  done(null, (user as User).id);
});

// セッションからユーザー情報を復元
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await storage.getUser(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// 認証チェックのミドルウェア
export function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "認証が必要です" });
}

export default passport;

