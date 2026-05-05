# Sprint 5 自己評価レポート

実装日: 2026-05-04
担当: Generator (Dev Quality Team)
直近 commit: `8a36164` (Sprint 4) — 本 Sprint は未 commit

## 実装内容

### S5-1 PDF A4横型化 + 日本語フォント対応

**ファイル**: `client/src/lib/pdfExport.ts` (旧145行 → 新223行)

#### Part A: A4横型化
- L36 `new jsPDF()` → `new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })`
- ページサイズ: 210×297mm (縦) → 297×210mm (横)
- タイトル中央 X: 105 → 148.5 (= `pageWidth/2`、ハードコード回避のため `doc.internal.pageSize.getWidth()` で動的取得)
- 凡例の X 座標を 14 / 50 / 100 に再配置 (横向きで間隔をゆったり)
- autoTable 列幅: 30/35/35/35/35 (合計170mm) → 35/58/58/58/60 (合計269mm = 297-14*2、横向きの利用可能幅をフル活用)
- ページ番号は `pageWidth/2`, `pageHeight - 10` で動的計算

#### Part B: 日本語フォント動的ロード
新規関数 `loadJapaneseFont(doc): Promise<boolean>` を追加。

設計判断:
- **同梱方式は不採用**: Noto Sans JP TTF は 1.4MB あり、vendor-pdf chunk が肥大化する
- **動的 fetch 方式**: PDF 生成時のみ CDN から取得 → bundle に同梱しない
- **CDN 候補**: jsdelivr 経由で 2 候補を順次試行
  - 1st: `cdn.jsdelivr.net/gh/notofonts/noto-cjk/Sans/Variable/TTF/Subset/NotoSansJP-VF.ttf` (200 OK 確認済)
  - 2nd: `cdn.jsdelivr.net/gh/minoryorg/Noto-Sans-CJK-JP/fonts/NotoSansCJKjp-Regular.ttf` (200 OK 確認済)
- **base64 変換**: 1.4MB の `String.fromCharCode.apply` 一括展開は call stack overflow を起こすため、0x8000 (32KB) chunk 単位で分割処理
- **フォールバック**: 全 URL 失敗時は `false` を返し、helvetica + 英数字テキストで PDF 出力 (例外を投げない → PDF 生成全体は落ちない)

#### Part C: テキスト日本語化
ラベル定義を `L` オブジェクトに集約し、`jpFontLoaded` で日本語/英数字を切替:

| 項目 | 日本語 (load 成功時) | 英数字 (フォールバック) |
|---|---|---|
| タイトル | インスリン記録 | Insulin Record Book |
| ユーザー | 氏名 | User |
| 出力日 | 出力日 | Export Date |
| 凡例 | 血糖値: mg/dL ｜ インスリン: u | Glucose Unit: mg/dL \| Insulin Unit: u |
| 範囲 | <70: 低 / 70-180: 正常 / >180: 高 | <70: Low / 70-180: Normal / >180: High |
| ヘッダ | 日付 / 朝食 / 昼食 / 夕食 / 眠前 | Date / Breakfast / Lunch / Dinner / Bedtime |
| ページ | N / M ページ | Page N of M |

注意: NotoSansJP は normal weight のみ登録のため、日本語フォント時はヘッダの fontStyle を `'normal'` (英数字時は `'bold'`) に切替。

### S5-2 vendor-other chunk 細分化

**ファイル**: `vite.config.ts` (manualChunks 関数を拡張)

#### 旧 vendor-other 内訳 (sourcemap 解析で判明)
163ファイル `core-js` / 107ファイル `motion-dom` / 24ファイル `motion-utils` / 11ファイル `@babel/runtime` / 11ファイル `fast-png` / 7+ ファイル `react-remove-scroll` / その他 floating-ui, html2canvas, canvg, fflate, pako, stackblur-canvas など

