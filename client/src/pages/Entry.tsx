import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PlusCircle, Calendar, Clock, Save, ArrowLeft, Activity, Info, TrendingUp, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, subDays } from "date-fns";
import { ja } from "date-fns/locale";
import { DEFAULT_SETTINGS, type InsulinTimeSlot } from "@/lib/types";

interface EntryFormData {
  date: string;
  timeSlot: string;
  glucoseLevel: string;
  insulinUnits: string;
  note: string;
}

interface AdjustmentRule {
  id: string;
  name: string;
  timeSlot: string;
  conditionType: string;
  threshold: number;
  comparison: string;
  adjustmentAmount: number;
  targetTimeSlot: string;
}

const TIME_SLOT_GROUPS = [
  {
    groupLabel: "朝食",
    options: [
      { value: "BreakfastBefore", label: "食前", glucoseSlot: true, insulinSlot: "Breakfast" },
      { value: "BreakfastAfter1h", label: "食後1時間", glucoseSlot: true, insulinSlot: "Breakfast" },
    ]
  },
  {
    groupLabel: "昼食",
    options: [
      { value: "LunchBefore", label: "食前", glucoseSlot: true, insulinSlot: "Lunch" },
      { value: "LunchAfter1h", label: "食後1時間", glucoseSlot: true, insulinSlot: "Lunch" },
    ]
  },
  {
    groupLabel: "夕食",
    options: [
      { value: "DinnerBefore", label: "食前", glucoseSlot: true, insulinSlot: "Dinner" },
      { value: "DinnerAfter1h", label: "食後1時間", glucoseSlot: true, insulinSlot: "Dinner" },
    ]
  },
  {
    groupLabel: "眠前",
    options: [
      { value: "BeforeSleep", label: "眠前", glucoseSlot: true, insulinSlot: "Bedtime" },
    ]
  },
] as const;

const TIME_SLOT_OPTIONS = TIME_SLOT_GROUPS.flatMap(group => group.options);

