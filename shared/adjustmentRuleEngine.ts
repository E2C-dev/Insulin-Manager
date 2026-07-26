import { format, subDays } from "date-fns";

/**
 * shared/adjustmentRuleEngine.ts
 *
 * 背景: B-001 (S0 medical safety bug) の修正で client/src/pages/Entry.tsx に
 * 実装された「conditionType を考慮したインスリン調整ルール評価ロジック」を、
 * client / server の双方から利用できる形に切り出したもの。
 *
 * 旧実装 (修正前) は rule.conditionType を無視し、いま入力中の血糖値を
 * 全てのルールに当てはめていた。例:
 *   ルール「前日眠前血糖 70以下 → 朝 -1u」が、
 *   当日朝食前60mg/dL を入力した瞬間に誤発動して 4u→3u に。
 *
 * このモジュールは「どの日のどの測定値で評価するか」を conditionType から
 * 正規化し (dateOffset / measurementSlot)、該当値が存在しない場合は
 * "no_data" として絶対に自動加算しない、という医療安全上の中核ロジックを
 * 1箇所に集約する。
 *
 * server 側 (2026-07 作業2) では、クライアントが送信したインスリン投与量を
 * defense-in-depth で再計算・突合するためにこのモジュールを再利用する。
 * ブラウザ専用 API (window / localStorage 等) には一切依存しない、
 * 純粋な TypeScript ロジックのみで構成する。
 */

// ===== 測定タイミング =====
// client/src/lib/types.ts の MeasurementTimeSlot と同一定義。
// (このモジュールが正典。client 側は re-export する)
export type MeasurementTimeSlot =
  | "BreakfastBefore" // 朝食前
  | "BreakfastAfter1h" // 朝食後1h
  | "LunchBefore" // 昼食前
  | "LunchAfter1h" // 昼食後1h
  | "DinnerBefore" // 夕食前
  | "DinnerAfter1h" // 夕食後1h
  | "BeforeSleep" // 睡眠時（眠前後）
  | "Night"; // 夜間

// 投与タイミング（インスリン注射のタイミング）
export type InsulinTimingSlot = "Breakfast" | "Lunch" | "Dinner" | "Bedtime";

// 投与タイミングの日本語ラベル（server 側は client/src/lib/types.ts の
// INSULIN_TIME_SLOT_LABELS に依存できないため、ここに正典を持つ）
export const INSULIN_TIMING_LABELS: Record<InsulinTimingSlot, string> = {
  Breakfast: "朝",
  Lunch: "昼",
  Dinner: "夕",
  Bedtime: "眠前",
};

// 各インスリン投与タイミングに対応する「同枠」の測定タイミング。
// Entry.tsx のリアルタイム自動計算は、いま入力中のフォーム血糖値をこの
// 組合せに限って優先評価する (B-001 fix)。server 側の再計算チェックが
// この組合せで "no_data" と判定した場合は、client がまだ DB に保存されて
// いないフォーム入力値を見ている可能性があり、単純比較は不能 (inconclusive)。
export const CURRENT_SLOT_MEASUREMENT: Record<InsulinTimingSlot, MeasurementTimeSlot> = {
  Breakfast: "BreakfastBefore",
  Lunch: "LunchBefore",
  Dinner: "DinnerBefore",
  Bedtime: "BeforeSleep",
};

// ===== 調整ルールの conditionType を正規化する MAP =====
export type ConditionDateOffset = -1 | 0; // 前日 | 当日

export interface ConditionTypeDef {
  dateOffset: ConditionDateOffset;
  measurementSlot: MeasurementTimeSlot;
}

export const CONDITION_TYPE_MAP: Record<string, ConditionTypeDef> = {
  // 前日 (dateOffset: -1)
  "前日朝食前血糖": { dateOffset: -1, measurementSlot: "BreakfastBefore" },
  "前日朝食後血糖": { dateOffset: -1, measurementSlot: "BreakfastAfter1h" },
  "前日昼食前血糖": { dateOffset: -1, measurementSlot: "LunchBefore" },
  "前日昼食後血糖": { dateOffset: -1, measurementSlot: "LunchAfter1h" },
  "前日夕食前血糖": { dateOffset: -1, measurementSlot: "DinnerBefore" },
  "前日夕食後血糖": { dateOffset: -1, measurementSlot: "DinnerAfter1h" },
  "前日眠前血糖": { dateOffset: -1, measurementSlot: "BeforeSleep" },
  // 当日 (dateOffset: 0)
  "当日朝食前血糖": { dateOffset: 0, measurementSlot: "BreakfastBefore" },
  "当日朝食後血糖": { dateOffset: 0, measurementSlot: "BreakfastAfter1h" },
  "当日昼食前血糖": { dateOffset: 0, measurementSlot: "LunchBefore" },
  "当日昼食後血糖": { dateOffset: 0, measurementSlot: "LunchAfter1h" },
  "当日夕食前血糖": { dateOffset: 0, measurementSlot: "DinnerBefore" },
  "当日夕食後血糖": { dateOffset: 0, measurementSlot: "DinnerAfter1h" },
  "当日眠前血糖": { dateOffset: 0, measurementSlot: "BeforeSleep" },
};

