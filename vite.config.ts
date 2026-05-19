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
         * manualChunks (S5-2 / Sprint 5)
         *
         * 目的:
         *   vendor-other (旧 537KB) を更に細分化し、初期読み込み量と
         *   キャッシュ効率を改善する。
         *
         * Sprint 2 → Sprint 5 の変化:
         *   - vendor-form / vendor-pdf は維持
         *   - vendor-sentry: @sentry/react は単独で >100KB 想定 → 分離
         *   - vendor-vitals: web-vitals は小さいが独立計測ロジック → 分離
         *   - vendor-utils: clsx / cva / tailwind-merge / dompurify など UI utils
         *   - vendor-ui-extras: cmdk / sonner / vaul / embla-carousel /
         *     react-day-picker / react-resizable-panels / input-otp / wouter /
         *     next-themes / tw-animate-css / tailwindcss-animate
         *     (Radix と並んで UI 周辺の重め依存をまとめる)
         *
         * 設計判断:
         *   - 関数形式 (id ベース) は維持。順序依存に注意 (具体度高い順)
         *   - 過剰分割は HTTP 並列上限・キャッシュ非効率を招くため、
         *     vendor-other に残るのは < 100KB を目標
         *   - chunk 数が 10〜12 程度になっても HTTP/2 multiplex で問題なし
         *
         * AP三重管理:
         *   - 共通モジュール化: 本設定 (manualChunks 関数)
         *   - 単体テスト: Sprint 4 で chunk 出力検証スクリプト追加済
         *   - ドキュメント: AP-020 (初期 bundle 350KB 上限ガイドライン)
         */
        manualChunks(id: string) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          // ───────────────────────────────────────────────────
          // 1. 具体度の高いマッチを先に判定
          // ───────────────────────────────────────────────────

          // form 系 (react-hook-form / @hookform / zod)
          if (
            id.includes("react-hook-form") ||
            id.includes("@hookform") ||
            id.includes("/zod/") ||
            id.includes("zod-validation-error")
          ) {
            return "vendor-form";
          }

          // tanstack (react-query 等)
          if (id.includes("@tanstack")) {
            return "vendor-tanstack";
          }

          // Radix UI (大量のプリミティブ)
          if (id.includes("@radix-ui")) {
            return "vendor-radix";
          }

          // PDF rendering peer deps (html2canvas / canvg + SVG/canvas helpers)
          // jspdf が .html() / SVG 変換で間接参照する重量ライブラリ群。
          // 本アプリは jsPDF をテーブル出力にしか使わず html2canvas は dead code 相当だが、
          // jspdf 内部の require が静的 → tree-shake 不可のため chunk 分離で対処。
          // PDF 機能 (Logbook lazy) と一緒にしか load されないので、
          // 並列 fetch 効率のため vendor-pdf-canvas として独立させる。
          if (
            id.includes("/html2canvas/") ||
            id.includes("/canvg/") ||
            id.includes("/stackblur-canvas/") ||
            id.includes("/rgbcolor/") ||
            id.includes("/svg-pathdata/") ||
            id.includes("/raf/") ||
            id.includes("performance-now") ||
            id.includes("/fast-png/") ||
            id.includes("/iobuffer/")
          ) {
            return "vendor-pdf-canvas";
          }

          // PDF compression libs (pako / fflate)
          // 圧縮ロジックは独立した塊。chunk 分離して単一上限を守る。
          if (id.includes("/pako/") || id.includes("/fflate/")) {
            return "vendor-pdf-compress";
          }

          // core-js (jspdf 経由のポリフィル群)
          if (id.includes("/core-js/") || id.includes("core-js-pure")) {
            return "vendor-pdf-polyfills";
          }

          // PDF table plugin (jspdf-autotable, テーブル描画ロジック)
          // jspdf 本体と分離することで、それぞれを 350KB 上限に収める。
          if (id.includes("jspdf-autotable")) {
            return "vendor-pdf-table";
          }

          // PDF core (jspdf 本体のみ)
          if (id.includes("jspdf")) {
            return "vendor-pdf";
          }

          // Lucide アイコン
          if (id.includes("lucide-react")) {
            return "vendor-icons";
          }

          // date-fns
          if (id.includes("date-fns")) {
            return "vendor-date";
          }

          // framer-motion (motion-dom / motion-utils も実体は framer-motion 由来)
          if (
            id.includes("framer-motion") ||
            id.includes("motion-dom") ||
            id.includes("motion-utils")
          ) {
            return "vendor-motion";
          }

          // @babel/runtime (transpiler runtime helpers)
          if (id.includes("@babel/runtime")) {
            return "vendor-babel";
          }

          // Floating UI (Radix の peer dep だが独立計算)
          if (id.includes("@floating-ui")) {
            return "vendor-radix";
          }

          // Radix の周辺 utility (react-remove-scroll / aria-hidden 等)
          // → Radix と同じ chunk にまとめる方がキャッシュ効率が良い
          if (
            id.includes("react-remove-scroll") ||
            id.includes("react-style-singleton") ||
            id.includes("use-sidecar") ||
            id.includes("use-callback-ref") ||
            id.includes("aria-hidden") ||
            id.includes("get-nonce")
          ) {
            return "vendor-radix";
          }

          // Sentry (エラー監視。本番のみ effective だが bundle には含まれる)
          if (id.includes("@sentry")) {
            return "vendor-sentry";
          }

          // Web Vitals 計測
          if (id.includes("web-vitals")) {
            return "vendor-vitals";
          }

          // UI utils (small but central)
          if (
            id.includes("/clsx/") ||
            id.includes("class-variance-authority") ||
            id.includes("tailwind-merge") ||
            id.includes("/dompurify/") ||
            id.includes("tailwindcss-animate") ||
            id.includes("tw-animate-css")
          ) {
            return "vendor-utils";
          }

          // UI extras (Radix 以外の UI コンポーネント群)
          if (
            id.includes("/cmdk/") ||
            id.includes("/sonner/") ||
            id.includes("/vaul/") ||
            id.includes("embla-carousel") ||
            id.includes("react-day-picker") ||
            id.includes("react-resizable-panels") ||
            id.includes("input-otp") ||
            id.includes("/wouter/") ||
            id.includes("next-themes")
          ) {
            return "vendor-ui-extras";
          }

          // ───────────────────────────────────────────────────
          // 2. React Core (上記マッチを潜り抜けたもの)
          // ───────────────────────────────────────────────────
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/") ||
            id.includes("react/jsx-runtime") ||
            id.includes("use-sync-external-store")
          ) {
            return "vendor-react";
          }

          // ───────────────────────────────────────────────────
          // 3. その他 (目標: < 100KB)
          // ───────────────────────────────────────────────────
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
