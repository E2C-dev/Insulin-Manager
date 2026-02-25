// LD_LIBRARY_PATH を設定（Sparticuz chromium に必要なライブラリ）
const NSPR_LIB = "/nix/store/1wx9nkcxavkfc01wg4qzqyd3710yvgf0-nspr-4.34/lib";
const NSS_LIB = "/nix/store/1ag0klg91f6gnhlx0iazgysahngp4rf8-nss-3.90.2/lib";
process.env.LD_LIBRARY_PATH = `${NSPR_LIB}:${NSS_LIB}`;

// 日本語フォント（PlemolJP）を fontconfig 経由で登録
import { writeFileSync } from "fs";
import { tmpdir } from "os";
const FONT_DIR = "/nix/store/wvgaash2a62b40rw3p37fi0kby8pq980-plemoljp-2.0.4/share/fonts/truetype/plemoljp";
const fontconfigContent = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${FONT_DIR}</dir>
  <cachedir>/tmp/fc-cache</cachedir>
  <match target="pattern">
    <test qual="any" name="family"><string>sans-serif</string></test>
    <edit name="family" mode="prepend" binding="strong"><string>PlemolJP</string></edit>
  </match>
</fontconfig>`;
const fontconfigPath = `${tmpdir()}/insulia-fonts.conf`;
writeFileSync(fontconfigPath, fontconfigContent);
process.env.FONTCONFIG_FILE = fontconfigPath;

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import type { Page } from "puppeteer-core";
import { mkdirSync } from "fs";
import { join } from "path";

const BASE_URL = "http://localhost:5000";
const OUTPUT_DIR = join(process.cwd(), "client/public/images");
mkdirSync(OUTPUT_DIR, { recursive: true });

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// 日本語フォントを CSS で強制注入（文字化け防止）
async function injectFont(page: Page) {
  await page.addStyleTag({
    content: `
      @font-face {
        font-family: 'PlemolJP';
        src: local('PlemolJP'), local('PlemolJP-Regular');
        font-weight: 400;
        unicode-range: U+3000-9FFF, U+F900-FAFF, U+FF00-FFEF;
      }
      body, * {
        font-family: 'PlemolJP', 'Hiragino Kaku Gothic Pro', 'Meiryo', 'Yu Gothic', sans-serif !important;
      }
    `,
  });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 500));
}

// API リクエストをセッション付きで実行
async function apiPost(page: Page, path: string, body: Record<string, unknown>) {
  return page.evaluate(
    async (url: string, data: Record<string, unknown>) => {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const text = await r.text();
      try { return { ok: r.ok, status: r.status, data: JSON.parse(text) }; }
      catch { return { ok: r.ok, status: r.status, data: text }; }
    },
    `${BASE_URL}${path}`,
    body
  );
}

async function main() {
  const executablePath = await chromium.executablePath();
  console.log("Chrome path:", executablePath);

  console.log("ブラウザ起動中...");
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--font-render-hinting=none",
      "--disable-extensions",
      "--lang=ja-JP",
      "--force-color-profile=srgb",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

    // フォント設定
    await page.evaluateOnNewDocument(() => {
      document.fonts.ready.then(() => console.log("Fonts loaded"));
    });

    // テストユーザー作成 & ログイン
    const username = `insulia_demo_${Date.now()}`;
    const password = "Demo12345!";
    console.log(`\nユーザー登録: ${username}`);

    await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle0" });
    await sleep(2000);

    const textInputs = await page.$$('input[type="text"], input:not([type])');
    const passwordInputs = await page.$$('input[type="password"]');
    console.log(`  テキスト入力数: ${textInputs.length}, パスワード入力数: ${passwordInputs.length}`);

    if (textInputs.length > 0) {
      await textInputs[0].click({ clickCount: 3 });
      await textInputs[0].type(username);
    }
    for (const inp of passwordInputs) {
      await inp.click({ clickCount: 3 });
      await inp.type(password);
    }

    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
      await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 10000 }).catch(() => {});
    }
    await sleep(2000);
    console.log("登録後URL:", page.url());

    // ── APIでデータを投入 ──
    console.log("\nインスリンプリセット作成中...");
    const preset1 = await apiPost(page, "/api/insulin-presets", {
      name: "ノボラピッド（食前）",
      category: "超速効型",
      brand: "ノボラピッド フレックスタッチ",
      defaultBreakfastUnits: "4",
      defaultLunchUnits: "4",
      defaultDinnerUnits: "4",
      sortOrder: 0,
    });
    console.log("  プリセット1:", preset1.status, preset1.ok ? "OK" : "NG");

    const preset2 = await apiPost(page, "/api/insulin-presets", {
      name: "トレシーバ（眠前）",
      category: "持効型",
      brand: "トレシーバ フレックスタッチ",
      defaultBedtimeUnits: "12",
      sortOrder: 1,
    });
    console.log("  プリセット2:", preset2.status, preset2.ok ? "OK" : "NG");

    console.log("\n調整ルール作成中...");
    await apiPost(page, "/api/adjustment-rules", {
      name: "朝の高血糖対応",
      timeSlot: "朝",
      conditionType: "朝食前血糖値",
      threshold: 140,
      comparison: "以上",
      adjustmentAmount: 2,
      targetTimeSlot: "朝食前",
    });
    await apiPost(page, "/api/adjustment-rules", {
      name: "朝の低血糖対応",
      timeSlot: "朝",
      conditionType: "朝食前血糖値",
      threshold: 70,
      comparison: "以下",
      adjustmentAmount: -1,
      targetTimeSlot: "朝食前",
    });
    await apiPost(page, "/api/adjustment-rules", {
      name: "夕食後高血糖対応",
      timeSlot: "夕",
      conditionType: "食後1h血糖値",
      threshold: 140,
      comparison: "以上",
      adjustmentAmount: 2,
      targetTimeSlot: "翌日夕食",
    });
    console.log("  調整ルール作成完了");

    // 血糖値データを追加
    console.log("\nサンプルデータを追加中...");
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0];

    const entries = [
      { date: twoDaysAgo, timeSlot: "朝食前", glucoseLevel: 118 },
      { date: twoDaysAgo, timeSlot: "食後1h（朝）", glucoseLevel: 152 },
      { date: twoDaysAgo, timeSlot: "昼食前", glucoseLevel: 112 },
      { date: yesterday, timeSlot: "朝食前", glucoseLevel: 126 },
      { date: yesterday, timeSlot: "食後1h（朝）", glucoseLevel: 165 },
      { date: yesterday, timeSlot: "昼食前", glucoseLevel: 118 },
      { date: yesterday, timeSlot: "眠前", glucoseLevel: 142 },
      { date: today, timeSlot: "朝食前", glucoseLevel: 134 },
    ];

    for (const entry of entries) {
      await apiPost(page, "/api/glucose-entries", entry);
    }

    // インスリン記録を追加
    const presetId = preset1.ok && preset1.data?.preset?.id ? preset1.data.preset.id : null;
    if (presetId) {
      await apiPost(page, "/api/insulin-entries", {
        date: yesterday, timeSlot: "Breakfast", units: "4", presetId,
      });
      await apiPost(page, "/api/insulin-entries", {
        date: today, timeSlot: "Breakfast", units: "6", presetId,
      });
    }
    console.log("  サンプルデータ追加完了");

    // ── Settings ページ（インスリンプリセット設定） ──
    console.log("\n設定ページを撮影中...");
    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle0" });
    await sleep(3000);
    await injectFont(page);

    // インスリン設定セクションが見えるようにスクロール
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="insulin-settings"], .space-y-4');
      if (el) el.scrollIntoView();
    });
    await sleep(500);

    await page.screenshot({ path: join(OUTPUT_DIR, "step-1-preset-setup.png") });
    console.log("✓ step-1-preset-setup.png");

    // ── Entry ページ（血糖値入力） ──
    console.log("記録ページを撮影中...");
    await page.goto(`${BASE_URL}/entry`, { waitUntil: "networkidle0" });
    await sleep(3000);
    await injectFont(page);

    // ページのコンテンツを確認
    const entryContent = await page.content();
    const hasForm = entryContent.includes("血糖値") || entryContent.includes("glucoseLevel");
    console.log("  Entryページにフォームあり:", hasForm);

    // 時間帯を選択
    try {
      const combobox = await page.waitForSelector('[role="combobox"]', { timeout: 5000 });
      if (combobox) {
        await combobox.click();
        await sleep(600);
        const opts = await page.$$('[role="option"]');
        if (opts.length > 0) {
          await opts[0].click();
          await sleep(500);
        }
      }
    } catch (e) {
      console.log("  combobox not found");
    }

    // 血糖値を入力
    try {
      const numInput = await page.$('input[type="number"]');
      if (numInput) {
        await numInput.click({ clickCount: 3 });
        await numInput.type("162");
        await sleep(800);
      }
    } catch (e) {
      console.log("  number input not found");
    }

    await page.screenshot({ path: join(OUTPUT_DIR, "step-2-glucose-input.png") });
    console.log("✓ step-2-glucose-input.png");

    // プリセットセレクターが表示されるまで待つ
    await sleep(1500);
    await page.screenshot({ path: join(OUTPUT_DIR, "step-3-auto-calculate.png") });
    console.log("✓ step-3-auto-calculate.png");

    // ── Dashboard ──
    console.log("ダッシュボードを撮影中...");
    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle0" });
    await sleep(3000);
    await injectFont(page);
    await page.screenshot({ path: join(OUTPUT_DIR, "screenshot-dashboard.png") });
    console.log("✓ screenshot-dashboard.png");

    // ── Logbook ──
    console.log("ログブックを撮影中...");
    await page.goto(`${BASE_URL}/logbook`, { waitUntil: "networkidle0" });
    await sleep(3000);
    await page.screenshot({ path: join(OUTPUT_DIR, "screenshot-logbook.png") });
    console.log("✓ screenshot-logbook.png");

    // ── AdjustmentRules ──
    console.log("調整ルールページを撮影中...");
    await page.goto(`${BASE_URL}/adjustment-rules`, { waitUntil: "networkidle0" });
    await sleep(3000);
    await page.screenshot({ path: join(OUTPUT_DIR, "screenshot-adjustment-rules.png") });
    console.log("✓ screenshot-adjustment-rules.png");

    console.log("\n全スクリーンショット完了！");
    console.log("出力先:", OUTPUT_DIR);
  } finally {
    await browser.close();
  }
}

main().catch((e: Error) => {
  console.error("エラー:", e.message);
  process.exit(1);
});