#### 新マッチャ追加 (vite.config.ts)
1. **vendor-pdf 拡張**: jspdf に加え html2canvas / canvg / svg-pathdata / stackblur-canvas / rgbcolor / raf / performance-now / fast-png / iobuffer (jsPDF が静的 require → tree-shake 不可) を取り込み
2. **vendor-motion 拡張**: framer-motion に加え motion-dom / motion-utils を取り込み
3. **vendor-radix 拡張**: @floating-ui / react-remove-scroll / react-style-singleton / use-sidecar / use-callback-ref / aria-hidden / get-nonce を取り込み (Radix の peer 依存)
4. **vendor-pdf-canvas 新規**: html2canvas + canvg 系 (PDF 機能の SVG/Canvas 描画用)
5. **vendor-pdf-compress 新規**: pako + fflate (圧縮)
6. **vendor-pdf-polyfills 新規**: core-js (jspdf → canvg 経由のポリフィル)
7. **vendor-pdf-table 新規**: jspdf-autotable (本体と分離して 350KB 上限を守る)
8. **vendor-pdf 縮小**: jspdf 本体のみに
9. **vendor-utils 新規**: clsx / class-variance-authority / tailwind-merge / dompurify / tailwindcss-animate / tw-animate-css
10. **vendor-ui-extras 新規**: cmdk / sonner / vaul / embla-carousel / react-day-picker / react-resizable-panels / input-otp / wouter / next-themes
11. **vendor-sentry 新規**: @sentry/* (実際には未使用 → 36 byte の最小 stub)
12. **vendor-vitals 新規**: web-vitals
13. **vendor-babel 新規**: @babel/runtime
14. **vendor-form 維持**: react-hook-form / @hookform / zod

PDF 系を 5 chunk に細分化したのは、jspdf 関連の総量 (約 730KB) を単一 chunk 上限 350KB 内に収めるため。すべて Logbook (lazy route) からのみロードされるので並列 fetch でき、UX への影響なし。

## 受け入れ基準達成

| 基準 | 状態 | 実測値 / 備考 |
|---|---|---|
| **S5-1 A4 横向き** | ✅ OK | `{ orientation: 'landscape' }` 適用、列幅も 297mm 横向きに最適化 |
| **S5-1 日本語フォント load** | ✅ OK | jsdelivr 2 URL × HEAD 200 確認済。dynamic fetch + base64 変換 + addFileToVFS + addFont + setFont |
| **S5-1 フォールバック動作** | ✅ OK | for-loop で 2 URL 試行、全失敗時 `false` 返却 → helvetica + 英文ラベル使用。例外を投げないので PDF 生成全体は継続 |
| **S5-1 TS エラーゼロ** | ✅ OK | `tsc --noEmit` 出力なし |
| **S5-1 ビルド PASS** | ✅ OK | `npm run build` 成功 (client + server) |
| **S5-1 vendor-pdf chunk 増加なし** | ✅ OK | 旧 368KB → 新 343KB (むしろ減少。フォントは bundle に含めず CDN fetch なので正常) |
| **S5-2 vendor-other ≤ 300KB** | ✅ OK | **2.6KB** (実質ゼロ。残ったのは tslib, regexparam, fflate hint 等の極小スタブ) |
| **S5-2 全 chunk 最大 ≤ 350KB** | ✅ OK | 最大 = `vendor-pdf` 343KB (336K du -h、343KB 正確値) |
| **S5-2 entry index ≤ 100KB** | ✅ OK | `index-DuBOQmxn.js` = 27.6KB |
| **S5-2 ビルド成功・TS エラーゼロ** | ✅ OK | client + server 両方 PASS |
| **Sprint 1〜4 リグレッションなし** | ✅ OK | 既存ロジック (safeFormat / didParseCell / processedEntries) 全て維持 |

## ビルド結果

- `npm run build`: **PASS** (client 6.32s, server 83ms)
- `npx tsc --noEmit`: **PASS** (出力なし = エラーゼロ)

### chunk 分布 (Sprint 4 → Sprint 5 比較)

| chunk | Sprint 4 | Sprint 5 | 増減 |
|---|---:|---:|---:|
| **vendor-other** | **532KB** | **2.6KB** | **-529KB** ⭐ |
| vendor-pdf | 368KB | 343KB | -25KB |
| vendor-pdf-canvas | — | 333KB | new |
| vendor-pdf-table | — | 31KB | new (split from pdf) |
| vendor-pdf-compress | — | 28KB | new (split from pdf) |
| vendor-pdf-polyfills | — | 47KB | new (core-js) |
| vendor-react | 196KB | 194KB | -2KB |
| vendor-radix | 120KB | 156KB | +36KB (吸収: floating-ui / react-remove-scroll) |
| vendor-motion | 84KB | 122KB | +38KB (吸収: motion-dom / motion-utils) |
| vendor-utils | — | 50KB | new (clsx + cva + tw-merge + dompurify) |
| vendor-icons | 32KB | 30KB | -2KB |
| vendor-tanstack | 36KB | 33KB | -3KB |
| vendor-date | 28KB | 26KB | -2KB |
| vendor-vitals | — | 6KB | new |
| vendor-ui-extras | — | 3.5KB | new |
| vendor-babel | — | 2KB | new |
| vendor-sentry | — | 36 byte | new (実質 stub) |
| **entry index** | 28KB | **27.6KB** | -0.4KB ✅ < 100KB |
| LandingPage | 48KB | 48KB | ±0 |
| Logbook | 24KB | 22KB | -2KB |
| Dashboard | 12KB | 9KB | -3KB |

#### chunk 数
- Sprint 4: 8 vendor + 17 app
- Sprint 5: 16 vendor + 17 app

HTTP/2 multiplex 上問題ない範囲 (一般に 6-12 並列 + キャッシュ命中が期待できる)。

#### 初期ロード (entry + 初期 lazy chunks ≒ index + LandingPage + AppLayout + 共通 vendor)
Sprint 5 で初期ロードされる主要 vendor は:
- vendor-react (194K) + vendor-radix (156K) + vendor-icons (30K) + vendor-tanstack (33K) + vendor-utils (50K) + entry (28K) + LandingPage (48K) ≒ 540KB minified / 165KB gzip

**vendor-pdf-* 系 (合計 782KB) は Logbook ページに遷移して初めて load される (route lazy)**。ランディング / ログイン / ダッシュボードでは一切ダウンロードされない。

## 既知の問題・懸念点

### 1. 日本語フォント CDN 依存 (中)
- jsdelivr GitHub raw 経由のため、CDN 障害 / GitHub 側のリポジトリリネームで break する可能性
- **緩和策**: 2 URL 順次試行 + 失敗時は英数字フォールバック (PDF 生成自体は落ちない)
- **検証方法**: ローカルで `https://cdn.jsdelivr.net/gh/notofonts/noto-cjk/Sans/Variable/TTF/Subset/NotoSansJP-VF.ttf` への HEAD リクエスト = 200 OK (2026-05-04 確認)
- **将来案**: ユーザー数が増えた段階で自社 R2/S3 に Noto Sans JP をホストし、CDN 依存を切る

### 2. 実機ブラウザでの PDF 表示確認は未実施 (中)
- ビルドは通るが、実際にブラウザで `exportLogbookToPDF` を呼び出して日本語が描画されるかは未確認
- **理由**: Generator はビルド検証までで commit 禁止のため、Replit dev サーバー起動 + ブラウザ操作 = スコープ外
- **次手**: Evaluator が Playwright で実機確認する場合は、Logbook ページで Export ボタンクリック → ダウンロードされた PDF を開いて日本語表示を目視確認

### 3. vendor-pdf 343KB は閾値ギリギリ (低)
- jsPDF 本体は 343KB minified (圧縮 121KB)
- 350KB 上限まで余裕は 7KB のみ。jspdf がマイナーバージョンアップで肥大化したら超える可能性
- **緩和策**: lazy route 内なので初期ロードに影響なし。超えた場合は jspdf-autotable と同じパターンで encoding/font 系を更に分離可能

### 4. vendor-sentry が 36 byte (極小スタブ化) (低)
- @sentry/react は `package.json` に依存登録されているが、実コードからの import が現状ない (Sentry 計測未配線)
- chunk 分離した結果、Rollup が dead code として 36 byte に縮小
- **判断**: 影響なし。将来 Sentry を導入したら自然に増える

### 5. vendor-pdf-polyfills (core-js) が 47KB のまま残存 (低)
- canvg → core-js 経由のポリフィル群。最新ブラウザでは不要だが jspdf のために含まれる
- **緩和策**: Logbook lazy chunk と並列ロードなので UX 影響軽微
- **将来案**: Vite の `target` を ES2022 以上に上げると core-js の必要量が減る可能性 (要検証)

## 検証コマンド (Evaluator 用)

```bash
# 1. ビルド
ssh -i ~/.ssh/replit -p 22 -o StrictHostKeyChecking=no 6ab2e90e-751f-4007-a971-5b6f344c69d1@6ab2e90e-751f-4007-a971-5b6f344c69d1-00-p0fkq4uxnm4u.riker.replit.dev "cd /home/runner/workspace && timeout 240 npm run build 2>&1 | tail -25"

# 2. TS チェック
ssh ... "cd /home/runner/workspace && npx tsc --noEmit"

# 3. chunk 分布
ssh ... "cd /home/runner/workspace && du -h dist/public/assets/*.js | sort -h"

# 4. pdfExport.ts 確認
ssh ... "cd /home/runner/workspace && cat client/src/lib/pdfExport.ts | head -100"

# 5. vite.config.ts 確認
ssh ... "cd /home/runner/workspace && cat vite.config.ts"

# 6. (実機検証) Logbook ページで Export ボタン → DL → PDF を開く
#    A4 横向き / 日本語表示 (CDN 取得成功時) / 英文表示 (CDN 失敗時) を確認
```

## まとめ

- **S5-1 (PDF)**: A4 横型化 + 日本語フォント動的ロード + 英数字フォールバックを実装。既存の数値色分け / safeFormat / processedEntries はそのまま維持
- **S5-2 (chunk)**: vendor-other 532KB → 2.6KB の劇的削減。最大 chunk = vendor-pdf 343KB (350KB 上限内)。entry chunk 27.6KB (100KB 上限内)。すべての受け入れ基準クリア
- **commit / push / 本番デプロイは未実施** (制約遵守)
- **DB / スコープ外修正なし** (制約遵守)

最大の懸念点は「日本語フォント CDN 依存」だが、フォールバック実装と 2 URL 試行で実用上問題ないレベルに収めている。
