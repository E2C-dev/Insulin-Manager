import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { safeFormat } from './date-utils';

interface DailyEntry {
  date: string;
  morning: {
    glucoseBefore?: number;
    glucoseAfter?: number;
    insulin?: number;
  };
  lunch: {
    glucoseBefore?: number;
    glucoseAfter?: number;
    insulin?: number;
  };
  dinner: {
    glucoseBefore?: number;
    glucoseAfter?: number;
    insulin?: number;
  };
  bedtime: {
    glucose?: number;
    insulin?: number;
  };
}

/**
 * 日本語フォント (Noto Sans JP) を CDN から動的に取得し jsPDF に登録する。
 *
 * 設計判断 (S5-1 Sprint 5):
 * - jsPDF 標準の helvetica は CJK を持たないため、日本語が文字化け or 描画失敗する。
 * - フォントを bundle に同梱すると vendor-pdf chunk が肥大化 (Noto Sans JP TTF ≒ 1.4MB)。
 *   → PDF 生成時のみ fetch する dynamic load 方式を採用。
 * - CDN: jsdelivr 経由で notofonts/noto-cjk リポジトリの Variable subset TTF を取得。
 *   2026-05-04 時点で 200 OK 確認済み (HEAD: content-type: font/ttf)。
 * - 取得失敗 (CDN 障害 / オフライン / CORS) でも PDF 生成自体を落とさず、
 *   英数字フォールバック (helvetica) で出力する。
 *
 * @returns true: 日本語フォント登録成功 / false: 失敗 (英数字フォールバック)
 */
async function loadJapaneseFont(doc: jsPDF): Promise<boolean> {
  // CDN URL 候補 (上から順に試す)。1つ目で失敗したら次へ。
  const fontUrls = [
    'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk/Sans/Variable/TTF/Subset/NotoSansJP-VF.ttf',
    'https://cdn.jsdelivr.net/gh/minoryorg/Noto-Sans-CJK-JP/fonts/NotoSansCJKjp-Regular.ttf',
  ];

  for (const fontUrl of fontUrls) {
    try {
      const res = await fetch(fontUrl);
      if (!res.ok) {
        console.warn(`[pdf] font fetch ${fontUrl} returned ${res.status}, trying next`);
        continue;
      }
      const buf = await res.arrayBuffer();
      // ArrayBuffer → base64 (chunk 単位で String.fromCharCode を呼ぶ。
      // 1.4MB の TTF を一気に展開すると call stack overflow を起こすため)
      const bytes = new Uint8Array(buf);
      const CHUNK = 0x8000;
      let binary = '';
      for (let i = 0; i < bytes.length; i += CHUNK) {
        const slice = bytes.subarray(i, i + CHUNK);
        binary += String.fromCharCode.apply(null, Array.from(slice));
      }
      const base64 = btoa(binary);
      doc.addFileToVFS('NotoSansJP-Regular.ttf', base64);
      doc.addFont('NotoSansJP-Regular.ttf', 'NotoSansJP', 'normal');
      doc.setFont('NotoSansJP');
      return true;
    } catch (err) {
      console.warn(`[pdf] Japanese font load failed for ${fontUrl}:`, err);
      // 次の URL へフォールスルー
    }
  }
  console.warn('[pdf] all Japanese font sources failed, fallback to ASCII');
  return false;
}

