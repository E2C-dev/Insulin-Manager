import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Save, Activity, Info, TrendingUp, TrendingDown, Zap , Loader2} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useInsulinPresets } from "@/hooks/use-insulin-presets";
import { InsulinPresetSelector } from "@/components/entry/InsulinPresetSelector";
import { format, subDays } from "date-fns";
import { safeParseDate } from "@/lib/date-utils";
import { getTodayStr, getYesterdayStr, formatJaDate } from "@/lib/dateUtils";
import { QUERY_KEYS } from "@/lib/query-keys";
import {
  type InsulinTimeSlot,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EntryFormData {
  date: string;
  timeSlot: string;
  glucoseLevel: string;
  insulinUnits: string;
  note: string;
  /**
   * ユーザがインスリン量を手入力したかどうかのフラグ。
   * true の間は血糖値ベースの自動計算で insulinUnits を上書きしない。
   * (BUG-004 同時解消) リセット時に false、編集モード読み込み時は true に戻す。
   */
  insulinUnitsDirty: boolean;
}

export default function Entry() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<EntryFormData>({
    date: getTodayStr(),
    timeSlot: "",
    glucoseLevel: "",
    insulinUnits: "",
    note: "",
    insulinUnitsDirty: false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editGlucoseId, setEditGlucoseId] = useState<string | null>(null);
  const [editInsulinId, setEditInsulinId] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  // インスリンプリセット
  const { presets, isLoading: presetsLoading, isError: presetsError, getBasalDosesFromPresets } = useInsulinPresets();

  // URLパラメータから日付・タイムスロットを取得して編集モードで開く
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dateParam = params.get("date");
    const timeSlotParam = params.get("timeSlot");

    if (dateParam) {
      setIsEditMode(true);
      setFormData(prev => ({
        ...prev,
        date: dateParam,
        timeSlot: timeSlotParam || prev.timeSlot,
      }));
    }
  }, []);

  // 調整ルールを取得
  const { data: rulesData, isLoading: rulesLoading, isError: rulesError } = useQuery({
    queryKey: QUERY_KEYS.ADJUSTMENT_RULES,
    queryFn: async () => {
      const response = await fetch("/api/adjustment-rules", { credentials: "include" });
      if (!response.ok) throw new Error("ルールの取得に失敗しました");
      return response.json();
    },
  });

  // 編集モード時に既存データを取得してフォームに反映
  // B-003 fix: queryFn のクロージャ問題を回避するため `?startDate=&endDate=` で server-side filter する。
  // 旧実装は queryFn 内で `formData.date` を参照していたため、 setFormData(date) 直後の
  // 1サイクルだけ stale な date で fetch される race が発生し prefill が空のまま固まる経路があった。
  const { data: glucoseData, isLoading: glucoseLoading } = useQuery({
    queryKey: QUERY_KEYS.GLUCOSE_ENTRIES_BY_DATE(formData.date),
    queryFn: async () => {
      const response = await fetch(
        `/api/glucose-entries?startDate=${encodeURIComponent(formData.date)}&endDate=${encodeURIComponent(formData.date)}`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("血糖値記録の取得に失敗しました");
      const data = await response.json();
      return data.entries as Array<{ id: string; date: string; timeSlot: string; glucoseLevel: number; note: string | null }>;
    },
    enabled: isEditMode && !!formData.date,
  });

  const { data: insulinData, isLoading: insulinLoading } = useQuery({
    queryKey: QUERY_KEYS.INSULIN_ENTRIES_BY_DATE(formData.date),
    queryFn: async () => {
      const response = await fetch(
        `/api/insulin-entries?startDate=${encodeURIComponent(formData.date)}&endDate=${encodeURIComponent(formData.date)}`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("インスリン記録の取得に失敗しました");
      const data = await response.json();
      return data.entries as Array<{ id: string; date: string; timeSlot: string; units: string; presetId: string | null; note: string | null }>;
    },
    enabled: isEditMode && !!formData.date,
  });

  // B-001 (S0) のため、 ルール評価には「前日」測定値も必要。 編集モードでなくても
  // 当日 + 前日の glucose を常に取得して評価対象にする。 useQuery キャッシュで重複fetch回避。
  const yesterdayDateForRules = useMemo(() => {
    const baseDate = safeParseDate(formData.date, new Date());
    return format(subDays(baseDate, 1), "yyyy-MM-dd");
  }, [formData.date]);

  const { data: yesterdayGlucoseData, isLoading: yesterdayGlucoseLoading, isError: yesterdayGlucoseError } = useQuery({
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
  // 編集モードでは上の glucoseData と同じ key になり cache 共有される。
  const { data: todayGlucoseData, isLoading: todayGlucoseLoading, isError: todayGlucoseError } = useQuery({
    queryKey: QUERY_KEYS.GLUCOSE_ENTRIES_BY_DATE(formData.date),
    queryFn: async () => {
      const response = await fetch(
        `/api/glucose-entries?startDate=${encodeURIComponent(formData.date)}&endDate=${encodeURIComponent(formData.date)}`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("血糖値記録の取得に失敗しました");
      const data = await response.json();
      return data.entries as Array<{ date: string; timeSlot: string; glucoseLevel: number }>;
    },
    enabled: !!formData.date,
  });

  // 編集モード: 既存データをフォームに反映
  // B-003 fix: 念のため e.date === formData.date でも二重 filter する (server返却が広いケースの保険)。
  useEffect(() => {
    if (!isEditMode || !formData.timeSlot || !formData.date) return;

    const selectedOption = TIME_SLOT_OPTIONS.find(opt => opt.value === formData.timeSlot);
    if (!selectedOption) return;

    // 血糖値の反映
    if (glucoseData && Array.isArray(glucoseData)) {
      const glucoseEntry = glucoseData.find(
        (e) => e.timeSlot === formData.timeSlot && e.date === formData.date
      );
      if (glucoseEntry) {
        setFormData(prev => ({
          ...prev,
          glucoseLevel: String(glucoseEntry.glucoseLevel),
          // 編集モードで既存メモがある場合、 メモも反映
          note: prev.note || glucoseEntry.note || "",
        }));
        setEditGlucoseId(glucoseEntry.id);
      }
    }

    // インスリンの反映
    if (insulinData && Array.isArray(insulinData)) {
      const insulinEntry = insulinData.find(
        (e) => e.timeSlot === selectedOption.insulinSlot && e.date === formData.date
      );
      if (insulinEntry) {
        setFormData(prev => ({
          ...prev,
          insulinUnits: String(parseFloat(insulinEntry.units)),
          note: prev.note || insulinEntry.note || "",
          // 編集モードで既存のインスリン値を読み込んだ場合は dirty=true にして
          // 自動計算による上書きを抑止する (BUG-004)。
          insulinUnitsDirty: true,
        }));
        setEditInsulinId(insulinEntry.id);
        if (insulinEntry.presetId) setSelectedPresetId(insulinEntry.presetId);
      }
    }
  }, [isEditMode, formData.timeSlot, formData.date, glucoseData, insulinData]);

  // 編集モード loading state (B-003 fix)。 既存記録があるはずなのに空欄で「更新」を
  // 押されてデータが消失するのを防ぐため、 fetch 中は input を読取専用にする。
  const isEditPrefillLoading = isEditMode && (glucoseLoading || insulinLoading);

  const setToday = () => {
    setFormData(prev => ({ ...prev, date: getTodayStr() }));
  };

  const setYesterday = () => {
    setFormData(prev => ({ ...prev, date: getYesterdayStr() }));
  };

  // POST mutations
  const createGlucoseMutation = useMutation({
    mutationFn: async (data: { date: string; timeSlot: string; glucoseLevel: number; note?: string }) => {
      const response = await fetch("/api/glucose-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "血糖値の記録に失敗しました");
      }
      return response.json();
    },
  });

  const createInsulinMutation = useMutation({
    mutationFn: async (data: { date: string; timeSlot: string; units: string; presetId?: string; autoCalculated?: boolean; note?: string }) => {
      const response = await fetch("/api/insulin-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "インスリンの記録に失敗しました");
      }
      return response.json();
    },
  });

  // PUT mutations（編集モード用）
  const updateGlucoseMutation = useMutation({
    mutationFn: async (data: { id: string; glucoseLevel?: number; note?: string }) => {
      const { id, ...body } = data;
      const response = await fetch(`/api/glucose-entries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "血糖値の更新に失敗しました");
      }
      return response.json();
    },
  });

  const updateInsulinMutation = useMutation({
    mutationFn: async (data: { id: string; units?: string; presetId?: string; autoCalculated?: boolean; note?: string }) => {
      const { id, ...body } = data;
      const response = await fetch(`/api/insulin-entries/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "インスリンの更新に失敗しました");
      }
      return response.json();
    },
  });

  const handleInputChange = (field: keyof EntryFormData, value: string) => {
    setFormData(prev => {
      const next: EntryFormData = { ...prev, [field]: value } as EntryFormData;
      // ユーザが直接インスリン量を編集したら dirty=true にして自動計算で
      // 上書きされないようにする (BUG-004)。
      if (field === "insulinUnits") {
        next.insulinUnitsDirty = true;
      }
      return next;
    });
  };

  const resetForm = () => {
    setSelectedPresetId(null);
    setEditGlucoseId(null);
    setEditInsulinId(null);
    setFormData({
      date: getTodayStr(),
      timeSlot: "",
      glucoseLevel: "",
      insulinUnits: "",
      note: "",
      insulinUnitsDirty: false,
    });
  };

  // B-005: 桁ミス検知 — プリセットの基礎単位の 10 倍以上 (または絶対値 20 単位超)
  // で confirm dialog を出す。 妊娠糖尿病・小児DM など低単位ユーザーが多いこと、
  // 超速効型インスリンは 1〜15u/食が標準。 30u 超は超速効型としては異常。
  // Codex round 7 fix: 関数 closure を state に保存しない。 stale state を掴む
  // 古い closure が confirm 後に呼ばれ、 dialog 表示中に query が error/loading
  // へ変わっても古い guard で保存される経路を断つ。 action 識別子だけ保存し、
  // confirm 実行時に最新 render の doSave/doSameAsYesterdaySave を呼ぶ。
  const [pendingSave, setPendingSave] = useState<null | "save" | "sameAsYesterday">(null);
  const [digitMissWarning, setDigitMissWarning] = useState<string | null>(null);

  function checkDigitMiss(unitsStr: string, baseAmount: number | null): string | null {
    const units = parseFloat(unitsStr);
    if (isNaN(units)) return null;
    // 1. 絶対値による警告 (どんなプリセットでも超速効型 30u 超は要確認)
    if (units >= 30) {
      return `${units}単位は通常より大幅に多い量です。 桁を間違えていないか確認してください (例: 4 → 43 のtypo)。`;
    }
    // 2. プリセット基礎単位との乖離による警告
    if (baseAmount !== null && baseAmount > 0 && units >= baseAmount * 10) {
      return `入力値 ${units} 単位は、 設定された基礎投与量 ${baseAmount} 単位の 10倍以上 です。 桁を間違えていないか確認してください。`;
    }
    return null;
  }

  const doSave = async () => {
    if (!formData.timeSlot) return;
    // Codex round 5 fix: 桁ミス dialog 表示中に loading/error 状態が変化しても
    // ここで再ガードし、 silent wrong dose を防ぐ。
    if (isEditPrefillLoading) {
      toast({ title: "読み込み中", description: "既存記録の読み込みが完了するまでお待ちください。", variant: "destructive" });
      return;
    }
    if (hasEvaluationError) {
      toast({ title: "評価エラー", description: "ルールまたは血糖値の取得に失敗しました。ページを再読み込みしてからお試しください。", variant: "destructive" });
      return;
    }
    if (isRuleEvaluationLoading) {
      toast({ title: "評価中", description: "調整ルールの評価中です。 数秒後にもう一度お試しください。", variant: "destructive" });
      return;
    }
    setIsSaving(true);

    try {
      const promises: Promise<any>[] = [];
      const selectedOption = TIME_SLOT_OPTIONS.find(opt => opt.value === formData.timeSlot);

      // Codex指摘対応 (2026-07-26): サーバーのdefense-in-depthチェックが
      // 「自動計算されたそのままの値か」を判定できるよう明示的に伝える。
      // dirty (手入力/プリセット選択で上書き) の場合は「昨日と同じ」等と同様、
      // ユーザーの明示的な意図によるものなのでルール再計算チェックの対象外とする。
      const isAutoCalculated = !formData.insulinUnitsDirty && !selectedPresetId;
      // Codexレビュー2巡目指摘対応: 手入力(dirty)でプリセット未選択の場合まで
      // resolvedPresetIdForTiming (自動計算用に解決された先頭プリセット) を
      // 送ってしまうと、実際には使っていないプリセットを記録に紐付けてしまう。
      // 自動計算パスのときのみ resolvedPresetIdForTiming を使う。
      const presetIdForSubmit = selectedPresetId ?? (isAutoCalculated ? resolvedPresetIdForTiming : null) ?? undefined;

      if (isEditMode) {
        // 編集モード: PUT
        if (formData.glucoseLevel && selectedOption?.glucoseSlot) {
          if (editGlucoseId) {
            promises.push(updateGlucoseMutation.mutateAsync({
              id: editGlucoseId,
              glucoseLevel: parseInt(formData.glucoseLevel),
              note: formData.note || undefined,
            }));
          } else {
            // 既存記録 ID が無い → upsert で create (server側で UNIQUE 制約により安全)
            promises.push(createGlucoseMutation.mutateAsync({
              date: formData.date,
              timeSlot: formData.timeSlot,
              glucoseLevel: parseInt(formData.glucoseLevel),
              note: formData.note || undefined,
            }));
          }
        }

        if (formData.insulinUnits && selectedOption?.insulinSlot) {
          if (editInsulinId) {
            promises.push(updateInsulinMutation.mutateAsync({
              id: editInsulinId,
              units: formData.insulinUnits,
              presetId: presetIdForSubmit,
              autoCalculated: isAutoCalculated,
              note: formData.note || undefined,
            }));
          } else {
            // 既存記録 ID が無い → upsert で create
            promises.push(createInsulinMutation.mutateAsync({
              date: formData.date,
              timeSlot: selectedOption.insulinSlot,
              units: formData.insulinUnits,
              presetId: presetIdForSubmit,
              autoCalculated: isAutoCalculated,
              note: formData.note || undefined,
            }));
          }
        }
      } else {
        // 新規モード: POST (server側で upsert)
        if (formData.glucoseLevel && selectedOption?.glucoseSlot) {
          promises.push(createGlucoseMutation.mutateAsync({
            date: formData.date,
            timeSlot: formData.timeSlot,
            glucoseLevel: parseInt(formData.glucoseLevel),
            note: formData.note || undefined,
          }));
        }

        if (formData.insulinUnits && selectedOption?.insulinSlot) {
          promises.push(createInsulinMutation.mutateAsync({
            date: formData.date,
            timeSlot: selectedOption.insulinSlot,
            units: formData.insulinUnits,
            presetId: presetIdForSubmit,
            autoCalculated: isAutoCalculated,
            note: formData.note || undefined,
          }));
        }
      }

      await Promise.all(promises);

      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GLUCOSE_ENTRIES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.INSULIN_ENTRIES });

      const dateLabel = formatJaDate(formData.date);
      const timeLabel = selectedOption?.label || "";

      toast({
        title: isEditMode ? "✅ 更新成功" : "✅ 保存成功",
        description: `${dateLabel} ${timeLabel}の記録を${isEditMode ? "更新" : "保存"}しました`,
      });

      // 新規モードではフォームをリセット（日付・タイミングは保持）
      if (!isEditMode) {
        setFormData(prev => ({ ...prev, glucoseLevel: "", insulinUnits: "", note: "", insulinUnitsDirty: false }));
        setSelectedPresetId(null);
      }
    } catch (error) {
      toast({
        title: isEditMode ? "更新失敗" : "保存失敗",
        description: error instanceof Error ? error.message : "記録の保存に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.timeSlot) {
      toast({ title: "入力エラー", description: "測定タイミングを選択してください", variant: "destructive" });
      return;
    }

    if (!formData.glucoseLevel && !formData.insulinUnits) {
      toast({ title: "入力エラー", description: "血糖値またはインスリン量のいずれかを入力してください", variant: "destructive" });
      return;
    }

    // Codex round 2 fix: 編集モードで prefill 完了前は保存させない (既存値を空で
    // 上書きする経路を断つ)。 ルール評価未完了の自動計算結果を含む保存も同様に
    // 止める。
    if (isEditPrefillLoading) {
      toast({
        title: "読み込み中",
        description: "既存記録の読み込みが完了するまでお待ちください。",
        variant: "destructive",
      });
      return;
    }
    if (hasEvaluationError) {
      toast({
        title: "評価エラー",
        description: "ルールまたは血糖値の取得に失敗しました。ページを再読み込みしてからお試しください。",
        variant: "destructive",
      });
      return;
    }
    if (isRuleEvaluationLoading) {
      toast({
        title: "評価中",
        description: "調整ルールの評価中です。 数秒後にもう一度お試しください。",
        variant: "destructive",
      });
      return;
    }

    // B-005: 桁ミス検知 — confirm 必須
    if (formData.insulinUnits) {
      const warning = checkDigitMiss(formData.insulinUnits, timingBaseAmount);
      if (warning) {
        setDigitMissWarning(warning);
        setPendingSave("save");
        return;
      }
    }

    await doSave();
  };

  const getDateLabel = () => {
    const today = getTodayStr();
    const yesterday = getYesterdayStr();
    if (formData.date === today) return "今日";
    if (formData.date === yesterday) return "昨日";
    return formatJaDate(formData.date);
  };

  const getTimeSlotLabel = () => {
    const option = TIME_SLOT_OPTIONS.find(opt => opt.value === formData.timeSlot);
    return option ? option.label : "";
  };

  // 選択されたタイミングに基づいてインスリン情報を取得
  const getInsulinTimingInfo = useMemo(() => {
    if (!formData.timeSlot) return null;
    const selectedOption = TIME_SLOT_OPTIONS.find(opt => opt.value === formData.timeSlot);
    if (!selectedOption) return null;

    const insulinSlot = selectedOption.insulinSlot as InsulinTimeSlot;
    const labels: Record<string, string> = {
      Breakfast: "朝食", Lunch: "昼食", Dinner: "夕食", Bedtime: "眠前",
    };

    const { presetId: resolvedPresetId, units: baseAmount } = getBasalDosesFromPresets(insulinSlot);

    return { label: labels[insulinSlot], baseAmount, insulinSlot, resolvedPresetId };
  }, [formData.timeSlot, presets, getBasalDosesFromPresets]);
  // primitiveとして抽出 (Sprint 3 S3-6の教訓: useMemoオブジェクト参照を
  // 直接依存配列に入れると再レンダーループのリスクがあるため)。
  const resolvedPresetIdForTiming = getInsulinTimingInfo?.resolvedPresetId ?? null;

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
    if (!formData.date || !formData.timeSlot) return [];
    if (!rulesData?.rules) return [];

    // Codexレビュー2巡目指摘対応: 自動計算で使うプリセット (resolvedPresetId) に
    // 紐づくルール (+ 全プリセット共通の presetId 未設定ルール) のみを対象にする。
    // server/insulinDoseSafetyNet.ts の defense-in-depth チェックも同じ絞り込みを
    // 行うため、ここで揃えないと「client は全ルール適用・server は絞り込み」で
    // 期待値がズレて誤った dose_mismatch 監査ログを生む。
    const rules: AdjustmentRule[] = rulesData.rules.filter(
      (r: AdjustmentRule) => !r.presetId || r.presetId === resolvedPresetIdForTiming
    );
    const selectedOption = TIME_SLOT_OPTIONS.find(opt => opt.value === formData.timeSlot);
    if (!selectedOption) return [];

    const currentTiming = INSULIN_TIME_SLOT_LABELS[selectedOption.insulinSlot];

    // Codex round 2 review fix: 当日同枠ルールは「いま入力中のフォーム血糖値」を
    // リアルタイム評価対象にする。 これがないと「当日朝食前≤70→朝-1u」 ルールが、
    // 朝食前血糖60mg/dLを初回入力するときに no_data 扱いされ、 減量提案されない
    // regression を引き起こす (Codex final review 指摘)。
    const formGlucoseRaw = formData.glucoseLevel?.trim?.() ?? "";
    const formGlucoseNum = formGlucoseRaw === "" ? null : parseInt(formGlucoseRaw, 10);
    const formGlucoseValid = formGlucoseNum !== null && !isNaN(formGlucoseNum);

    // DB から取得済みの当日・前日 glucose をまとめたフォールバック lookup。
    const dbLookup = buildGlucoseLookup([
      ...(todayGlucoseData ?? []),
      ...(yesterdayGlucoseData ?? []),
    ]);

    const glucoseLookup = (date: string, slot: MeasurementTimeSlot) => {
      // 当日同枠 (= いま入力しようとしている glucose) は、フォーム入力値を
      // 優先的に評価対象にする。 これで DB 保存前のリアルタイム補正提案が可能。
      if (date === formData.date && slot === formData.timeSlot && formGlucoseValid) {
        return formGlucoseNum!;
      }
      return dbLookup(date, slot);
    };

    return evaluateRules(rules, currentTiming, formData.date, glucoseLookup);
  }, [formData.date, formData.timeSlot, formData.glucoseLevel, rulesData, yesterdayGlucoseData, todayGlucoseData, resolvedPresetIdForTiming]);

  // B-004: 累積適用の制御 (shared/adjustmentRuleEngine.ts の pickAppliedRules に集約)
  const appliedRules = useMemo<EvaluatedRule<AdjustmentRule>[]>(
    () => pickAppliedRules(ruleEvaluations),
    [ruleEvaluations]
  );

  // 情報を表示するかどうか
  const shouldShowInfo = formData.date && formData.timeSlot;

  // 「昨日と同じ」機能: formData.dateの1日前
  const yesterdayDate = useMemo(() => {
    // formData.date が "" や不正値だと new Date が Invalid Date になり
    // subDays → format で RangeError → ホワイトアウト経路 (BUG-003)。
    // safeParseDate で fallback (今日) を使い、必ず妥当な Date を作る。
    const baseDate = safeParseDate(formData.date, new Date());
    return format(subDays(baseDate, 1), "yyyy-MM-dd");
  }, [formData.date]);

  // 昨日のインスリン記録を取得
  const { data: yesterdayInsulinData } = useQuery({
    queryKey: QUERY_KEYS.INSULIN_ENTRIES_BY_DATE(yesterdayDate),
    queryFn: async () => {
      const response = await fetch(
        `/api/insulin-entries?startDate=${yesterdayDate}&endDate=${yesterdayDate}`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("昨日のデータ取得に失敗しました");
      return response.json();
    },
    enabled: !!formData.timeSlot,
  });

  // 選択タイミングに対応する昨日のインスリン記録
  const yesterdayEntry = useMemo(() => {
    if (!formData.timeSlot || !yesterdayInsulinData?.entries) return null;
    const selectedOption = TIME_SLOT_OPTIONS.find(opt => opt.value === formData.timeSlot);
    if (!selectedOption) return null;
    return yesterdayInsulinData.entries.find((e: any) => e.timeSlot === selectedOption.insulinSlot) ?? null;
  }, [formData.timeSlot, yesterdayInsulinData]);

  // 「昨日と同じ」ワンタップ保存ハンドラ
  // Codex round 2 fix: 「昨日と同じ」も桁ミス警告を通す (昨日 43u を typo した
  // 後にこのボタンで連日 43u が保存される regression を防ぐ)
  const doSameAsYesterdaySave = async () => {
    if (!yesterdayEntry || !formData.timeSlot) return;
    // Codex round 5 fix: 同じ guard を 「昨日と同じ」 経路にも適用 (fail-closed)
    if (isEditPrefillLoading) {
      toast({ title: "読み込み中", description: "既存記録の読み込みが完了するまでお待ちください。", variant: "destructive" });
      return;
    }
    if (hasEvaluationError) {
      toast({ title: "評価エラー", description: "ルールまたは血糖値の取得に失敗しました。ページを再読み込みしてからお試しください。", variant: "destructive" });
      return;
    }
    if (isRuleEvaluationLoading) {
      toast({ title: "評価中", description: "調整ルールの評価中です。 数秒後にもう一度お試しください。", variant: "destructive" });
      return;
    }

    const selectedOption = TIME_SLOT_OPTIONS.find(opt => opt.value === formData.timeSlot);
    if (!selectedOption?.insulinSlot) return;

    const units = String(parseFloat(yesterdayEntry.units));
    const presetId = yesterdayEntry.presetId ?? null;

    setIsSaving(true);
    try {
      if (isEditMode && editInsulinId) {
        await updateInsulinMutation.mutateAsync({
          id: editInsulinId,
          units,
          presetId: presetId ?? undefined,
        });
      } else {
        await createInsulinMutation.mutateAsync({
          date: formData.date,
          timeSlot: selectedOption.insulinSlot,
          units,
          presetId: presetId ?? undefined,
        });
      }

      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.INSULIN_ENTRIES });

      const dateLabel = formatJaDate(formData.date);
      const prevLabel = formatJaDate(yesterdayDate);

      toast({
        title: "✅ 保存成功",
        description: `${dateLabel} ${selectedOption.label}：${prevLabel}と同じ ${units}単位を記録しました`,
      });

      if (!isEditMode) {
        setFormData(prev => ({ ...prev, glucoseLevel: "", insulinUnits: "", note: "", insulinUnitsDirty: false }));
        setSelectedPresetId(null);
      }
    } catch (error) {
      toast({
        title: "保存失敗",
        description: error instanceof Error ? error.message : "記録の保存に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSameAsYesterday = async () => {
    if (!yesterdayEntry) return;
    // 桁ミス検知を通す (handleSubmit と同じガード)
    const yesterdayUnits = String(parseFloat(yesterdayEntry.units));
    const warning = checkDigitMiss(yesterdayUnits, timingBaseAmount);
    if (warning) {
      setDigitMissWarning(warning);
      setPendingSave("sameAsYesterday");
      return;
    }
    await doSameAsYesterdaySave();
  };

  // Sprint 3 (S3-6): useEffect 依存配列を primitive に展開する。
  // 旧: getInsulinTimingInfo (object) と applicableRules (array) を依存に直接入れていたため、
  //     親 (useMemo の依存変化) で参照が変わるたび effect が再実行されるリスクあり。
  //     特に getInsulinTimingInfo は formData.timeSlot 以外に presets / getBasalDosesFromPresets
  //     にも依存しており、Insulin Presets 取得タイミングで参照が breakage する可能性。
  // 新: 必要な値 (baseAmount) を primitive として抽出し、依存配列に primitive のみを入れる。
  //     applicableRules は length と JSON 化したシグネチャに分解せず、参照維持を useMemo 側
  //     の memoization に任せる (applicableRules は既に useMemo で正しく安定化済み)。
  //     既存の「直前と同値なら setState skip」ガード (BUG-001 fix) は維持。
  const timingBaseAmount = getInsulinTimingInfo?.baseAmount ?? null;
  // 自動計算の基礎量がどのプリセット由来かは resolvedPresetIdForTiming
  // (このコンポーネント上部で定義済み) を参照する。

  // B-001 fix: 自動計算は **appliedRules (= condition-aware で matched と判定された
  // ルールだけ)** を加算する。 旧実装は applicableRules (時間帯フィルタのみ) で、
  // 入力中の glucoseLevel を無条件に当てていた致命的バグ。
  // また「血糖値入力前でも基礎単位を提示」 する挙動に変更 — 患者が血糖値未入力でも
  // プリセットの基礎単位は見えるべき (UI/UX 改善)。
  // Codex round 2/3 fix: rules/glucose/preset loading 中、 および query error
  // 発生中は 自動計算を走らせない + 保存させない。 silent fallback で
  // 不正確な推奨値が出る経路を完全に断つ。
  // - query error 時に isLoading=false で fallthrough して「データ不足」 として
  //   保存できる経路は medical safety critical なので block
  // - preset cold load 中は基礎量 0/localStorage fallback で誤計算が出る
  const hasEvaluationError = rulesError || todayGlucoseError || yesterdayGlucoseError || presetsError;
  const isRuleEvaluationLoading =
    rulesLoading ||
    todayGlucoseLoading ||
    yesterdayGlucoseLoading ||
    presetsLoading ||
    hasEvaluationError;

  useEffect(() => {
    // ユーザが手入力 or プリセット選択でインスリンに触れたら以後は上書きしない
    if (formData.insulinUnitsDirty) return;
    if (selectedPresetId) return;
    if (!formData.timeSlot) return;
    if (timingBaseAmount === null) return;
    // ルール評価未完了の間は自動計算しない (Codex round 2 指摘)
    if (isRuleEvaluationLoading) return;
    // 編集モードで既存値 prefill 中も自動計算しない (上書きリスク)
    if (isEditPrefillLoading) return;

    // 条件評価できたルール (matched のうち累積制御を通過したもの) のみ加算する。
    // not_matched / no_data / unknown_condition は決して加算しない
    // (B-001 / 医療安全の中核)。上限ガード (0〜100単位、zod validation
    // insertInsulinEntrySchema と整合) は shared/adjustmentRuleEngine.ts の
    // calculateAdjustedUnits に集約済み。上限近辺は B-005 桁ミス警告で別途確認する。
    const finalInsulin = calculateAdjustedUnits(timingBaseAmount, appliedRules);
    setFormData(prev => {
      // 直前と同値なら setState せず、無限ループ気味の再レンダーも防ぐ。
      const next = finalInsulin.toString();
      if (prev.insulinUnits === next) return prev;
      return { ...prev, insulinUnits: next };
    });
  }, [
    formData.timeSlot,
    formData.insulinUnitsDirty,
    timingBaseAmount,
    appliedRules,
    selectedPresetId,
    isRuleEvaluationLoading,
    isEditPrefillLoading,
  ]);

  return (
    <AppLayout>
      <div className="pt-6 px-6 pb-6 space-y-6">
        <PageHeader
          title={isEditMode ? "記録編集" : "記録入力"}
          subtitle={isEditMode ? "既存の記録を編集" : "3ステップで簡単に記録"}
          onBack={() => setLocation("/logbook")}
        />

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Step 1: 日付選択 */}
          <Card className="border-2 border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-3 bg-blue-50 dark:bg-blue-950/20">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold">1</div>
                <CardTitle className="text-base text-blue-900 dark:text-blue-100">いつの記録ですか？</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4 bg-blue-50/30 dark:bg-blue-950/10">
              <div className="grid grid-cols-[auto_1fr] gap-3 items-end">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={formData.date === getYesterdayStr() ? "default" : "outline"}
                    size="sm"
                    onClick={setYesterday}
                    data-testid="button-yesterday"
                  >
                    昨日
                  </Button>
                  <Button
                    type="button"
                    variant={formData.date === getTodayStr() ? "default" : "outline"}
                    size="sm"
                    onClick={setToday}
                    data-testid="button-today"
                  >
                    今日
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    id="date"
                    type="date"
                    data-testid="input-date"
                    value={formData.date}
                    onChange={(e) => handleInputChange("date", e.target.value)}
                    className="h-9"
                  />
                  <div className="text-sm font-semibold text-primary whitespace-nowrap">
                    → {getDateLabel()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 2: 測定タイミング選択 */}
          <Card className="border-2 border-orange-200 dark:border-orange-800">
            <CardHeader className="pb-3 bg-orange-50 dark:bg-orange-950/20">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-600 text-white text-sm font-bold">2</div>
                <CardTitle className="text-base text-orange-900 dark:text-orange-100">測定タイミングはいつですか？</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4 bg-orange-50/30 dark:bg-orange-950/10 space-y-4">
              <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                <Select
                  value={formData.timeSlot}
                  onValueChange={(value) => {
                    handleInputChange("timeSlot", value);
                    setSelectedPresetId(null); // タイミング変更時にプリセット選択をリセット
                  }}
                >
                  <SelectTrigger data-testid="select-timeslot" className="h-10">
                    <SelectValue placeholder="タイミングを選択してください" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-950">
                    {TIME_SLOT_OPTIONS.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value}
                        data-testid={`option-${option.value}`}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.timeSlot && (
                  <div className="text-sm font-semibold text-primary whitespace-nowrap">
                    → {getTimeSlotLabel()}
                  </div>
                )}
              </div>

              {/* インスリンプリセット選択 */}
              {shouldShowInfo && getInsulinTimingInfo && (
                <InsulinPresetSelector
                  timeSlot={getInsulinTimingInfo.insulinSlot}
                  presets={presets}
                  selectedPresetId={selectedPresetId}
                  onPresetSelect={(presetId, units) => {
                    setSelectedPresetId(presetId);
                    // プリセット選択もユーザの明示的な指定なので dirty=true。
                    setFormData(prev => ({
                      ...prev,
                      insulinUnits: units.toString(),
                      insulinUnitsDirty: true,
                    }));
                  }}
                />
              )}

              {/* 現在の投与量とルール情報 */}
              {shouldShowInfo && getInsulinTimingInfo && (
                <div className="space-y-3 pt-3 border-t border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-orange-700 dark:text-orange-300" />
                    <h4 className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                      現在の設定情報
                    </h4>
                  </div>

                  {/* 基礎インスリン投与量 */}
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-muted-foreground">
                        {getInsulinTimingInfo.label}の基礎投与量
                      </span>
                      <span className="text-2xl font-bold text-primary">
                        {getInsulinTimingInfo.baseAmount} <span className="text-sm">単位</span>
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      設定画面で登録された基準投与量です
                    </p>
                  </div>

                  {/* 適用される調整ルール (B-001 fix: 条件評価結果を明示表示) */}
                  {ruleEvaluations.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                        この時間帯のルール（{ruleEvaluations.length}件）
                      </p>
                      <div className="space-y-2 max-h-[260px] overflow-y-auto">
                        {ruleEvaluations.map(({ rule, evaluation }) => {
                          const isApplied = appliedRules.some(r => r.rule.id === rule.id);
                          const statusBadge = (() => {
                            if (evaluation.status === "matched" && isApplied) {
                              return <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 font-semibold">✓ 適用</span>;
                            }
                            if (evaluation.status === "matched" && !isApplied) {
                              return <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">条件一致(重複のため不採用)</span>;
                            }
                            if (evaluation.status === "not_matched") {
                              return <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">対象外</span>;
                            }
                            if (evaluation.status === "no_data") {
                              return <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100">データ不足</span>;
                            }
                            return <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-800">条件不明</span>;
                          })();

                          const observed = (evaluation.status === "matched" || evaluation.status === "not_matched")
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
                                    <span className={rule.adjustmentAmount > 0 ? "text-blue-600 font-semibold" : "text-red-600 font-semibold"}>
                                      {rule.adjustmentAmount > 0 ? "+" : ""}{rule.adjustmentAmount}単位
                                    </span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {ruleEvaluations.some(e => e.evaluation.status === "no_data") && (
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          ※ 「データ不足」のルールは該当日の血糖値が未記録のため適用判定できません。 必要な記録を入力すると評価されます。
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
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 3: 測定値入力 */}
          <Card className="border-2 border-green-200 dark:border-green-800">
            <CardHeader className="pb-3 bg-green-50 dark:bg-green-950/20">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600 text-white text-sm font-bold">3</div>
                <div className="flex-1">
                  <CardTitle className="text-base text-green-900 dark:text-green-100">測定値を入力してください</CardTitle>
                  <CardDescription className="text-xs mt-1 text-green-700 dark:text-green-300">
                    血糖値とインスリンのどちらか、または両方を入力
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 bg-green-50/30 dark:bg-green-950/10">
              {/* 昨日と同じボタン */}
              {formData.timeSlot && yesterdayEntry && (
                <button
                  type="button"
                  onClick={handleSameAsYesterday}
                  disabled={isSaving || isEditPrefillLoading || isRuleEvaluationLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-50 border-2 border-amber-400 hover:bg-amber-100 active:bg-amber-200 dark:bg-amber-950/30 dark:border-amber-600 dark:hover:bg-amber-950/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="font-bold text-amber-800 dark:text-amber-200">
                    昨日と同じ {parseFloat(yesterdayEntry.units)}単位を登録
                  </span>
                  <span className="text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap">
                    （ワンタップで保存）
                  </span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="glucoseLevel" className="text-xs text-muted-foreground">
                    血糖値 (任意)
                  </Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      id="glucoseLevel"
                      data-testid="input-glucoseLevel"
                      type="number"
                      placeholder={isEditPrefillLoading ? "読み込み中..." : "例: 120"}
                      value={formData.glucoseLevel}
                      onChange={(e) => handleInputChange("glucoseLevel", e.target.value)}
                      className="h-10"
                      min="20"
                      max="600"
                      readOnly={isEditPrefillLoading}
                      disabled={isEditPrefillLoading}
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">mg/dL</span>
                  </div>
                </div>

                <div>
                  <Label htmlFor="insulinUnits" className="text-xs text-muted-foreground">
                    インスリン (任意)
                  </Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      id="insulinUnits"
                      data-testid="input-insulinUnits"
                      type="number"
                      step="1"
                      placeholder={isEditPrefillLoading ? "読み込み中..." : "例: 5"}
                      value={formData.insulinUnits}
                      onChange={(e) => handleInputChange("insulinUnits", e.target.value)}
                      className="h-10"
                      min="0"
                      max="100"
                      readOnly={isEditPrefillLoading}
                      disabled={isEditPrefillLoading}
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">単位</span>
                  </div>
                  {formData.insulinUnits && !formData.insulinUnitsDirty && !selectedPresetId && (
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1 flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      基礎単位とルール評価から自動計算されました（手動変更可）
                    </p>
                  )}
                  {formData.insulinUnits && selectedPresetId && (
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1 flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      プリセットから選択されました（手動変更可）
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="note" className="text-xs text-muted-foreground">
                  メモ (任意)
                </Label>
                <Textarea
                  id="note"
                  data-testid="input-note"
                  placeholder="備考があれば入力してください"
                  value={formData.note}
                  onChange={(e) => handleInputChange("note", e.target.value)}
                  className="mt-1 min-h-[50px] text-sm"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* 保存・リセットボタン */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
              disabled={isSaving}
              data-testid="button-reset"
              className="flex-1"
            >
              リセット
            </Button>
            <Button
              type="submit"
              className="flex-1"
              size="lg"
              data-testid="button-save"
              disabled={
                isSaving ||
                createGlucoseMutation.isPending ||
                createInsulinMutation.isPending ||
                updateGlucoseMutation.isPending ||
                updateInsulinMutation.isPending ||
                isEditPrefillLoading ||
                isRuleEvaluationLoading
              }
            >
              {isSaving ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="w-5 h-5 mr-2" />
              )}
              {isSaving
                ? "保存中..."
                : isEditPrefillLoading
                ? "読み込み中..."
                : hasEvaluationError
                ? "評価エラー"
                : isRuleEvaluationLoading
                ? "評価中..."
                : isEditMode
                ? "更新"
                : "保存"}
            </Button>
          </div>
        </form>

        {/* B-005: 桁ミス検知 confirm dialog */}
        <AlertDialog
          open={!!digitMissWarning}
          onOpenChange={(open) => {
            if (!open) {
              setDigitMissWarning(null);
              setPendingSave(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>入力値の確認</AlertDialogTitle>
              <AlertDialogDescription>
                {digitMissWarning}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setDigitMissWarning(null);
                  setPendingSave(null);
                }}
                data-testid="button-digitmiss-cancel"
              >
                入力をやり直す
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  // Codex round 7 fix: action 識別子で振り分け、 confirm 時点の
                  // 最新 doSave/doSameAsYesterdaySave (= 最新 guard) を呼ぶ。
                  const action = pendingSave;
                  setDigitMissWarning(null);
                  setPendingSave(null);
                  if (action === "save") await doSave();
                  else if (action === "sameAsYesterday") await doSameAsYesterdaySave();
                }}
                data-testid="button-digitmiss-confirm"
              >
                この値で保存する
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
