import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QUERY_KEYS } from "@/lib/query-keys";
import { type AdjustmentRule, TIME_SLOT_OPTIONS, INSULIN_TIME_SLOT_LABELS } from "@/lib/types";
import type { UseDoseGuidance } from "./contract";

/**
 * client/src/features/dose-panel/ios.tsx  —— iOS 版 (算出なし・指示票表示型)
 *
 * ============================================================================
 * App Store Review Guideline 1.4.2 対応の中核ファイル
 * ============================================================================
 * このファイルは「利用者が自分で転記した主治医指示（スライディングスケール）を
 * 表のまま表示する」だけを行う。アプリは何も計算しない。
 *
 * ★ 絶対にやってはいけないこと（実装者への恒久的な指示）:
 *   1. 入力された血糖値に応じて該当行をハイライトしない。
 *      血糖値→単位数の対応付けをアプリが行った時点で実質的に計算機になる。
 *      → そのため本ファイルは input.glucoseLevel を **一切参照しない**。
 *   2. 合計・推奨・参考値といった算出結果を表示しない。
 *      表示してよいのは「血糖値に依存しない定数」だけ
 *      (基準量 N単位・転記済みの調整量そのもの)。
 *   3. shared/adjustmentRuleEngine.ts を import しない。
 *      import した瞬間に iOS バンドルへ算出コードが混入する。
 *   4. 「計算機能はWeb版で」という誘導導線を置かない (迂回と受け取られうる)。
 * ============================================================================
 */

/** D-003: 指示日 / 指示元 を「2026-05-01 / ○○病院」の形にまとめる。 */
function formatInstructionMeta(
  instructedAt?: string | null,
  instructedBy?: string | null
): string {
  const parts = [instructedAt, instructedBy].filter(
    (v): v is string => typeof v === "string" && v.trim() !== ""
  );
  return parts.length > 0 ? parts.join(" / ") : "—";
}

