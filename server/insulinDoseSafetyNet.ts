import type { Request } from "express";
import { format, subDays } from "date-fns";
import { storage } from "./storage";
import { createAuditLog } from "./audit";
import {
  buildGlucoseLookup,
  calculateAdjustedUnits,
  evaluateRules,
  getPresetBaseUnits,
  pickAppliedRules,
  CURRENT_SLOT_MEASUREMENT,
  INSULIN_TIMING_LABELS,
  type InsulinTimingSlot,
} from "@shared/adjustmentRuleEngine";

/**
 * server/insulinDoseSafetyNet.ts
 *
 * 作業2 (2026-07): インスリン投与量計算の defense-in-depth。
 * client (Entry.tsx) は shared/adjustmentRuleEngine.ts でルールを評価し
 * 自動計算した投与量を提示するが、client 側のバグ・改ざん・キャッシュ不整合
 * などで実際に送信される units がその計算結果とズレる可能性がある。
 *
 * このモジュールは insulin_entries の作成・更新時に、サーバー側で
 * *同じ* shared ロジックを使って独立に投与量を再計算し、送信された units と
 * 突合する。今回は「ログのみ」モード:
 *   - 乖離があっても保存は常に許可する (拒否・ブロックは一切しない)
 *   - 乖離を検知したら audit_logs に記録し、後日 CTO/開発チームが確認できる
 *     ようにする
 *   - このチェック自体の失敗 (例外) は本処理 (記録の保存・レスポンス) を
 *     絶対にブロックしない
 *
 * 既知の制約 (v1, ログのみモードなので許容):
 *   - client は「いま入力中の当日同枠 (例: 朝食前) の血糖値」を、まだ DB に
 *     保存されていなくてもリアルタイムで評価に使う (Entry.tsx 参照)。
 *     glucose と insulin は別々の POST として Promise.all で並行送信される
 *     ため、insulin 側のこのチェックが実行される時点で glucose がまだ
 *     コミットされていないことがある (レース)。
 *   - この「同枠・当日」条件が no_data (DB 未反映) の場合、client が正しい
 *     値を送っていても比較不能なため、このチェックは inconclusive として
 *     何も記録せずに終了する (false-positive の温床を避けるため)。
 *   - baseAmount (基礎投与量) はプリセットの明示設定からのみ解決する。
 *     client の localStorage フォールバック (レガシー経路) は再現しない。
 *     presetId 未指定、またはプリセットにそのタイミングの基礎量が未設定の
 *     場合は比較そのものをスキップする。
 */

interface InsulinEntryForCheck {
  id: string;
  userId: string;
  date: string; // "YYYY-MM-DD"
  timeSlot: string; // Breakfast | Lunch | Dinner | Bedtime
  units: string; // decimal string
  presetId?: string | null;
}

export async function checkInsulinDoseAndLog(
  req: Request,
  entry: InsulinEntryForCheck
): Promise<void> {
  try {
    const slot = entry.timeSlot as InsulinTimingSlot;
    const currentTimingLabel = INSULIN_TIMING_LABELS[slot];
    if (!currentTimingLabel) return; // 未知の timeSlot は評価不能

    if (!entry.presetId) return; // プリセット未指定は基礎量不明のためスキップ
    const preset = await storage.getInsulinPreset(entry.presetId, entry.userId);
    if (!preset) return;
    const baseAmount = getPresetBaseUnits(preset, slot);
    if (baseAmount === null) return;

    const rules = await storage.getAdjustmentRules(entry.userId);
    if (rules.length === 0) return; // ルールがなければ乖離しようがない

    const todayStr = entry.date;
    const yesterdayStr = format(subDays(new Date(`${todayStr}T00:00:00`), 1), "yyyy-MM-dd");
    const glucoseEntries = await storage.getGlucoseEntries(entry.userId, yesterdayStr, todayStr);
    const glucoseLookup = buildGlucoseLookup(glucoseEntries);

    const evaluations = evaluateRules(rules, currentTimingLabel, todayStr, glucoseLookup);

    // 「当日同枠」ルールが no_data の場合、client のリアルタイム入力と
    // レースしている可能性があり比較不能 (inconclusive) → 何も記録しない。
    const liveOverrideSlot = CURRENT_SLOT_MEASUREMENT[slot];
    const inconclusive = evaluations.some(
      (ev) => ev.evaluation.status === "no_data" && ev.evaluation.measurementSlot === liveOverrideSlot
    );
    if (inconclusive) return;

    const applied = pickAppliedRules(evaluations);
    const expectedUnits = calculateAdjustedUnits(baseAmount, applied);

    const submittedUnits = parseFloat(entry.units);
    if (Number.isNaN(submittedUnits)) return;

    // 浮動小数の丸め誤差を吸収 (0.05単位まで許容)
    if (Math.abs(expectedUnits - submittedUnits) <= 0.05) return;

    await createAuditLog(req, {
      adminId: entry.userId,
      action: "insulin_entry.dose_mismatch",
      targetType: "insulin_entry",
      targetId: entry.id,
      previousValue: JSON.stringify({
        expectedUnits,
        baseAmount,
        appliedRuleIds: applied.map((a) => a.rule.id),
      }),
      newValue: JSON.stringify({
        submittedUnits,
        date: entry.date,
        timeSlot: entry.timeSlot,
      }),
    });
  } catch (err) {
    // ログのみモード: 再計算・監査ログ記録の失敗で本処理を絶対に止めない
    console.error("[insulin-dose-safety-net] 再計算チェックに失敗しました (無視して継続):", err);
  }
}