export async function exportLogbookToPDF(entries: DailyEntry[], username: string = "ユーザー") {
  // S5-1 Sprint 5: A4 横向き化 (297mm × 210mm)
  // 旧: new jsPDF() = A4 縦 (210 × 297)
  // 列が多い (日付 + 4区分) ため横向きの方が読みやすい
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // 日本語フォントを動的取得 (失敗時は英数字フォールバック)
  const jpFontLoaded = await loadJapaneseFont(doc);

  // ラベル定義: 日本語フォント load 成功時は日本語、失敗時は英数字
  const L = jpFontLoaded
    ? {
        title: 'インスリン記録',
        user: '氏名',
        exportDate: '出力日',
        legend: '血糖値: mg/dL ｜ インスリン: u',
        low: '<70: 低',
        normal: '70-180: 正常',
        high: '>180: 高',
        headers: ['日付', '朝食', '昼食', '夕食', '眠前'],
        page: (i: number, n: number) => `${i} / ${n} ページ`,
      }
    : {
        title: 'Insulin Record Book',
        user: 'User',
        exportDate: 'Export Date',
        legend: 'Glucose Unit: mg/dL | Insulin Unit: u',
        low: '<70: Low',
        normal: '70-180: Normal',
        high: '>180: High',
        headers: ['Date', 'Breakfast', 'Lunch', 'Dinner', 'Bedtime'],
        page: (i: number, n: number) => `Page ${i} of ${n}`,
      };

  // A4 横の中央 X 座標 = 297 / 2 = 148.5
  const pageWidth = doc.internal.pageSize.getWidth(); // 297
  const pageHeight = doc.internal.pageSize.getHeight(); // 210
  const centerX = pageWidth / 2;

  // タイトル
  doc.setFontSize(20);
  doc.text(L.title, centerX, 15, { align: 'center' });

  // ユーザー名と出力日時
  doc.setFontSize(10);
  doc.text(`${L.user}: ${username}`, 14, 25);
  doc.text(`${L.exportDate}: ${format(new Date(), 'yyyy/MM/dd HH:mm')}`, 14, 30);

  // 凡例
  doc.setFontSize(9);
  doc.text(L.legend, 14, 38);
  doc.setTextColor(255, 0, 0);
  doc.text(L.low, 14, 43);
  doc.setTextColor(0, 128, 0);
  doc.text(L.normal, 50, 43);
  doc.setTextColor(255, 140, 0);
  doc.text(L.high, 100, 43);
  doc.setTextColor(0, 0, 0);

  // テーブルデータの準備
  const tableData = entries.map(entry => {
    // entry.date が "" や不正値だと Invalid Date → format 例外。
    // 一覧PDFが落ちると即「真っ白で出力できない」になるので safeFormat で防御。
    const dateStr = safeFormat(entry.date, 'M/d (E)', entry.date);

    // 朝食
    const morning = entry.morning.glucoseBefore || entry.morning.glucoseAfter || entry.morning.insulin
      ? `${entry.morning.glucoseBefore || '-'}/${entry.morning.glucoseAfter || '-'}\n${entry.morning.insulin ? entry.morning.insulin + 'u' : '-'}`
      : '-';

    // 昼食
    const lunch = entry.lunch.glucoseBefore || entry.lunch.glucoseAfter || entry.lunch.insulin
      ? `${entry.lunch.glucoseBefore || '-'}/${entry.lunch.glucoseAfter || '-'}\n${entry.lunch.insulin ? entry.lunch.insulin + 'u' : '-'}`
      : '-';

    // 夕食
    const dinner = entry.dinner.glucoseBefore || entry.dinner.glucoseAfter || entry.dinner.insulin
      ? `${entry.dinner.glucoseBefore || '-'}/${entry.dinner.glucoseAfter || '-'}\n${entry.dinner.insulin ? entry.dinner.insulin + 'u' : '-'}`
      : '-';

    // 眠前
    const bedtime = entry.bedtime.glucose || entry.bedtime.insulin
      ? `${entry.bedtime.glucose || '-'}\n${entry.bedtime.insulin ? entry.bedtime.insulin + 'u' : '-'}`
      : '-';

    return [dateStr, morning, lunch, dinner, bedtime];
  });

  // テーブルの作成
  // 横向き A4 (297mm) なので利用可能幅 = 297 - 14*2 = 269mm
  // 列幅: 日付 35 + 朝 58 + 昼 58 + 夕 58 + 眠前 60 = 269mm
  autoTable(doc, {
    startY: 48,
    head: [L.headers],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 3,
      halign: 'center',
      valign: 'middle',
      // 日本語フォント load 成功時は NotoSansJP、失敗時は helvetica (jsPDF default)
      font: jpFontLoaded ? 'NotoSansJP' : 'helvetica',
    },
    headStyles: {
      fillColor: [66, 139, 202],
      textColor: [255, 255, 255],
      fontStyle: jpFontLoaded ? 'normal' : 'bold', // NotoSansJP は normal weight のみ登録
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 35 }, // 日付
      1: { cellWidth: 58 }, // 朝食
      2: { cellWidth: 58 }, // 昼食
      3: { cellWidth: 58 }, // 夕食
      4: { cellWidth: 60 }, // 眠前
    },
    didParseCell: function(data) {
      // セルの内容に基づいて色を変更
      if (data.section === 'body' && data.column.index > 0) {
        const cellText = data.cell.text.join('');
        const numbers = cellText.match(/\d+/g);

        if (numbers && numbers.length > 0) {
          const glucose = parseInt(numbers[0]);
          if (glucose < 70) {
            data.cell.styles.textColor = [255, 0, 0]; // 赤
          } else if (glucose > 180) {
            data.cell.styles.textColor = [255, 140, 0]; // オレンジ
          } else {
            data.cell.styles.textColor = [0, 128, 0]; // 緑
          }
        }
      }
    },
    margin: { top: 48, left: 14, right: 14 },
  });

  // ページ番号
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      L.page(i, pageCount),
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // PDFを保存
  const filename = `insulin-record_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
  doc.save(filename);
}
