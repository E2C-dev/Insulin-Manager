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
  CONDITION_TYPE_MAP,
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
 *   - autoCalculated=true (client の自動計算 useEffect がそのまま提示した値を
 *     未変更で送信した場合) のときのみルール適用済みの期待値と突合する。
 *     ユーザーが手入力・プリセット明示選択・「昨日と同じ」等で意図的に
 *     ルール適用をスキップした値を送った場合は、突合対象がそもそも存在しない
 *     ため常にスキップする (Codexレビュー指摘: 誤ったdose_mismatch記録を防止)。
 *
 * Codexレビュー指摘対応 (2026-07-26):
 *   - presetId 未送信だった自動計算パスも検証できるよう client 側
 *     (use-insulin-presets.ts / Entry.tsx) を修正し、必ず解決済み presetId を
 *     送信するようにした。
 *   - ルールは entry.presetId に紐づくもの (または全プリセット共通の
 *     presetId=null のルール) のみに絞り込んで評価する。
 *   - 「当日同枠」レース判定は measurementSlot だけでなく targetDate も
 *     entry.date と一致する場合のみ inconclusive とする。
 */

interface InsulinEntryForCheck {
  id: string;
  userId: string;
  date: string; // "YYYY-MM-DD"
  timeSlot: string; // Breakfast | Lunch | Dinner | Bedtime
  units: string; // decimal string
  presetId?: string | null;
}

interface CheckOptions {
  // true: client の自動計算 useEffect の結果がそのまま送信された
  // (Entry.tsx: !insulinUnitsDirty && !selectedPresetId)。
  // false/未指定: 手入力・プリセット明示選択・「昨日と同じ」等の意図的な
  // 値のため、ルール適用済み期待値との突合対象がなく常にスキップする。
  autoCalculated: boolean;
  // Codexレビュー3巡目指摘対応: client が今回同時に POST した血糖値の
  // 実際の測定枠 (= formData.timeSlot、8種類の粒度)。
  // CURRENT_SLOT_MEASUREMENT は投与タイミング(4種)→食前枠固定のため、
  // 食後1時間枠 (BreakfastAfter1h等) を記録する場合はこの固定マップと
  // 実際に並行POSTされる枠がズレる。liveMeasurementSlot が渡された場合は
  // それを優先し、レース判定の対象枠として使う。
  liveMeasurementSlot?: string;
}

export async function checkInsulinDoseAndLog(
  req: Request,
  entry: InsulinEntryForCheck,
  options: CheckOptions
): Promise<void> {
  try {
    if (!options.autoCalculated) return;

    const slot = entry.timeSlot as InsulinTimingSlot;
    const currentTimingLabel = INSULIN_TIMING_LABELS[slot];
    if (!currentTimingLabel) return; // 未知の timeSlot は評価不能

    if (!entry.presetId) return; // プリセット未指定は基礎量不明のためスキップ
    const preset = await storage.getInsulinPreset(entry.presetId, entry.userId);
    if (!preset) return;
    const baseAmount = getPresetBaseUnits(preset, slot);
    if (baseAmount === null) return;

    const allRules = await storage.getAdjustmentRules(entry.userId);
    // このプリセット専用のルール、またはプリセット指定なし(全プリセット共通)の
    // ルールのみを対象にする。他プリセット専用ルールを誤って適用しない。
    // (rules が空でも「ルール適用なし = baseAmount のまま」を検証できるよう、
    // ここでは early return しない — Codexレビュー2巡目指摘対応)
    const rules = allRules.filter((r) => !r.presetId || r.presetId === entry.presetId);

    const todayStr = entry.date;
    const yesterdayStr = format(subDays(new Date(`${todayStr}T00:00:00`), 1), "yyyy-MM-dd");
    const glucoseEntries = await storage.getGlucoseEntries(entry.userId, yesterdayStr, todayStr);
    const glucoseLookup = buildGlucoseLookup(glucoseEntries);

    const evaluations = evaluateRules(rules, currentTimingLabel, todayStr, glucoseLookup);

    // 「当日同枠」(= client がいま入力中のフォーム値をリアルタイム評価に
    // 使っている可能性がある枠) を対象とする評価が1件でもあれば、
    // status が no_data / matched / not_matched のいずれであっても
    // inconclusive にする (Codexレビュー2巡目指摘: glucose と insulin は
    // 別APIとしてPromise.allで並行送信されるため、この安全ネットが読む
    // glucose 値が「これから上書きされる古い値」である可能性があり、
    // no_data 以外でも比較不能になりうる)。
    const liveOverrideSlot = options.liveMeasurementSlot ?? CURRENT_SLOT_MEASUREMENT[slot];
    const inconclusive = evaluations.some((ev) => {
      if (ev.evaluation.status === "unknown_condition") return false;
      // measurementSlot は評価対象ルールの conditionType から引く
      // (evaluation.measurementSlot は no_data ステータスにしか存在しないため、
      // matched/not_matched も含めて判定するには rule 側から見る必要がある)。
      const cond = CONDITION_TYPE_MAP[ev.rule.conditionType];
      return (
        cond?.measurementSlot === liveOverrideSlot &&
        ev.evaluation.targetDate === entry.date
      );
    });
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
