import { adminStorage } from "./admin-storage";
import type { Request } from "express";

export async function createAuditLog(
  req: Request,
  data: {
    adminId: string;
    action: string;
    targetType: string;
    targetId?: string;
    previousValue?: string;
    newValue?: string;
  }
) {
  try {
    const ipAddress =
      (req.headers["x-forwarded-for"] as string) ||
      req.socket?.remoteAddress ||
      undefined;
    const userAgent = req.headers["user-agent"] || undefined;

    await adminStorage.createAuditLog({
      ...data,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    // 監査ログの失敗は本処理をブロックしない
    console.error("監査ログ記録エラー:", error);
  }
}
