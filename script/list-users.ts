import { db } from "../server/db";
import { users } from "@shared/schema";

async function listUsers() {
  console.log("\n========================================");
  console.log("👥 登録ユーザー一覧");
  console.log("========================================\n");
  
  try {
    const allUsers = await db.select().from(users);
    
    if (allUsers.length === 0) {
      console.log("ユーザーが登録されていません\n");
      return;
    }
    
    console.log(`登録ユーザー数: ${allUsers.length}件\n`);
    
    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username}`);
      console.log(`   ID: ${user.id}`);
      console.log("");
    });
    
    console.log("========================================\n");
  } catch (error) {
    console.error("❌ エラー:", error);
    process.exit(1);
  }
}

listUsers().then(() => process.exit(0));