export const useDoseGuidance: UseDoseGuidance = (input) => {
  const {
    timeSlot,
    timingLabel,
    timingBaseAmount,
    resolvedPresetIdForTiming,
    presetsLoading,
    presetsError,
    isEditPrefillLoading,
    isSaving,
    applyUnits,
  } = input;

  // 指示票の表示に必要なのは「転記済みの主治医指示ルール」だけ。
  // Web 版と違い、血糖値記録 (当日/前日) は取得しない —— 評価しないので不要。
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

  /**
   * 表示対象の指示行。
   * 「いま選んでいる投与タイミング」と「使用するインスリンプリセット」で
   * 絞り込むだけ。血糖値は一切参照しないので、これは評価ではなく
   * 単なる表示フィルタである (Web 版が Step2 に出す集合と同じ)。
   */
  const sheetRules = useMemo<AdjustmentRule[]>(() => {
    if (!timeSlot) return [];
    if (!rulesData?.rules) return [];

    const selectedOption = TIME_SLOT_OPTIONS.find((opt) => opt.value === timeSlot);
    if (!selectedOption) return [];

    const currentTiming = INSULIN_TIME_SLOT_LABELS[selectedOption.insulinSlot];
    const expectedTarget = `当日の${currentTiming}`;

    return (rulesData.rules as AdjustmentRule[]).filter(
      (rule) =>
        (!rule.presetId || rule.presetId === resolvedPresetIdForTiming) &&
        rule.timeSlot === currentTiming &&
        !!rule.targetTimeSlot &&
        rule.targetTimeSlot === expectedTarget
    );
  }, [timeSlot, rulesData, resolvedPresetIdForTiming]);

  const hasUnconfirmedRule = useMemo(
    () => sheetRules.some((rule) => rule.doctorConfirmed !== true),
    [sheetRules]
  );

  // Web 版と同じ fail-closed 方針を維持する。
  // (指示票が読めていない状態のまま保存させない。ただし血糖値記録の取得は
  //  そもそも行わないため、その分の条件は無い)
  const hasEvaluationError = rulesError || presetsError;
  const isRuleEvaluationLoading = rulesLoading || presetsLoading || hasEvaluationError;

  const isSheetReady = !hasEvaluationError && !rulesLoading && !presetsLoading;

  // iOS 版は参考値を持たないので、サーバ安全ネットの autoCalculated は常に false。
  const isReferenceValueIntact = false;

  // Step2 側には何も出さない。血糖値に対する評価結果 (✓適用 / 対象外 /
  // データ不足) は、行のハイライトそのものなので iOS 版には存在しない。
  const timingRulesPanel = null;

  const dosePanel = (
    <>
      <div
        className="rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40 p-3 space-y-3"
        data-testid="instruction-sheet-panel"
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-slate-700 dark:text-slate-300 shrink-0" />
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            あなたの指示票（主治医指示の転記）
          </h4>
        </div>

        {hasEvaluationError ? (
          <p className="text-xs text-red-600 dark:text-red-400" data-testid="instruction-sheet-error">
            主治医指示の取得に失敗したため、指示票を表示できません。ページを再読み込みしてください。
          </p>
        ) : !isSheetReady ? (
          <p className="text-xs text-muted-foreground" data-testid="instruction-sheet-loading">
            主治医指示を読み込んでいます...
          </p>
        ) : (
          <>
            <div
              className="rounded-lg bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-700 p-2.5 flex items-center justify-between"
              data-testid="instruction-sheet-base"
            >
              <span className="text-xs font-semibold text-muted-foreground">
                {timingLabel}の基準量
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {timingBaseAmount === null ? "—" : timingBaseAmount}
                <span className="text-xs font-normal ml-1">単位</span>
              </span>
            </div>

            {sheetRules.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-1">
                このタイミングに転記された主治医指示はありません
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-900">
                <table className="w-full text-xs" data-testid="instruction-sheet-table">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800">
                      <th className="text-left font-semibold px-2.5 py-1.5">条件</th>
                      <th className="text-right font-semibold px-2.5 py-1.5 whitespace-nowrap">
                        調整量
                      </th>
                      <th className="text-left font-semibold px-2.5 py-1.5 whitespace-nowrap">
                        転記日 / 指示元
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/*
                      全行を同じ見た目で描画する。入力中の血糖値によって
                      行を強調・並べ替え・抽出することは 1.4.2 上できない。
                    */}
                    {sheetRules.map((rule) => (
                      <tr
                        key={rule.id}
                        className="border-t border-slate-200 dark:border-slate-700"
                        data-testid="instruction-sheet-row"
                      >
                        <td className="px-2.5 py-1.5 align-top">
                          <span className="block font-medium">{rule.name}</span>
                          <span className="block text-muted-foreground">
                            {rule.conditionType} {rule.threshold}mg/dL{rule.comparison}
                          </span>
                        </td>
                        <td className="px-2.5 py-1.5 align-top text-right whitespace-nowrap font-semibold">
                          {rule.adjustmentAmount > 0 ? "+" : ""}
                          {rule.adjustmentAmount}単位
                        </td>
                        <td className="px-2.5 py-1.5 align-top text-muted-foreground whitespace-nowrap">
                          {formatInstructionMeta(rule.instructedAt, rule.instructedBy)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/*
              血糖値に依存しない定数 (基準量) のワンタップ入力。
              これは「表示されている基準量をそのまま入力欄へ写す」操作であり、
              血糖値からの算出ではない。
            */}
            {timingBaseAmount !== null && (
              <Button
                type="button"
                variant="outline"
                className="w-full border-slate-400 dark:border-slate-600 text-slate-900 dark:text-slate-100 bg-white dark:bg-background hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => applyUnits(String(timingBaseAmount), false)}
                disabled={isSaving || isEditPrefillLoading}
                data-testid="button-apply-base-amount"
              >
                基準量 {timingBaseAmount}単位 を入力
              </Button>
            )}

            {hasUnconfirmedRule && (
              <p
                className="text-xs text-amber-700 dark:text-amber-300"
                data-testid="instruction-sheet-unconfirmed-note"
              >
                ※
                未確認ルールを含みます（主治医の指示であることの確認が未入力のルールが含まれています）。調整ルール画面で確認してください。
              </p>
            )}
          </>
        )}
      </div>

      {/* D-003: 免責の常設表示 (指示票パネルの直下) */}
      <p className="text-xs text-muted-foreground leading-relaxed" data-testid="entry-disclaimer">
        本アプリは医療機器ではありません。ここに表示しているのは、あなたが転記した主治医の指示内容そのものです。本アプリは投与量の計算や提案を行いません。治療の判断は必ず主治医の指示に従ってください。
      </p>
    </>
  );

  const insulinFieldHint = null;

  return {
    isRuleEvaluationLoading,
    hasEvaluationError,
    isReferenceValueIntact,
    timingRulesPanel,
    dosePanel,
    insulinFieldHint,
  };
};