export type RuleEvaluation =
  | { status: "matched"; observedValue: number; targetDate: string }
  | { status: "not_matched"; observedValue: number; targetDate: string }
  | { status: "no_data"; targetDate: string; measurementSlot: MeasurementTimeSlot }
  | { status: "unknown_condition" };

// rule.comparison (日本語) で実数比較
export function compareGlucose(value: number, threshold: number, comparison: string): boolean {
  switch (comparison) {
    case "以下":
      return value <= threshold;
    case "未満":
      return value < threshold;
    case "以上":
      return value >= threshold;
    case "超える":
      return value > threshold;
    default:
      return false;
  }
}

/**
 * 評価に必要な最小限のルール shape。
 * client の AdjustmentRule (client/src/lib/types.ts) / server の AdjustmentRule
 * (shared/schema.ts の $inferSelect) はいずれもこれのスーパーセットなので
 * そのまま渡せる。
 */
export interface AdjustmentRuleLike {
  id: string;
  timeSlot: string; // "朝" | "昼" | "夕" | "眠前"
  conditionType: string;
  threshold: number;
  comparison: string;
  adjustmentAmount: number;
  targetTimeSlot: string;
}

export interface EvaluatedRule<TRule extends AdjustmentRuleLike = AdjustmentRuleLike> {
  rule: TRule;
  evaluation: RuleEvaluation;
}

// 血糖値ルックアップに使う最小限の測定値 shape。
// client の ApiGlucoseEntry / server の GlucoseEntry (shared/schema.ts) は
// いずれもこれのスーパーセット。
export interface GlucoseLookupPoint {
  date: string;
  timeSlot: string;
  glucoseLevel: number;
}

export type GlucoseLookup = (date: string, slot: MeasurementTimeSlot) => number | undefined;

/**
 * glucose エントリ配列から (date, timeSlot) 完全一致の値を返す単純ルックアップを
 * 生成する。client / server 双方のデフォルト実装として使える。
 * (client 側は「いま入力中のフォーム血糖値」を優先させるため、これをラップした
 * カスタム lookup 関数を作って evaluateRules に渡すこともできる)
 */
export function buildGlucoseLookup(
  entries: GlucoseLookupPoint[] | undefined | null
): GlucoseLookup {
  const list = entries ?? [];
  return (date, slot) => list.find((e) => e.date === date && e.timeSlot === slot)?.glucoseLevel;
}

/**
 * "YYYY-MM-DD" 文字列を Date に変換する。不正値は現在時刻にフォールバックする
 * (client/src/lib/date-utils.ts の safeParseDate と同じ fail-safe 方針。
 * shared モジュールはブラウザ専用 API に依存させないため、ここに小さく複製する)。
 */
