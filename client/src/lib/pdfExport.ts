import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

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

export async function exportLogbookToPDF(entries: DailyEntry[], username: string = "ユーザー") {
  // 日本語フォントの問題を回避するため、英数字のみで構成
  const doc = new jsPDF();
  
  // タイトル
  doc.setFontSize(20);
  doc.text('Insulin Record Book', 105, 15, { align: 'center' });
  
  // ユーザー名と出力日時
  doc.setFontSize(10);
  doc.text(`User: ${username}`, 14, 25);
  doc.text(`Export Date: ${format(new Date(), 'yyyy/MM/dd HH:mm')}`, 14, 30);
  
  // 凡例
  doc.setFontSize(9);
  doc.text('Glucose Unit: mg/dL | Insulin Unit: u', 14, 38);
  doc.setTextColor(255, 0, 0);
  doc.text('<70: Low', 14, 43);
  doc.setTextColor(0, 128, 0);
  doc.text('70-180: Normal', 40, 43);
  doc.setTextColor(255, 140, 0);
  doc.text('>180: High', 75, 43);
  doc.setTextColor(0, 0, 0);
  
  // テーブルデータの準備
  const tableData = entries.map(entry => {
    const dateStr = format(new Date(entry.date), 'M/d (E)', { locale: ja });
    
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
  autoTable(doc, {
    startY: 48,
    head: [['Date', 'Breakfast', 'Lunch', 'Dinner', 'Bedtime']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 3,
      halign: 'center',
      valign: 'middle',
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [66, 139, 202],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 30 }, // 日付
      1: { cellWidth: 35 }, // 朝食
      2: { cellWidth: 35 }, // 昼食
      3: { cellWidth: 35 }, // 夕食
      4: { cellWidth: 35 }, // 眠前
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
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  // PDFを保存
  const filename = `insulin-record_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
  doc.save(filename);
}