export default function Entry() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<EntryFormData>({
    date: format(new Date(), "yyyy-MM-dd"),
    timeSlot: "",
    glucoseLevel: "",
    insulinUnits: "",
    note: "",
  });

  const [isSaving, setIsSaving] = useState(false);
  const [basalInsulinDoses, setBasalInsulinDoses] = useState(DEFAULT_SETTINGS.basalInsulinDoses);

  // 基礎インスリン投与量をローカルストレージから読み込む
  useEffect(() => {
    const savedDoses = localStorage.getItem("basalInsulinDoses");
    if (savedDoses) {
      try {
        const parsed = JSON.parse(savedDoses);
        setBasalInsulinDoses(parsed);
      } catch (error) {
        console.error("Failed to parse saved basal insulin doses:", error);
      }
    }
  }, []);

  // 調整ルールを取得
  const { data: rulesData } = useQuery({
    queryKey: ["adjustment-rules"],
    queryFn: async () => {
      const response = await fetch("/api/adjustment-rules", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("ルールの取得に失敗しました");
      return response.json();
    },
  });

  const setToday = () => {
    setFormData(prev => ({ ...prev, date: format(new Date(), "yyyy-MM-dd") }));
  };

  const setYesterday = () => {
    setFormData(prev => ({ ...prev, date: format(subDays(new Date(), 1), "yyyy-MM-dd") }));
  };

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
    mutationFn: async (data: { date: string; timeSlot: string; units: string; note?: string }) => {
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

  const handleInputChange = (field: keyof EntryFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      date: format(new Date(), "yyyy-MM-dd"),
      timeSlot: "",
      glucoseLevel: "",
      insulinUnits: "",
      note: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // バリデーション
    if (!formData.timeSlot) {
      toast({
        title: "入力エラー",
        description: "測定タイミングを選択してください",
        variant: "destructive",
      });
      return;
    }

    if (!formData.glucoseLevel && !formData.insulinUnits) {
      toast({
        title: "入力エラー",
        description: "血糖値またはインスリン量のいずれかを入力してください",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const promises: Promise<any>[] = [];
      const selectedOption = TIME_SLOT_OPTIONS.find(opt => opt.value === formData.timeSlot);

      // 血糖値の記録
      if (formData.glucoseLevel && selectedOption?.glucoseSlot) {
        promises.push(createGlucoseMutation.mutateAsync({
          date: formData.date,
          timeSlot: formData.timeSlot,
          glucoseLevel: parseInt(formData.glucoseLevel),
          note: formData.note || undefined,
        }));
      }

      // インスリンの記録
      if (formData.insulinUnits && selectedOption?.insulinSlot) {
        promises.push(createInsulinMutation.mutateAsync({
          date: formData.date,
          timeSlot: selectedOption.insulinSlot,
          units: formData.insulinUnits,
          note: formData.note || undefined,
        }));
      }

      await Promise.all(promises);

      queryClient.invalidateQueries({ queryKey: ["glucose-entries"] });
      queryClient.invalidateQueries({ queryKey: ["insulin-entries"] });

      const dateLabel = format(new Date(formData.date), "M月d日", { locale: ja });
      const timeLabel = selectedOption?.label || "";

      toast({
        title: "✅ 保存成功",
        description: `${dateLabel} ${timeLabel}の記録を保存しました`,
      });

      // フォームをリセット（日付とタイミングは保持）
      setFormData(prev => ({
        ...prev,
        glucoseLevel: "",
        insulinUnits: "",
        note: "",
      }));
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

  const getDateLabel = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
    
    if (formData.date === today) return "今日";
    if (formData.date === yesterday) return "昨日";
    return format(new Date(formData.date), "M月d日", { locale: ja });
  };

  const getTimeSlotLabel = () => {
    const option = TIME_SLOT_OPTIONS.find(opt => opt.value === formData.timeSlot);
    if (!option) return "";
    
    const group = TIME_SLOT_GROUPS.find(g => g.options.some(o => o.value === formData.timeSlot));
    return group ? `${group.groupLabel}${option.label}` : option.label;
  };

  // 選択されたタイミングに基づいてインスリンのタイミングを取得
  const getInsulinTimingInfo = useMemo(() => {
    if (!formData.timeSlot) return null;

    const selectedOption = TIME_SLOT_OPTIONS.find(opt => opt.value === formData.timeSlot);
    if (!selectedOption) return null;

    const insulinSlot = selectedOption.insulinSlot;
    const insulinSlotMap: Record<string, { label: string; key: InsulinTimeSlot }> = {
      "Breakfast": { label: "朝食", key: "Breakfast" },
      "Lunch": { label: "昼食", key: "Lunch" },
      "Dinner": { label: "夕食", key: "Dinner" },
      "Bedtime": { label: "眠前", key: "Bedtime" },
    };

    const timing = insulinSlotMap[insulinSlot];
    if (!timing) return null;

    return {
      label: timing.label,
      baseAmount: basalInsulinDoses[timing.key],
    };
  }, [formData.timeSlot, basalInsulinDoses]);

  // 適用される調整ルールを計算
  const applicableRules = useMemo(() => {
    if (!formData.date || !formData.timeSlot) return [];
    if (!rulesData?.rules) return [];

    const rules: AdjustmentRule[] = rulesData.rules;
    const selectedOption = TIME_SLOT_OPTIONS.find(opt => opt.value === formData.timeSlot);
    if (!selectedOption) return [];

    // インスリンのタイミングを判定
    const insulinTimingMap: Record<string, string> = {
      "Breakfast": "朝",
      "Lunch": "昼",
      "Dinner": "夕",
      "Bedtime": "眠前",
    };
    const currentTiming = insulinTimingMap[selectedOption.insulinSlot];

    // 現在のタイミングに適用されるルールをフィルタ
    return rules.filter(rule => rule.timeSlot === currentTiming);
  }, [formData.date, formData.timeSlot, rulesData]);

  // 情報を表示するかどうか
  const shouldShowInfo = formData.date && formData.timeSlot;

  return (
    <AppLayout>
      <div className="pt-6 px-6 pb-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            data-testid="button-back"
            onClick={() => setLocation("/logbook")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">記録入力</h1>
            <p className="text-muted-foreground text-sm">
              3ステップで簡単に記録
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Step 1: 日付選択 */}
          <Card className="border-2 border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-3 bg-blue-50 dark:bg-blue-950/20">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold">
                  1
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base text-blue-900 dark:text-blue-100">いつの記録ですか？</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 bg-blue-50/30 dark:bg-blue-950/10">
              <div className="grid grid-cols-[auto_1fr] gap-3 items-end">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={formData.date === format(subDays(new Date(), 1), "yyyy-MM-dd") ? "default" : "outline"}
                    size="sm"
                    onClick={setYesterday}
                    data-testid="button-yesterday"
                  >
                    昨日
                  </Button>
                  <Button
                    type="button"
                    variant={formData.date === format(new Date(), "yyyy-MM-dd") ? "default" : "outline"}
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
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-600 text-white text-sm font-bold">
                  2
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base text-orange-900 dark:text-orange-100">測定タイミングはいつですか？</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 bg-orange-50/30 dark:bg-orange-950/10">
              <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                <Select
                  value={formData.timeSlot}
                  onValueChange={(value) => handleInputChange("timeSlot", value)}
                >
                  <SelectTrigger data-testid="select-timeslot" className="h-10">
                    <SelectValue placeholder="タイミングを選択してください" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-950">
                    {TIME_SLOT_GROUPS.map((group) => (
                      <SelectGroup key={group.groupLabel}>
                        <SelectLabel>{group.groupLabel}</SelectLabel>
                        {group.options.map((option) => (
                          <SelectItem 
                            key={option.value} 
                            value={option.value}
                            data-testid={`option-${option.value}`}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                {formData.timeSlot && (
                  <div className="text-sm font-semibold text-primary whitespace-nowrap">
                    → {getTimeSlotLabel()}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 現在の投与量とルール情報 */}
          {shouldShowInfo && getInsulinTimingInfo && (
            <Card className="border-2 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  <CardTitle className="text-base text-blue-900 dark:text-blue-100">
                    現在の設定情報
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 基礎インスリン投与量 */}
                <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border">
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

                {/* 適用される調整ルール */}
                {applicableRules.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-muted-foreground">
                      適用される調整ルール（{applicableRules.length}件）
                    </p>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {applicableRules.map((rule) => (
                        <div
                          key={rule.id}
                          className="bg-white dark:bg-gray-900 p-3 rounded-lg border text-sm"
                        >
                          <div className="flex items-start gap-2">
                            {rule.adjustmentAmount > 0 ? (
                              <TrendingUp className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                            ) : (
                              <TrendingDown className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                            )}
                            <div className="flex-1">
                              <p className="font-medium mb-1">{rule.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {rule.conditionType} {rule.threshold}mg/dL{rule.comparison} → {" "}
                                <span className={rule.adjustmentAmount > 0 ? "text-blue-600 font-semibold" : "text-red-600 font-semibold"}>
                                  {rule.adjustmentAmount > 0 ? "+" : ""}{rule.adjustmentAmount}単位
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {applicableRules.length === 0 && (
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border">
                    <p className="text-sm text-muted-foreground text-center">
                      このタイミングに適用される調整ルールはありません
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: 測定値入力 */}
          <Card className="border-2 border-green-200 dark:border-green-800">
            <CardHeader className="pb-3 bg-green-50 dark:bg-green-950/20">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600 text-white text-sm font-bold">
                  3
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base text-green-900 dark:text-green-100">測定値を入力してください</CardTitle>
                  <CardDescription className="text-xs mt-1 text-green-700 dark:text-green-300">
                    血糖値とインスリンのどちらか、または両方を入力
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 bg-green-50/30 dark:bg-green-950/10">
              {/* 血糖値とインスリンを横並び */}
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
                      placeholder="例: 120"
                      value={formData.glucoseLevel}
                      onChange={(e) => handleInputChange("glucoseLevel", e.target.value)}
                      className="h-10"
                      min="20"
                      max="600"
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
                      step="0.5"
                      placeholder="例: 5"
                      value={formData.insulinUnits}
                      onChange={(e) => handleInputChange("insulinUnits", e.target.value)}
                      className="h-10"
                      min="0"
                      max="100"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">単位</span>
                  </div>
                </div>
              </div>

              {/* メモ欄 */}
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
              disabled={isSaving}
            >
              <Save className="w-5 h-5 mr-2" />
              {isSaving ? "保存中..." : "保存"}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