function parseBaseDate(dateStr: string | null | undefined): Date {
  if (!dateStr) return new Date();
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/**
 * 単一ルールを条件評価する。
 *
 * @param rule 評価対象ルール
 * @param baseDateStr 評価基準日 ("YYYY-MM-DD"。通常は記録対象日)
 * @param glucoseLookup (date, measurementSlot) => 血糖値 | undefined
 */
export function evaluateRule<TRule extends AdjustmentRuleLike>(
  rule: TRule,
  baseDateStr: string,
  glucoseLookup: GlucoseLookup
): RuleEvaluation {
  const cond = CONDITION_TYPE_MAP[rule.conditionType];
  if (!cond) {
    return { status: "unknown_condition" };
  }

  const baseDate = parseBaseDate(baseDateStr);
  const targetDate = format(cond.dateOffset === -1 ? subDays(baseDate, 1) : baseDate, "yyyy-MM-dd");

  const measurement = glucoseLookup(targetDate, cond.measurementSlot);
  if (measurement === undefined) {
    return { status: "no_data", targetDate, measurementSlot: cond.measurementSlot };
  }

  const matched = compareGlucose(measurement, rule.threshold, rule.comparison);
  return matched
    ? { status: "matched", observedValue: measurement, targetDate }
    : { status: "not_matched", observedValue: measurement, targetDate };
}

/**
 * 指定した「当日の時間帯 (朝/昼/夕/眠前)」に適用候補となるルールを抽出する。
 * B-001 fix: targetTimeSlot が "当日の{currentTimingLabel}" と完全一致するものだけを
 * 対象にする。「前日の朝」「当日の昼」などの他枠ルールが誤適用される経路を断つ。
 * targetTimeSlot 未指定 (旧データ) は安全側で除外する。
 */
export function filterCandidateRules<TRule extends AdjustmentRuleLike>(
  rules: TRule[],
  currentTimingLabel: string
): TRule[] {
  const expectedTarget = `当日の${currentTimingLabel}`;
  return rules.filter(
    (rule) =>
      rule.timeSlot === currentTimingLabel &&
      !!rule.targetTimeSlot &&
      rule.targetTimeSlot === expectedTarget
  );
}

/**
 * 候補ルール群 (filterCandidateRules 済み) をまとめて評価する。
 */
export function evaluateRules<TRule extends AdjustmentRuleLike>(
  rules: TRule[],
  currentTimingLabel: string,
  baseDateStr: string,
  glucoseLookup: GlucoseLookup
): EvaluatedRule<TRule>[] {
  const candidates = filterCandidateRules(rules, currentTimingLabel);
  return candidates.map((rule) => ({
    rule,
    evaluation: evaluateRule(rule, baseDateStr, glucoseLookup),
  }));
}

/**
 * B-004: 累積適用の制御。
 * 同一 conditionType × targetTimeSlot の組合せで複数ルールが matched した場合は、
 * threshold が最も「厳しい側」の1件だけを採用する
 * (低血糖系=「以下/未満」なら threshold 最小、高血糖系=「以上/超える」なら threshold 最大)。
 * 異なる比較演算子が混ざる場合は adjustmentAmount の絶対値が大きい方を採用する。
 */
export function pickAppliedRules<TRule extends AdjustmentRuleLike>(
  evaluations: EvaluatedRule<TRule>[]
): EvaluatedRule<TRule>[] {
  const matched = evaluations.filter((r) => r.evaluation.status === "matched");

  const groups = new Map<string, EvaluatedRule<TRule>[]>();
  for (const ev of matched) {
    const key = ev.rule.conditionType + "|" + (ev.rule.targetTimeSlot ?? "");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(ev);
  }

  const picked: EvaluatedRule<TRule>[] = [];
  for (const list of Array.from(groups.values())) {
    if (list.length === 1) {
      picked.push(list[0]);
      continue;
    }
    const sorted = [...list].sort((a, b) => {
      const aLow = a.rule.comparison === "以下" || a.rule.comparison === "未満";
      const bLow = b.rule.comparison === "以下" || b.rule.comparison === "未満";
      if (aLow && bLow) return a.rule.threshold - b.rule.threshold; // 小さい方が厳しい
      if (!aLow && !bLow) return b.rule.threshold - a.rule.threshold; // 大きい方が厳しい
      return Math.abs(b.rule.adjustmentAmount) - Math.abs(a.rule.adjustmentAmount);
    });
    picked.push(sorted[0]);
  }
  return picked;
}

/**
 * 基礎投与量 + 適用ルールの調整量を合算し、min〜max (デフォルト 0〜100 単位、
 * insertInsulinEntrySchema の上限と一致) でクランプする。
 */
export function calculateAdjustedUnits<TRule extends AdjustmentRuleLike>(
  baseAmount: number,
  appliedRules: EvaluatedRule<TRule>[],
  opts: { min?: number; max?: number } = {}
): number {
  const min = opts.min ?? 0;
  const max = opts.max ?? 100;
  let total = baseAmount;
  for (const ev of appliedRules) {
    total += ev.rule.adjustmentAmount;
  }
  return Math.max(min, Math.min(max, total));
}

// ===== インスリンプリセットの基礎投与量解決 (server 側の再計算チェック用) =====
// client/src/lib/types.ts の getPresetDefaultUnits と同一ロジック。
// server はブラウザ専用の localStorage フォールバックを再現できないため、
// この関数は「プリセットに明示設定された基礎量」のみを解決する。
export interface PresetUnitsLike {
  defaultBreakfastUnits: string | null;
  defaultLunchUnits: string | null;
  defaultDinnerUnits: string | null;
  defaultBedtimeUnits: string | null;
}

export function getPresetBaseUnits(preset: PresetUnitsLike, slot: InsulinTimingSlot): number | null {
  const map: Record<InsulinTimingSlot, string | null> = {
    Breakfast: preset.defaultBreakfastUnits,
    Lunch: preset.defaultLunchUnits,
    Dinner: preset.defaultDinnerUnits,
    Bedtime: preset.defaultBedtimeUnits,
  };
  const val = map[slot];
  if (val === null || val === undefined) return null;
  const num = parseFloat(val);
  return Number.isNaN(num) ? null : num;
}
