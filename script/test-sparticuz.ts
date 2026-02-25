// @ts-ignore
import chromium from "@sparticuz/chromium";
// @ts-ignore
import puppeteer from "puppeteer-core";

(async () => {
  console.log("Getting chromium executable path...");
  const executablePath = await chromium.executablePath();
  console.log("Path:", executablePath);
  
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: "new" as unknown as boolean,
  });
  console.log("Browser launched!");
  await browser.close();
  console.log("Done!");
})().catch((e: Error) => { console.error("Error:", e.message); process.exit(1); });
