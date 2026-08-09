/**
 * ビルド分離の検証スクリプト
 *
 * 使い方:
 *   npm run verify:separation
 *
 * ============================================================================
 * 何を守っているか
 * ============================================================================
 * 1. App Store Review Guideline 1.4.2
 *    iOS ビルドに「血糖値から投与量を算出する」コードが 1 バイトも
 *    入っていないこと。混入したまま公開すると、アプリの公開停止だけでなく
 *    開発者アカウントの扱いにも波及しうる。
 *
 * 2. Web ビルドに Capacitor が入っていないこと
 *    ブラウザで動かない API を配信しても意味が無く、bundle が太るだけ。
 *
 * どちらも vite.config.ts の resolve.alias によるビルド時分離で担保している
 * が、alias は「消し忘れた import が 1 本あるだけ」で破れる。人間のレビュー
 * では追いきれないので、成果物そのものを毎回機械で検査する。
 *
 * ============================================================================
 * なぜ sourcemap を作ってから検査するのか (ここを間違えると誤判定する)
 * ============================================================================
 * ★ minify 後の .js を grep してはいけない。
 *   `adjustmentRuleEngine` のような内部識別子は minify で別名に潰れるため、
 *   混入していても grep は 0 件を返す。「0 件だから安全」と読むと嘘の緑になる。
 *   (実測: 混入している web ビルドでも .js の grep は 0 件だった)
 *
 * ★ .map をファイル全体で grep してもいけない。
 *   sourcesContent にソースコードのコメント文まで載るため、
 *   「1.4.2 対策で算出を除外する」と *書いてあるコメント* に反応して
 *   誤検出する。
 *
 * 正しいのは .map を JSON パースして `sources` 配列だけを見ること。
 * ここにはモジュールグラフに実際に入ったファイルのパスだけが並ぶ。
 * ============================================================================
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const WEB_ASSETS = "dist/public/assets";
const IOS_ASSETS = "dist/ios/public/assets";

/** 各ビルドに「入っていてはいけない」モジュールパスの断片。 */
const FORBIDDEN = {
  ios: [
    { probe: "adjustmentRuleEngine", why: "投与量の算出エンジン (Guideline 1.4.2)" },
    { probe: "features/dose-panel/web", why: "算出ありの dose panel 実装 (Guideline 1.4.2)" },
    { probe: "features/native/web", why: "Web 用スタブ (iOS では実装が使われるべき)" },
  ],
  web: [
    { probe: "@capacitor/", why: "Capacitor 本体・公式プラグイン" },
    { probe: "capacitor-biometric", why: "生体認証プラグイン" },
    { probe: "features/native/ios", why: "Capacitor を掴む native 実装" },
    { probe: "features/dose-panel/ios", why: "iOS 用 dose panel 実装" },
  ],
};

/** 逆に「入っていなければおかしい」もの。alias の取り違えを検出する。 */
const REQUIRED = {
  ios: [
    { probe: "features/dose-panel/ios", why: "iOS 用 dose panel 実装" },
    { probe: "features/native/ios", why: "native の iOS 実装" },
  ],
  web: [
    { probe: "features/dose-panel/web", why: "Web 用 dose panel 実装" },
    { probe: "features/native/web", why: "native の Web スタブ" },
  ],
};

function run(cmd, args, env) {
  execFileSync(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
}

/** .map の sources 配列だけを集める (sourcesContent は見ない)。 */
function collectSources(dir) {
  if (!existsSync(dir)) {
    throw new Error(`ビルド成果物が見つかりません: ${dir}`);
  }

  const maps = readdirSync(dir).filter((f) => f.endsWith(".map"));
  if (maps.length === 0) {
    throw new Error(`sourcemap がありません: ${dir}（--sourcemap 付きでビルドされていない）`);
  }

  const all = new Set();
  for (const file of maps) {
    const map = JSON.parse(readFileSync(join(dir, file), "utf8"));
    for (const src of map.sources ?? []) {
      all.add(src);
    }
  }
  return all;
}

function check(label, sources, forbidden, required) {
  const violations = [];

  for (const { probe, why } of forbidden) {
    const hits = [...sources].filter((s) => s.includes(probe));
    if (hits.length > 0) {
      violations.push({
        kind: "混入",
        probe,
        why,
        detail: hits.slice(0, 5),
      });
    }
  }

  for (const { probe, why } of required) {
    const hits = [...sources].filter((s) => s.includes(probe));
    if (hits.length === 0) {
      violations.push({ kind: "欠落", probe, why, detail: [] });
    }
  }

  console.log(`\n[${label}] 総ソース数: ${sources.size}`);
  if (violations.length === 0) {
    console.log(`  ✅ 問題なし`);
    return true;
  }

  for (const v of violations) {
    console.log(`  ❌ ${v.kind}: ${v.probe} — ${v.why}`);
    for (const d of v.detail) console.log(`       ${d}`);
  }
  return false;
}

// ---------------------------------------------------------------------------

console.log("sourcemap 付きでビルドします (検証用)…");
run("npx", ["vite", "build", "--sourcemap"], { NODE_ENV: "production" });
run("npx", ["vite", "build", "--sourcemap"], {
  NODE_ENV: "production",
  VITE_BUILD_TARGET: "ios",
});

const webOk = check("web", collectSources(WEB_ASSETS), FORBIDDEN.web, REQUIRED.web);
const iosOk = check("ios", collectSources(IOS_ASSETS), FORBIDDEN.ios, REQUIRED.ios);

// 検証用の sourcemap を配信物に残さないよう、最後に必ず作り直す。
// ★ 順序に注意: `npm run build` は dist を rm -rf するため、
//   Web を先、iOS を後に実行しないと dist/ios が消える。
console.log("\nsourcemap なしで作り直します…");
run("npx", ["vite", "build"], { NODE_ENV: "production" });
run("npx", ["vite", "build"], { NODE_ENV: "production", VITE_BUILD_TARGET: "ios" });

if (!webOk || !iosOk) {
  console.error("\n❌ ビルド分離の検証に失敗しました。上の指摘を解消するまで ship しないこと。");
  process.exit(1);
}

console.log("\n✅ ビルド分離の検証に成功しました。");
