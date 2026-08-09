# iOS ネイティブシェル（Capacitor）のセットアップ手順

**作成日**: 2026-08-09

このリポジトリには Capacitor の**設定と JS/TS 実装まで**が入っている。
`ios/` ディレクトリ（Xcode プロジェクト）は**まだ生成されていない**。
生成には Xcode と CocoaPods が要るため、それらが入った Mac で以下を実行する。

---

## 0. 前提の確認

| 必要なもの | 確認コマンド | 備考 |
|---|---|---|
| Xcode（本体） | `xcodebuild -version` | App Store から。Command Line Tools だけでは足りない |
| CocoaPods | `pod --version` | `brew install cocoapods` |
| Node 20 以上 | `node -v` | Capacitor 8 の要件 |
| Apple Developer Program | — | TestFlight・審査提出に必須（残タスク） |

`xcodebuild -version` が
`tool 'xcodebuild' requires Xcode, but active developer directory is '/Library/Developer/CommandLineTools'`
を返す場合は Xcode 未導入。導入後に
`sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` を実行する。

---

## 1. 先に決めること（PO 確認事項）

`capacitor.config.ts` の `appId` は暫定で `jp.insulia.app` にしてある。

> ⚠️ **appId は App Store に提出したあと変更できない。**
> 別アプリ扱いになり、レビュー履歴も引き継げない。
> `npx cap add ios` を走らせる前に PO の確認を取ること。

---

## 2. iOS プロジェクトを生成する

```bash
# 1) 先に iOS 用の Web 成果物を作る（これが webDir になる）
npm run build:ios

# 2) iOS プロジェクトを生成する
npx cap add ios
```

> ⚠️ `npm run build`（Web ビルド）は `dist` を `rm -rf` してから作り直す。
> Web ビルドを後に走らせると `dist/ios` が消え、`cap sync` が空を掴む。
> **iOS 成果物が要るときは `build:ios` を最後に実行する。**

---

## 3. Info.plist に追記する

`ios/App/App/Info.plist` を Xcode で開き、以下を追加する。
どちらも**入れ忘れると実機で機能が黙って死ぬ**（Face ID は即クラッシュする）。

| キー | 値 | 理由 |
|---|---|---|
| `NSFaceIDUsageDescription` | `記録を保護するため、アプリのロック解除にFace IDを使用します。` | Face ID を使うアプリで必須。**未設定だと呼び出した瞬間にクラッシュする** |
| `CFBundleDisplayName` | `インスリア` | ホーム画面に出るアプリ名。`appName` は Xcode プロジェクト名に使うため英字（Insulia）にしてある |

ローカル通知（`@capacitor/local-notifications`）は Info.plist への追記は不要。
権限は初回に `requestPermissions()` を呼んだ時点で OS ダイアログが出る
（アプリ内では設定画面の「通知を許可する」ボタンが該当）。

---

## 4. 以後の更新フロー

Web 側のコードを変えたら、毎回これを実行して iOS シェルに反映する。

```bash
npm run cap:sync     # = npm run build:ios && npx cap sync ios
npx cap open ios     # Xcode が開く
```

---

## 5. ship 前に必ず通すもの

```bash
npm run check              # web 解決での型検査
npm run check:ios          # ios 解決での型検査（← 忘れやすい）
npm run verify:separation  # ビルド分離の検証（下記）
```

### `verify:separation` が守っているもの

App Store Review Guideline **1.4.2**（投与量計算機の禁止）に対して、
iOS ビルドに算出コードが 1 バイトも入っていないことを、成果物そのもので確認する。

このチェックを手作業の grep で代替しないこと。理由は 2 つある。

- **minify 後の `.js` を grep しても無意味。** `adjustmentRuleEngine` のような
  内部識別子は minify で別名に潰れるため、混入していても grep は 0 件を返す。
  「0 件だから安全」と読むと嘘の緑になる（実測済み）。
- **`.map` をファイル全体で grep すると誤検出する。** `sourcesContent` に
  ソースのコメント文まで載るため、「1.4.2 対策で算出を除外する」と*書いてある
  コメント*に反応してしまう。

正しいのは `.map` を JSON パースして `sources` 配列だけを見ること。
スクリプトはそれを行い、違反があれば exit 1 で落ちる。

---

## 6. まだ終わっていないこと（残タスク）

- [ ] `appId` の PO 確認 → `npx cap add ios`
- [ ] Apple Developer Program 登録（TestFlight・審査提出に必須）
- [ ] 実機での動作確認
      - リマインダー：許可 → 時刻設定 → 実際に通知が出るか
      - アプリロック：ON → バックグラウンド → 復帰でロック画面が出るか
      - **Face ID ダイアログ表示中に再ロックのループが起きないこと**
        （`use-app-lock.ts` の `isAuthenticating` で塞いでいるが、実機で要確認）
- [ ] App Store Connect の設定・審査メモ

---

## 参考: ネイティブ機能の実装場所

| 対象 | ファイル |
|---|---|
| 型の契約（両ビルド共通） | `client/src/features/native/contract.ts` |
| Web 用スタブ（機能なし） | `client/src/features/native/web.ts` |
| iOS 実装（Capacitor） | `client/src/features/native/ios.ts` |
| ビルド時の差し替え | `vite.config.ts` の `resolve.alias["@native"]` |
| リマインダーの状態管理 | `client/src/hooks/use-reminders.ts` |
| リマインダーの UI | `client/src/components/settings/ReminderSettings.tsx` |
| アプリロックの状態管理 | `client/src/hooks/use-app-lock.ts` |
| ロック画面と Context | `client/src/components/AppLockGate.tsx` |
| アプリロックの UI | `client/src/components/settings/AppLockSettings.tsx` |
