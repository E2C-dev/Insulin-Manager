import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { Activity, ArrowDownToLine, Stethoscope, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { safeParseDate } from "@/lib/date-utils";
import { QUERY_KEYS } from "@/lib/query-keys";
import {
  type AdjustmentRule,
  TIME_SLOT_OPTIONS,
  INSULIN_TIME_SLOT_LABELS,
} from "@/lib/types";
import {
  type EvaluatedRule,
  type MeasurementTimeSlot,
  buildGlucoseLookup,
  evaluateRules,
  pickAppliedRules,
  calculateAdjustedUnits,
} from "@shared/adjustmentRuleEngine";
import type { UseDoseGuidance } from "./contract";

/**
 * client/src/features/dose-panel/web.tsx  —— Web 版 (算出あり)
 *
 * pages/Entry.tsx から機械的に切り出したもの。挙動・data-testid・
 * ルール評価ロジック (appliedRules / resolvedPresetIdForTiming /
 * B-001 の condition-aware 判定 / サーバ安全ネットへ渡す autoCalculated の
 * 条件) は切り出し前と完全に同一である。
 *
 * ★ このファイルは iOS ビルドのモジュールグラフに入らない
 *   (vite.config.ts の `@dose-panel` alias が ./ios.tsx を指すため)。
 *   shared/adjustmentRuleEngine.ts をクライアント側で import しているのは
 *   このファイルだけなので、iOS バンドルには算出コードが一切含まれない。
 */
export const useDoseGuidance: UseDoseGuidance = (input) => {
  const {
    date,
    timeSlot,
    glucoseLevel,
    insulinUnits,
    timingLabel,
    timingBaseAmount,
    resolvedPresetIdForTiming,
    selectedPresetId,
    presetsLoading,
    presetsError,
    isEditPrefillLoading,
    isSaving,
    referenceApplied,
    applyUnits,
  } = input;

  // 調整ルールを取得
  const {
    data: rulesData,
    isLoading: rulesLoading,
    isError: rulesError,
  } = useQuery({
    queryKey: QUERY_KEYS.ADJUSTMENT_RULES,
    queryFn: async () => {
      const response = await fetch("/api/adjustment-rules", { credentials: "include" });
      if (!response.ok) throw new Error("ルールの取得に失敗しました");
      return response.json();
    },
  });

  // B-001 (S0) のため、 ルール評価には「前日」測定値も必要。 編集モードでなくても
  // 当日 + 前日の glucose を常に取得して評価対象にする。 useQuery キャッシュで重複fetch回避。
  const yesterdayDateForRules = useMemo(() => {
    const baseDate = safeParseDate(date, new Date());
    return format(subDays(baseDate, 1), "yyyy-MM-dd");
  }, [date]);

  const {
    data: yesterdayGlucoseData,
    isLoading: yesterdayGlucoseLoading,
    isError: yesterdayGlucoseError,
  } = useQuery({
    queryKey: QUERY_KEYS.GLUCOSE_ENTRIES_BY_DATE(yesterdayDateForRules),
    queryFn: async () => {
      const response = await fetch(
        `/api/glucose-entries?startDate=${encodeURIComponent(yesterdayDateForRules)}&endDate=${encodeURIComponent(yesterdayDateForRules)}`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("血糖値記録の取得に失敗しました");
      const data = await response.json();
      return data.entries as Array<{ date: string; timeSlot: string; glucoseLevel: number }>;
    },
    enabled: !!yesterdayDateForRules,
  });

  // 評価対象の当日 glucose (編集モードでなくても rule評価のために取る)。
  // 編集モードでは Entry.tsx 側の prefill query と同じ key になり cache 共有される。
  const {
    data: todayGlucoseData,
    isLoading: todayGlucoseLoading,
    isError: todayGlucoseError,
  } = useQuery({
    queryKey: QUERY_KEYS.GLUCOSE_ENTRIES_BY_DATE(date),
    queryFn: async () => {
      const response = await fetch(
        `/api/glucose-entries?startDate=${encodeURIComponent(date)}&endDate=${encodeURIComponent(date)}`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("血糖値記録の取得に失敗しました");
      const data = await response.json();
      return data.entries as Array<{ date: string; timeSlot: string; glucoseLevel: number }>;
    },
    enabled: !!date,
  });

  // ============================================================================
  // B-001 (S0): conditionType を考慮したルール評価
  // ============================================================================
  // 旧実装は rule.conditionType を無視し、 いま入力中の血糖値を全ルールに当てて
  // いた。 修正後は CONDITION_TYPE_MAP で dateOffset/measurementSlot を解決し、
  // 該当日の該当測定値が DB にある時だけ評価する。 ない場合は「データ不足」を
  // 明示し、 自動加算しない。
  //
  // また B-004 (累積制御) として、 同一 targetTimeSlot(=time_slot) × conditionType
  // の組合せで複数ルールが matched した場合は、 threshold が最も「厳しい側」の
  // 1件だけを採用する (低血糖系=「以下/未満」なら threshold 最小、 高血糖系=
  // 「以上/超える」なら threshold 最大)。 全く同一閾値の重複は最後の1件のみ採用。
  //
  // 2026-07 作業2: 上記ロジック本体 (CONDITION_TYPE_MAP・評価・累積制御) は
  // server 側の defense-in-depth 再計算とも共有するため
  // shared/adjustmentRuleEngine.ts に抽出済み。ここでは client 固有の関心事
  // (「いま入力中のフォーム血糖値」をリアルタイム評価に優先させる glucoseLookup)
  // だけを組み立てて共有ロジックへ渡す。
  // ============================================================================

  const ruleEvaluations = useMemo<EvaluatedRule<AdjustmentRule>[]>(() => {
    if (!date || !timeSlot) return [];
    if (!rulesData?.rules) return [];

    // Codexレビュー2巡目指摘対応: 参考値の計算で使うプリセット (resolvedPresetId) に
    // 紐づくルール (+ 全プリセット共通の presetId 未設定ルール) のみを対象にする。
    // server/insulinDoseSafetyNet.ts の defense-in-depth チェックも同じ絞り込みを
    // 行うため、ここで揃えないと「client は全ルール適用・server は絞り込み」で
    // 期待値がズレて誤った dose_mismatch 監査ログを生む。
    const rules: AdjustmentRule[] = rulesData.rules.filter(
      (r: AdjustmentRule) => !r.presetId || r.presetId === resolvedPresetIdForTiming
    );
    const selectedOption = TIME_SLOT_OPTIONS.find((opt) => opt.value === timeSlot);
    if (!selectedOption) return [];

    const currentTiming = INSULIN_TIME_SLOT_LABELS[selectedOption.insulinSlot];

    // Codex round 2 review fix: 当日同枠ルールは「いま入力中のフォーム血糖値」を
    // リアルタイム評価対象にする。 これがないと「当日朝食前≤70→朝-1u」 ルールが、
    // 朝食前血糖60mg/dLを初回入力するときに no_data 扱いされ、 減量提案されない
    // regression を引き起こす (Codex final review 指摘)。
    const formGlucoseRaw = glucoseLevel?.trim?.() ?? "";
    const formGlucoseNum = formGlucoseRaw === "" ? null : parseInt(formGlucoseRaw, 10);
    const formGlucoseValid = formGlucoseNum !== null && !isNaN(formGlucoseNum);

    // DB から取得済みの当日・前日 glucose をまとめたフォールバック lookup。
    const dbLookup = buildGlucoseLookup([
      ...(todayGlucoseData ?? []),
      ...(yesterdayGlucoseData ?? []),
    ]);

    const glucoseLookup = (lookupDate: string, slot: MeasurementTimeSlot) => {
      // 当日同枠 (= いま入力しようとしている glucose) は、フォーム入力値を
      // 優先的に評価対象にする。 これで DB 保存前のリアルタイム補正提案が可能。
      if (lookupDate === date && slot === timeSlot && formGlucoseValid) {
        return formGlucoseNum!;
      }
      return dbLookup(lookupDate, slot);
    };

    return evaluateRules(rules, currentTiming, date, glucoseLookup);
  }, [
    date,
    timeSlot,
    glucoseLevel,
    rulesData,
    yesterdayGlucoseData,
    todayGlucoseData,
    resolvedPresetIdForTiming,
  ]);

  // B-004: 累積適用の制御 (shared/adjustmentRuleEngine.ts の pickAppliedRules に集約)
  const appliedRules = useMemo<EvaluatedRule<AdjustmentRule>[]>(
    () => pickAppliedRules(ruleEvaluations),
    [ruleEvaluations]
  );

  // Codex round 2/3 fix: rules/glucose/preset loading 中、 および query error
  // 発生中は参考値を出さない + 保存させない。 silent fallback で
  // 不正確な値が出る経路を完全に断つ。
  // - query error 時に isLoading=false で fallthrough して「データ不足」 として
  //   保存できる経路は medical safety critical なので block
  // - preset cold load 中は基礎量 0/localStorage fallback で誤った値が出る
  const hasEvaluationError =
    rulesError || todayGlucoseError || yesterdayGlucoseError || presetsError;
  const isRuleEvaluationLoading =
    rulesLoading ||
    todayGlucoseLoading ||
    yesterdayGlucoseLoading ||
    presetsLoading ||
    hasEvaluationError;

  // ==========================================================================
  // D-003 (薬機法対策パッケージ): 自動入力の廃止
  // ==========================================================================
  // 旧実装は血糖値を入力した瞬間に useEffect が insulinUnits へ計算結果を
  // 自動セットしていた。これは「アプリが投与量を決めている」= 医療機器プログラム
  // 該当性グレー (厚労省 判断事例⑫) の核心だったため廃止する。
  //
  // 新実装は「主治医指示ルールを転記したものの適用結果」を **参考値として表示
  // するだけ** に留め、入力欄へ入るのはユーザーが「この値を入力欄に反映」を
  // タップしたときだけ。ルール評価ロジック (appliedRules /
  // resolvedPresetIdForTiming 等) はそのまま温存する。
  //
  // not_matched / no_data / unknown_condition は決して加算しない
  // (B-001 / 医療安全の中核)。上限ガード (0〜100単位、zod validation
  // insertInsulinEntrySchema と整合) は shared/adjustmentRuleEngine.ts の
  // calculateAdjustedUnits に集約済み。上限近辺は B-005 桁ミス警告で別途確認する。
  // ==========================================================================

  // 参考値を算出できる状態か (評価中・エラー中・prefill 中は出さない)
  const isReferenceReady =
    !!timeSlot && timingBaseAmount !== null && !isRuleEvaluationLoading && !isEditPrefillLoading;

  // ルール適用前の単純合計 (クランプ前)。内訳表示で「丸めた」ことを明示するため。
  const referenceRawTotal = useMemo<number | null>(() => {
    if (!isReferenceReady || timingBaseAmount === null) return null;
    return appliedRules.reduce((sum, ev) => sum + ev.rule.adjustmentAmount, timingBaseAmount);
  }, [isReferenceReady, timingBaseAmount, appliedRules]);

  // 実際に提示する参考値 (0〜100単位にクランプ済み)
  const referenceUnits = useMemo<number | null>(() => {
    if (!isReferenceReady || timingBaseAmount === null) return null;
    return calculateAdjustedUnits(timingBaseAmount, appliedRules);
  }, [isReferenceReady, timingBaseAmount, appliedRules]);

  // 参考値の計算に使ったルールのうち、主治医指示の確認 (doctorConfirmed) が
  // 未入力のものがあるか。既存ユーザーの動作を壊さないため適用対象からは
  // 除外せず、注記を出すだけに留める (D-003 の方針)。
  const hasUnconfirmedAppliedRule = useMemo(
    () => appliedRules.some(({ rule }) => rule.doctorConfirmed !== true),
    [appliedRules]
  );

  // 「参考値を反映したまま手を加えていない」状態か。
  // server/insulinDoseSafetyNet.ts の再計算チェック (autoCalculated) は
  // この状態のときだけ意味を持つ。
  const isReferenceValueIntact =
    referenceApplied && referenceUnits !== null && insulinUnits === String(referenceUnits);

  // 参考値を入力欄へ反映する (ユーザーの明示的なタップでのみ呼ばれる)
  const applyReferenceValue = () => {
    if (referenceUnits === null) return;
    applyUnits(String(referenceUnits), true);
  };

  // ==========================================================================
  // 描画
  // ==========================================================================

  // 適用される調整ルール (B-001 fix: 条件評価結果を明示表示)
  const timingRulesPanel = (
    <>
      {ruleEvaluations.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">
            この時間帯の主治医指示ルール（{ruleEvaluations.length}件）
          </p>
          <div className="space-y-2 max-h-[260px] overflow-y-auto">
            {ruleEvaluations.map(({ rule, evaluation }) => {
              const isApplied = appliedRules.some((r) => r.rule.id === rule.id);
              const statusBadge = (() => {
                if (evaluation.status === "matched" && isApplied) {
                  return (
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 font-semibold">
                      ✓ 適用
                    </span>
                  );
                }
                if (evaluation.status === "matched" && !isApplied) {
                  return (
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      条件一致(重複のため不採用)
                    </span>
                  );
                }
                if (evaluation.status === "not_matched") {
                  return (
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      対象外
                    </span>
                  );
                }
                if (evaluation.status === "no_data") {
                  return (
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                      データ不足
                    </span>
                  );
                }
                return <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-800">条件不明</span>;
              })();

              const observed =
                evaluation.status === "matched" || evaluation.status === "not_matched"
                  ? `(計測 ${evaluation.observedValue}mg/dL)`
                  : evaluation.status === "no_data"
                    ? "(計測値なし)"
                    : "";

              return (
                <div
                  key={rule.id}
                  className={
                    "p-3 rounded-lg border text-sm " +
                    (isApplied
                      ? "bg-orange-50 dark:bg-orange-950/40 border-orange-300 dark:border-orange-700"
                      : "bg-white dark:bg-gray-900 border-orange-200 dark:border-orange-800")
                  }
                >
                  <div className="flex items-start gap-2">
                    {rule.adjustmentAmount > 0 ? (
                      <TrendingUp className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="font-medium">{rule.name}</p>
                        {statusBadge}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {rule.conditionType} {rule.threshold}mg/dL{rule.comparison} {observed} →{" "}
                        <span
                          className={
                            rule.adjustmentAmount > 0
                              ? "text-blue-600 font-semibold"
                              : "text-red-600 font-semibold"
                          }
                        >
                          {rule.adjustmentAmount > 0 ? "+" : ""}
                          {rule.adjustmentAmount}単位
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {ruleEvaluations.some((e) => e.evaluation.status === "no_data") && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              ※
              「データ不足」のルールは該当日の血糖値が未記録のため適用判定できません。 必要な記録を入力すると評価されます。
            </p>
          )}
        </div>
      )}

      {ruleEvaluations.length === 0 && (
        <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
          <p className="text-sm text-muted-foreground text-center">
            このタイミングに登録された調整ルールはありません
          </p>
        </div>
      )}
    </>
  );

  /* ======================================================
     D-003 (薬機法対策): 主治医指示ルールに基づく参考値パネル。
     ここには「表示」しかしない。入力欄へ値が入るのは、ユーザーが
     下の「この値を入力欄に反映」をタップしたときだけ。
     ====================================================== */
  const dosePanel = (
    <>
      <div
        className="rounded-xl border-2 border-sky-300 dark:border-sky-700 bg-sky-50/70 dark:bg-sky-950/20 p-3 space-y-3"
        data-testid="reference-panel"
      >
        <div className="flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-sky-700 dark:text-sky-300 shrink-0" />
          <h4 className="text-sm font-semibold text-sky-900 dark:text-sky-100">
            主治医指示ルールに基づく参考値
          </h4>
        </div>

        {hasEvaluationError ? (
          <p className="text-xs text-red-600 dark:text-red-400" data-testid="reference-error">
            ルールまたは血糖値の取得に失敗したため、参考値を表示できません。ページを再読み込みしてください。
          </p>
        ) : referenceUnits === null ? (
          <p className="text-xs text-muted-foreground" data-testid="reference-loading">
            主治医指示ルールを読み込んでいます...
          </p>
        ) : (
          <>
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-3xl font-bold text-sky-900 dark:text-sky-100"
                data-testid="reference-units"
              >
                {referenceUnits}
              </span>
              <span className="text-sm text-sky-900 dark:text-sky-100">単位</span>
            </div>

            {/* 内訳 */}
            <div
              className="rounded-lg bg-white dark:bg-gray-900 border border-sky-200 dark:border-sky-800 p-2.5 space-y-1"
              data-testid="reference-breakdown"
            >
              <p className="text-xs font-semibold text-muted-foreground">内訳</p>
              <p className="text-xs">
                {timingLabel}の基準量 {timingBaseAmount}単位
              </p>
              {appliedRules.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  条件に一致した主治医指示ルールはありません
                </p>
              ) : (
                appliedRules.map(({ rule }) => (
                  <p key={rule.id} className="text-xs">
                    {rule.adjustmentAmount > 0 ? "＋" : "−"}「{rule.conditionType} {rule.threshold}mg/dL
                    {rule.comparison}」{rule.adjustmentAmount > 0 ? "+" : ""}
                    {rule.adjustmentAmount}単位 を適用
                  </p>
                ))
              )}
              <p className="text-xs font-semibold border-t border-sky-200 dark:border-sky-800 pt-1">
                ＝ {referenceUnits}単位
              </p>
              {referenceRawTotal !== null && referenceRawTotal !== referenceUnits && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  ※ 合計 {referenceRawTotal}単位 は入力できる範囲（0〜100単位）を外れるため{" "}
                  {referenceUnits}単位 として表示しています。
                </p>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full border-sky-400 dark:border-sky-600 text-sky-900 dark:text-sky-100 bg-white dark:bg-background hover:bg-sky-100 dark:hover:bg-sky-950/40"
              onClick={applyReferenceValue}
              disabled={isSaving || isEditPrefillLoading}
              data-testid="button-apply-reference"
            >
              <ArrowDownToLine className="w-4 h-4 mr-2" />
              この値を入力欄に反映
            </Button>

            {hasUnconfirmedAppliedRule && (
              <p
                className="text-xs text-amber-700 dark:text-amber-300"
                data-testid="reference-unconfirmed-note"
              >
                ※
                未確認ルールを含みます（主治医の指示であることの確認が未入力のルールが含まれています）。調整ルール画面で確認してください。
              </p>
            )}
          </>
        )}
      </div>

      {/* D-003: 免責の常設表示 (参考値パネルの直下) */}
      <p className="text-xs text-muted-foreground leading-relaxed" data-testid="entry-disclaimer">
        本アプリは医療機器ではありません。表示される値は、あなたが転記した主治医指示ルールの適用結果（参考値）です。治療の判断は必ず主治医の指示に従ってください。
      </p>
    </>
  );

  const insulinFieldHint =
    isReferenceValueIntact && !selectedPresetId ? (
      <p
        className="text-xs text-green-700 dark:text-green-300 mt-1 flex items-center gap-1"
        data-testid="hint-reference-applied"
      >
        <Activity className="w-3 h-3" />
        主治医指示ルールの参考値を反映しました（手動変更可）
      </p>
    ) : null;

  return {
    isRuleEvaluationLoading,
    hasEvaluationError,
    isReferenceValueIntact,
    timingRulesPanel,
    dosePanel,
    insulinFieldHint,
  };
};
