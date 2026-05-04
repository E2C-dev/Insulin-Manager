import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { metaImagesPlugin } from "./vite-plugin-meta-images";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    tailwindcss(),
    metaImagesPlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        /**
         * manualChunks (S2-5 / Sprint 2)
         *
         * 目的:
         *   単一 entry chunk (~850KB) を vendor 系で分割し、初期読み込み量を削減する。
         *   ページ単位の動的 import は App.tsx 側で React.lazy により実施。
         *
         * 設計判断:
         *   - 関数形式を採用 (id ベース) — 将来 vendor が増えても列挙メンテ不要にする
         *   - 順序は具体度の高いマッチを先に置く (例: react-hook-form を react より先に判定)
         *   - 該当しない node_modules は vendor-other にまとめる (細かすぎる分割は HTTP 並列上限・キャッシュ非効率を招く)
         *   - アプリケーションコードは Vite/Rollup の自動分割 (route lazy) に任せる
         *
         * AP三重管理:
         *   - 共通モジュール化: 本設定 (manualChunks 関数)
         *   - 単体テスト: Sprint 4 で chunk 出力検証スクリプト追加予定
         *   - ドキュメント: AP-020 (将来採番、初期 bundle 350KB 上限ガイドライン)
         */
        manualChunks(id: string) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          // 具体度の高いものを先に判定する。"react" は他多数のパッケージ名にマッチするため最後に
          if (
            id.includes("react-hook-form") ||
            id.includes("@hookform") ||
            id.includes("/zod/") ||
            id.includes("zod-validation-error")
          ) {
            return "vendor-form";
          }

          if (id.includes("@tanstack")) {
            return "vendor-tanstack";
          }

          if (id.includes("@radix-ui")) {
            return "vendor-radix";
          }

          if (id.includes("jspdf")) {
            return "vendor-pdf";
          }

          if (id.includes("lucide-react")) {
            return "vendor-icons";
          }

          if (id.includes("date-fns")) {
            return "vendor-date";
          }

          if (id.includes("framer-motion")) {
            return "vendor-motion";
          }

          // react / react-dom / scheduler 等の React Core
          // (上記マッチを潜り抜けた "react" は概ね core と判定して良い)
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/") ||
            id.includes("react/jsx-runtime")
          ) {
            return "vendor-react";
          }

          return "vendor-other";
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
