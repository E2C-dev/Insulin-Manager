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
import { Save, Activity, Info, Zap, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useInsulinPresets } from "@/hooks/use-insulin-presets";
import { InsulinPresetSelector } from "@/components/entry/InsulinPresetSelector";
import { format, subDays } from "date-fns";
import { safeParseDate } from "@/lib/date-utils";
import { getTodayStr, getYesterdayStr, formatJaDate } from "@/lib/dateUtils";
import { QUERY_KEYS } from "@/lib/query-keys";
import {
  type InsulinTimeSlot,
  TIME_SLOT_OPTIONS,
} from "@/lib/types";
// ============================================================================
// App Store Review Guideline 1.4.2 対応のビルド分離ポイント
// ============================================================================
// `@dose-panel` の解決先は vite.config.ts が VITE_BUILD_TARGET で切り替える。
//   web → client/src/features/dose-panel/web.tsx (参考値を算出して提示する)
//   ios → client/src/features/dose-panel/ios.tsx (転記済み指示票を静的表示のみ)
// 実行時フラグでの出し分けは 2.3.1 違反になるため絶対に行わない。ここで
// import するのは常に 1 つだけであり、iOS ビルドのモジュールグラフには
// 算出コード (web.tsx / shared/adjustmentRuleEngine.ts) が一切入らない。
// ============================================================================
import { useDoseGuidance } from "@dose-panel";
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
   * ユーザがインスリン量に触れたか (手入力 / プリセット選択 / 参考値の反映) の
   * フラグ。D-003 (薬機法対策) で血糖値からの自動セットは廃止したため、
   * このフラグは「アプリ由来の値ではなくユーザーの明示操作で入った値である」
   * ことを表す記録用のマーカーとして残す (BUG-004 の dirty ガードの精神を維持)。
   * リセット時に false、編集モード読み込み時は true に戻す。
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
  // D-003 (薬機法対策): dose panel の「この値を入力欄に反映」をユーザーが
  // 明示的にタップしたかどうか。血糖値入力による自動セットは廃止したため、
  // この明示操作だけがパネルの値を insulinUnits に入れる唯一の経路。
  // (解除タイミングが手入力・プリセット選択・リセット・保存後の各ハンドラに
  //  紐づくため、state は Entry 側で持ち、判定だけを dose panel に委ねる)
  const [referenceApplied, setReferenceApplied] = useState(false);

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

  // ルール評価に必要な「当日 / 前日の血糖値」の取得は dose panel 実装側
  // (features/dose-panel/web.tsx) に移した。iOS ビルドでは評価そのものを
  // 行わないため、これらの fetch も発生しない。
  //
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
          // 編集モードで既存のインスリン値を読み込んだ場合は dirty=true にする
          // (アプリ由来ではなく既存記録由来の値であることの記録・BUG-004)。
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
    mutationFn: async (data: { date: string; timeSlot: string; units: string; presetId?: string; autoCalculated?: boolean; liveMeasurementSlot?: string; note?: string }) => {
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
    mutationFn: async (data: { id: string; units?: string; presetId?: string; autoCalculated?: boolean; liveMeasurementSlot?: string; note?: string }) => {
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
    if (field === "insulinUnits") {
      // 手入力に切り替わったので「参考値をそのまま反映した状態」ではなくなる。
      setReferenceApplied(false);
    }
    setFormData(prev => {
      const next: EntryFormData = { ...prev, [field]: value } as EntryFormData;
      // ユーザが直接インスリン量を編集したら dirty=true (BUG-004 の記録を維持)。
      if (field === "insulinUnits") {
        next.insulinUnitsDirty = true;
      }
      return next;
    });
  };

  const resetForm = () => {
    setSelectedPresetId(null);
    setReferenceApplied(false);
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
      // 「ルール適用結果そのままの値か」を判定できるよう明示的に伝える。
      // D-003 以降は「参考値パネルの反映ボタンでルール適用結果を入れ、その後
      // 手を加えていない」場合のみ true (= server 側の再計算と突合可能)。
      // 手入力・プリセット明示選択・「昨日と同じ」はユーザーの明示的な意図に
      // よる値なのでルール再計算チェックの対象外とする。
      const isAutoCalculated = isReferenceValueIntact && !selectedPresetId;
      // Codexレビュー2巡目指摘対応: 手入力(dirty)でプリセット未選択の場合まで
      // resolvedPresetIdForTiming (参考値の計算に使った先頭プリセット) を
      // 送ってしまうと、実際には使っていないプリセットを記録に紐付けてしまう。
      // 参考値をそのまま反映したパスのときのみ resolvedPresetIdForTiming を使う。
      const presetIdForSubmit = selectedPresetId ?? (isAutoCalculated ? resolvedPresetIdForTiming : null) ?? undefined;
      // Codexレビュー3巡目指摘対応: CURRENT_SLOT_MEASUREMENT は「食前」枠に
      // 固定されており、食後1時間枠 (BreakfastAfter1h等) を記録する際は
      // 実際に並行POSTされる glucose の枠と一致しない。formData.timeSlot
      // (= TIME_SLOT_OPTIONS の value = MeasurementTimeSlot そのもの) を
      // 明示的に送り、サーバーのレース判定が正しい枠を見られるようにする。
      const liveMeasurementSlot = formData.timeSlot || undefined;

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
              liveMeasurementSlot,
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
              liveMeasurementSlot,
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
            liveMeasurementSlot,
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
        setReferenceApplied(false);
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
    // 上書きする経路を断つ)。 ルール評価未完了の参考値を含む保存も同様に
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
        setReferenceApplied(false);
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
  // 参考値の基礎量がどのプリセット由来かは resolvedPresetIdForTiming
  // (このコンポーネント上部で定義済み) を参照する。

  // ==========================================================================
  // D-003 (薬機法対策) / App Store 1.4.2: dose panel への委譲
  // ==========================================================================
  // 旧実装は血糖値を入力した瞬間に useEffect が insulinUnits へ計算結果を
  // 自動セットしていた。これは「アプリが投与量を決めている」= 医療機器プログラム
  // 該当性グレー (厚労省 判断事例⑫) の核心だったため D-003 で廃止した。
  //
  // さらに App Store Review Guideline 1.4.2 (投与量計算機の禁止) に対応する
  // ため、「主治医指示ルールを評価して参考値を出す」処理そのものを
  // features/dose-panel へ切り出し、ビルドターゲットで実装を差し替える。
  //   web ビルド … 従来どおり参考値を算出・提示する (挙動・data-testid とも不変)
  //   ios ビルド … 転記済みの指示票を静的表示するだけ (算出コードを含まない)
  //
  // Entry 側が使うのは次の 3 つだけ:
  //   - isRuleEvaluationLoading / hasEvaluationError … fail-closed の保存ガード
  //   - isReferenceValueIntact … サーバ安全ネットへ渡す autoCalculated の条件
  // ==========================================================================

  // 入力欄へ値を入れる唯一の経路 (ユーザーの明示的なタップでのみ呼ばれる)。
  // fromReference=true (= 参考値をそのまま反映) のときだけ referenceApplied を
  // 立て、server/insulinDoseSafetyNet.ts の再計算チェック対象にする。
  const applyUnitsFromPanel = (units: string, fromReference: boolean) => {
    setFormData(prev => ({ ...prev, insulinUnits: units, insulinUnitsDirty: true }));
    setReferenceApplied(fromReference);
  };

  const doseGuidance = useDoseGuidance({
    date: formData.date,
    timeSlot: formData.timeSlot,
    glucoseLevel: formData.glucoseLevel,
    insulinUnits: formData.insulinUnits,
    timingLabel: getInsulinTimingInfo?.label ?? null,
    timingBaseAmount,
    resolvedPresetIdForTiming,
    selectedPresetId,
    presetsLoading,
    presetsError,
    isEditPrefillLoading,
    isSaving,
    referenceApplied,
    applyUnits: applyUnitsFromPanel,
  });

  const { hasEvaluationError, isRuleEvaluationLoading, isReferenceValueIntact } = doseGuidance;

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
                    // プリセットを明示選択した時点で「参考値をそのまま反映した
                    // 状態」ではなくなる (D-003)。
                    setReferenceApplied(false);
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

                  {/* 主治医指示ルールの一覧・条件評価結果 (build target で実装が差し替わる) */}
                  {doseGuidance.timingRulesPanel}
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

              {/* ======================================================
                  D-003 (薬機法対策) / App Store 1.4.2:
                  投与量まわりのパネル。実装はビルドターゲットで差し替わる。
                    web … 主治医指示ルールに基づく参考値 (算出して提示)
                    ios … 転記済み指示票の静的表示 (算出しない)
                  いずれも「表示」しかせず、入力欄へ値が入るのはユーザーが
                  パネル内のボタンをタップしたときだけ。免責の常設表示 (D-003)
                  は両実装が持つ。
                  ====================================================== */}
              {formData.timeSlot && getInsulinTimingInfo && doseGuidance.dosePanel}

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
                  {doseGuidance.insulinFieldHint}
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
