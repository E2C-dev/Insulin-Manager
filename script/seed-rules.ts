import { storage } from "../server/storage";

/**
 * デフォルトの調整ルールを登録するスクリプト
 * 
 * スプレッドシートのルールを基に作成:
 * 1. 眠前インスリンの調整ルール（夜間・朝の血糖値ベース）
 * 2. 朝・昼・夕のインスリン調整ルール（食後1h血糖値ベース）
 */

interface RuleTemplate {
  name: string;
  timeSlot: string;
  conditionType: string;
  threshold: number;
  comparison: "以下" | "以上" | "未満" | "超える";
  adjustmentAmount: number;
  targetTimeSlot: string;
  description: string;
}

const defaultRules: RuleTemplate[] = [
  // === 眠前インスリンの調整ルール ===
  {
    name: "夜間低血糖対応（優先度：高）",
    timeSlot: "眠前",
    conditionType: "夜間血糖値",
    threshold: 70,
    comparison: "以下",
    adjustmentAmount: -2,
    targetTimeSlot: "眠前",
    description: "夜間の血糖値が70mg/dL以下の場合、眠前インスリンを2単位減らす",
  },
  {
    name: "朝の低血糖対応",
    timeSlot: "朝",
    conditionType: "朝食前血糖値",
    threshold: 70,
    comparison: "以下",
    adjustmentAmount: -1,
    targetTimeSlot: "眠前",
    description: "朝の血糖値が70mg/dL以下の場合、眠前インスリンを1単位減らす",
  },
  {
    name: "朝の高血糖対応",
    timeSlot: "朝",
    conditionType: "朝食前血糖値",
    threshold: 100,
    comparison: "以上",
    adjustmentAmount: 2,
    targetTimeSlot: "眠前",
    description: "朝の血糖値が100mg/dL以上の場合、眠前インスリンを2単位増やす",
  },
  
  // === 朝食後の調整ルール ===
  {
    name: "朝食後高血糖対応",
    timeSlot: "朝",
    conditionType: "食後1h血糖値",
    threshold: 140,
    comparison: "以上",
    adjustmentAmount: 2,
    targetTimeSlot: "翌日朝食",
    description: "朝食後1時間の血糖値が140mg/dL以上の場合、翌日の朝食インスリンを2単位増やす",
  },
  {
    name: "朝食後低血糖対応",
    timeSlot: "朝",
    conditionType: "食後1h血糖値",
    threshold: 80,
    comparison: "以下",
    adjustmentAmount: -1,
    targetTimeSlot: "翌日朝食",
    description: "朝食後1時間の血糖値が80mg/dL以下の場合、翌日の朝食インスリンを1単位減らす",
  },
  
  // === 昼食後の調整ルール ===
  {
    name: "昼食後高血糖対応",
    timeSlot: "昼",
    conditionType: "食後1h血糖値",
    threshold: 140,
    comparison: "以上",
    adjustmentAmount: 2,
    targetTimeSlot: "翌日昼食",
    description: "昼食後1時間の血糖値が140mg/dL以上の場合、翌日の昼食インスリンを2単位増やす",
  },
  {
    name: "昼食後低血糖対応",
    timeSlot: "昼",
    conditionType: "食後1h血糖値",
    threshold: 80,
    comparison: "以下",
    adjustmentAmount: -1,
    targetTimeSlot: "翌日昼食",
    description: "昼食後1時間の血糖値が80mg/dL以下の場合、翌日の昼食インスリンを1単位減らす",
  },
  
  // === 夕食後の調整ルール ===
  {
    name: "夕食後高血糖対応",
    timeSlot: "夕",
    conditionType: "食後1h血糖値",
    threshold: 140,
    comparison: "以上",
    adjustmentAmount: 2,
    targetTimeSlot: "翌日夕食",
    description: "夕食後1時間の血糖値が140mg/dL以上の場合、翌日の夕食インスリンを2単位増やす",
  },
  {
    name: "夕食後低血糖対応",
    timeSlot: "夕",
    conditionType: "食後1h血糖値",
    threshold: 80,
    comparison: "以下",
    adjustmentAmount: -1,
    targetTimeSlot: "翌日夕食",
    description: "夕食後1時間の血糖値が80mg/dL以下の場合、翌日の夕食インスリンを1単位減らす",
  },
];

// よりわかりやすいサマリー出力用
export function getRulesSummary() {
  const byTimeSlot: Record<string, RuleTemplate[]> = {
    "朝": [],
    "昼": [],
    "夕": [],
    "眠前": [],
  };
  
  defaultRules.forEach(rule => {
    if (byTimeSlot[rule.timeSlot]) {
      byTimeSlot[rule.timeSlot].push(rule);
    }
  });
  
  return byTimeSlot;
}

export async function seedAdjustmentRules(userId: string) {
  console.log("\n========================================");
  console.log("📋 デフォルト調整ルールの登録開始");
  console.log("========================================\n");
  
  console.log(`対象ユーザーID: ${userId}`);
  console.log(`登録するルール数: ${defaultRules.length}件\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const rule of defaultRules) {
    try {
      console.log(`➡️  登録中: ${rule.name}`);
      console.log(`   時間帯: ${rule.timeSlot}`);
      console.log(`   条件: ${rule.conditionType} ${rule.threshold}mg/dL${rule.comparison}`);
      console.log(`   調整: ${rule.targetTimeSlot} ${rule.adjustmentAmount > 0 ? '+' : ''}${rule.adjustmentAmount}単位`);
      
      await storage.createAdjustmentRule({
        userId,
        name: rule.name,
        timeSlot: rule.timeSlot,
        conditionType: rule.conditionType,
        threshold: rule.threshold,
        comparison: rule.comparison,
        adjustmentAmount: rule.adjustmentAmount,
        targetTimeSlot: rule.targetTimeSlot,
      });
      
      console.log(`   ✅ 登録成功\n`);
      successCount++;
    } catch (error) {
      console.error(`   ❌ 登録失敗:`, error);
      errorCount++;
    }
  }
  
  console.log("========================================");
  console.log("📊 登録結果");
  console.log("========================================");
  console.log(`✅ 成功: ${successCount}件`);
  console.log(`❌ 失敗: ${errorCount}件`);
  console.log("========================================\n");
  
  return { successCount, errorCount };
}

// コマンドラインから実行された場合
if (import.meta.url === `file://${process.argv[1]}`) {
  const userId = process.argv[2];
  
  if (!userId) {
    console.error("❌ エラー: ユーザーIDを指定してください");
    console.error("使用方法: tsx script/seed-rules.ts <ユーザーID>");
    process.exit(1);
  }
  
  seedAdjustmentRules(userId)
    .then(() => {
      console.log("✅ 処理が完了しました");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ エラーが発生しました:", error);
      process.exit(1);
    });
}
