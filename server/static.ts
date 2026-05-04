import express, { type Express, type Request } from "express";
import fs from "fs";
import path from "path";

// Static file extensions that should NOT fall through to SPA index.html.
// If a request looks like a static asset and the file is missing, return 404
// rather than serving HTML (which causes the "MIME type text/html for script"
// error observed in the whiteout audit).
const STATIC_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".css",
  ".map",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".json",
  ".webmanifest",
  ".txt",
  ".xml",
  ".pdf",
  ".mp4",
  ".webm",
  ".mp3",
  ".wav",
]);

// Path prefixes that always represent static asset locations.
const STATIC_PREFIXES = [
  "/assets/",
  "/favicon",
  "/robots.txt",
  "/manifest",
  "/sw.",
  "/apple-touch-icon",
  "/images/",
];

function isStaticAssetRequest(req: Request): boolean {
  const reqPath = req.path || "";
  for (const prefix of STATIC_PREFIXES) {
    if (reqPath.startsWith(prefix)) return true;
  }
  const ext = path.extname(reqPath).toLowerCase();
  if (ext && STATIC_EXTENSIONS.has(ext)) return true;
  return false;
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // SPA fallback: only serve index.html for non-static-asset requests.
  // Static asset 404s must remain 404 to avoid HTML-served-as-JS bugs.
  app.use("*", (req, res) => {
    if (isStaticAssetRequest(req)) {
      res
        .status(404)
        .type("text/plain")
        .send(`Static asset not found: ${req.path}`);
      return;
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
