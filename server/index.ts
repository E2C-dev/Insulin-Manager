import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import passport from "./auth";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

// 本番環境でプロキシ経由のリクエストを信頼する
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// セッション管理の設定
//
// BUG-015 (CSRF 対策の確認 — 2026-04-28 Sprint 3):
// 当アプリは Passport.js + express-session のセッションベース認証で、
// 全 state-changing API (POST/PUT/DELETE) は同一オリジン Same-Site Cookie に依存している。
//   - sameSite: "lax" → cross-site POST はクッキーが送られないため、外部サイト経由の CSRF を実質的にブロック
//   - httpOnly: true → クッキーへの JS アクセスを禁止 (XSS が起きてもセッションを盗めない)
//   - secure: 本番のみ true → HTTPS でのみ送信
// 追加の csurf トークン導入は現状不要と判断 (cf. OWASP "SameSite Cookie Attribute" recommendation)。
// 将来的に外部ドメインからの API 呼び出しを許可する場合は、再評価して csurf or double submit token 導入。
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7日間
      sameSite: "lax",
    },
  })
);

// Passportの初期化
app.use(passport.initialize());
app.use(passport.session());

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // APIリクエストの受信ログ
  if (path.startsWith("/api")) {
    console.log(`\n>>> 受信: ${req.method} ${path}`);
    console.log(`    時刻: ${new Date().toISOString()}`);
    console.log(`    Content-Type: ${req.headers['content-type']}`);
    if (req.body && Object.keys(req.body).length > 0) {
      console.log(`    Body:`, req.body);
    }
  }

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `<<< レスポンス: ${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      console.log(logLine + "\n");
    }
  });

  next();
});

(async () => {
  console.log("\n");
  console.log("╔════════════════════════════════════════╗");
  console.log("║     サーバー起動プロセス開始           ║");
  console.log("╚════════════════════════════════════════╝");
  console.log("");
  
  // データベース初期化
  console.log("📦 データベース初期化中...");
  const { initDb } = await import("./db");
  await initDb();
  console.log("✅ データベース初期化完了\n");

  console.log("🛣️  ルート登録中...");
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("サーバーエラー:", err);
    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      console.log("");
      console.log("╔════════════════════════════════════════╗");
      console.log("║  🚀 サーバー起動成功！                 ║");
      console.log("╚════════════════════════════════════════╝");
      console.log(`📍 ポート: ${port}`);
      console.log(`📍 ホスト: 0.0.0.0`);
      console.log(`📍 環境: ${process.env.NODE_ENV || "development"}`);
      console.log("");
      console.log("準備完了！リクエストを待機中...");
      console.log("=====================================\n");
    },
  );
})();
