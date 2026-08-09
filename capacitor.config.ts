import type { CapacitorConfig } from "@capacitor/cli";

/**
 * capacitor.config.ts —— iOS ネイティブシェルの設定
 *
 * ============================================================================
 * webDir に dist/ios/public を指す理由
 * ============================================================================
 * `npm run build` (Web) は dist/public に出るが、そこには血糖値から投与量を
 * 算出するコードが含まれる。App Store Review Guideline 1.4.2 により、
 * iOS シェルに入れてよいのは `npm run build:ios` の成果物だけである。
 *
 * ★ `npx cap sync` の前に必ず `npm run build:ios` を実行すること。
 *   `npm run build` は dist を rm -rf してから作り直すため、Web ビルドを
 *   後に走らせると dist/ios が消える (= sync が古い成果物か空を掴む)。
 * ============================================================================
 *
 * appName を英字にしている理由:
 *   `npx cap add ios` はこの値で Xcode プロジェクト (App.xcodeproj) 周辺の
 *   ファイル名を作る。日本語を入れるとパス解決やビルドスクリプトで壊れる
 *   ことがあるため、ここは "Insulia" 固定とし、利用者に見えるアプリ名
 *   (インスリア) は Info.plist の CFBundleDisplayName で与える。
 *   手順は docs/ios-setup.md を参照。
 */
const config: CapacitorConfig = {
  // ⚠ appId は App Store 提出後に変更できない。PO 確認のうえ確定させること。
  //    insulia.jp を逆順にした形を暫定値としている。
  appId: "jp.insulia.app",
  appName: "Insulia",
  webDir: "dist/ios/public",

  ios: {
    // WebView をセーフエリアに合わせる。ノッチ端末で入力欄が隠れるのを防ぐ。
    contentInset: "always",
  },

  plugins: {
    LocalNotifications: {
      // iOS はアプリアイコンを流用するため smallIcon 等の指定は不要。
      // 通知音はシステム既定を使う (医療系のため大袈裟な音を避ける)。
    },
  },
};

export default config;
