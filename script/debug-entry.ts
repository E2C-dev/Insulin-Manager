const NSPR_LIB = "/nix/store/1wx9nkcxavkfc01wg4qzqyd3710yvgf0-nspr-4.34/lib";
const NSS_LIB = "/nix/store/1ag0klg91f6gnhlx0iazgysahngp4rf8-nss-3.90.2/lib";
process.env.LD_LIBRARY_PATH = `${NSPR_LIB}:${NSS_LIB}`;

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

const BASE_URL = "http://localhost:5000";

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const executablePath = await chromium.executablePath();
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

    // Capture console messages
    page.on('console', msg => console.log('BROWSER:', msg.type(), msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

    // Register and login
    await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle0" });
    await sleep(2000);
    const inputs = await page.$$('input[type="text"], input:not([type])');
    const pInputs = await page.$$('input[type="password"]');
    if (inputs.length > 0) { await inputs[0].type(`debug_${Date.now()}`); }
    for (const p of pInputs) { await p.type("Demo12345x"); }
    const btn = await page.$('button[type="submit"]');
    if (btn) { await btn.click(); await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 8000 }).catch(() => {}); }
    console.log("After registration URL:", page.url());
    await sleep(2000);

    // Navigate to entry
    console.log("\nNavigating to /entry...");
    await page.goto(`${BASE_URL}/entry`, { waitUntil: "networkidle0" });
    
    console.log("\nWaiting 3 seconds...");
    await sleep(3000);
    
    console.log("Current URL:", page.url());
    
    // Check page content
    const html = await page.content();
    const hasEntry = html.includes("記録入力") || html.includes("記録編集") || html.includes("glucoseLevel");
    const hasSpinner = html.includes("読み込み中");
    const hasLogin = html.includes("ログイン") && page.url().includes("login");
    console.log("Has entry form:", hasEntry);
    console.log("Has spinner:", hasSpinner);
    console.log("Redirected to login:", hasLogin);
    
    // Save debug screenshot
    await page.screenshot({ path: "/tmp/debug-entry.png", fullPage: true });
    console.log("\nDebug screenshot saved to /tmp/debug-entry.png");
    
    // Check auth status
    const authStatus = await page.evaluate(async () => {
      const r = await fetch("/api/auth/me", { credentials: "include" });
      const text = await r.text();
      return { status: r.status, body: text.slice(0, 100) };
    });
    console.log("Auth status:", authStatus);
    
  } finally {
    await browser.close();
  }
}

main().catch((e: Error) => {
  console.error("Error:", e.message);
  process.exit(1);
});
