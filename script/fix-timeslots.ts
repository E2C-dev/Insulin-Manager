import { db } from "../server/db";
import { adjustmentRules } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * 時間帯の表記を修正するスクリプト
 * "夜間" → "眠前"
 * "夜" → "夕"
 */

async function fixTimeSlots() {
  console.log("\n========================================");
  console.log("🔧 時間帯の修正開始");
  console.log("========================================\n");
  
  try {
    // "夜間" を "眠前" に修正
    const nightResults = await db
      .update(adjustmentRules)
      .set({ timeSlot: "眠前", updatedAt: new Date() })
      .where(eq(adjustmentRules.timeSlot, "夜間"))
      .returning();
    
    console.log(`✅ "夜間" → "眠前": ${nightResults.length}件`);
    
    // "夜" を "夕" に修正
    const eveningResults = await db
      .update(adjustmentRules)
      .set({ timeSlot: "夕", updatedAt: new Date() })
      .where(eq(adjustmentRules.timeSlot, "夜"))
      .returning();
    
    console.log(`✅ "夜" → "夕": ${eveningResults.length}件`);
    
    console.log("\n========================================");
    console.log("✅ 修正完了");
    console.log("========================================\n");
    
  } catch (error) {
    console.error("❌ エラー:", error);
    process.exit(1);
  }
}

fixTimeSlots().then(() => process.exit(0));
