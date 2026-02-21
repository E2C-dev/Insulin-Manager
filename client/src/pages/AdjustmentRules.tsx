import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useInsulinPresets } from "@/hooks/use-insulin-presets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Activity, Coffee, Sun, Sunset, Moon, Syringe } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "wouter";

interface AdjustmentRule {
  id: string;
  name: string;
  timeSlot: string;
  conditionType: string;
  threshold: number;
  comparison: string;
  adjustmentAmount: number;
  targetTimeSlot: string;
  presetId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RuleFormData {
  name: string;
  timeSlot: string;
  conditionType: string;
  threshold: number;
  comparison: "以下" | "以上" | "未満" | "超える";
  adjustmentAmount: number;
  targetTimeSlot: string;
  presetId: string | null;
}

const initialFormData: RuleFormData = {
  name: "",
  timeSlot: "朝",
  conditionType: "前日眠前血糖",
  threshold: 70,
  comparison: "以下",
  adjustmentAmount: -1,
  targetTimeSlot: "前日の眠前",
  presetId: null,
};

// 測定タイミングの選択肢（前日・当日の区別を追加）
const MEASUREMENT_OPTIONS: Array<{
  value: string;
  label: string;
  timeSlots: string[];
  group?: string;
}> = [
  // 前日の測定
  { value: "前日朝食前血糖", label: "前日の朝食前の血糖値", timeSlots: ["朝", "昼", "夕", "眠前"], group: "前日" },
  { value: "前日朝食後血糖", label: "前日の朝食後1hの血糖値", timeSlots: ["朝", "昼", "夕", "眠前"], group: "前日" },
  { value: "前日昼食前血糖", label: "前日の昼食前の血糖値", timeSlots: ["朝", "昼", "夕", "眠前"], group: "前日" },
  { value: "前日昼食後血糖", label: "前日の昼食後1hの血糖値", timeSlots: ["朝", "昼", "夕", "眠前"], group: "前日" },
  { value: "前日夕食前血糖", label: "前日の夕食前の血糖値", timeSlots: ["朝", "昼", "夕", "眠前"], group: "前日" },
  { value: "前日夕食後血糖", label: "前日の夕食後1hの血糖値", timeSlots: ["朝", "昼", "夕", "眠前"], group: "前日" },
  { value: "前日眠前血糖", label: "前日の眠前の血糖値", timeSlots: ["朝", "昼", "夕", "眠前"], group: "前日" },
  
  // 当日の測定
  { value: "当日朝食前血糖", label: "当日の朝食前の血糖値", timeSlots: ["朝", "昼", "夕", "眠前"], group: "当日" },
  { value: "当日朝食後血糖", label: "当日の朝食後1hの血糖値", timeSlots: ["朝", "昼", "夕", "眠前"], group: "当日" },
  { value: "当日昼食前血糖", label: "当日の昼食前の血糖値", timeSlots: ["昼", "夕", "眠前"], group: "当日" },
  { value: "当日昼食後血糖", label: "当日の昼食後1hの血糖値", timeSlots: ["昼", "夕", "眠前"], group: "当日" },
  { value: "当日夕食前血糖", label: "当日の夕食前の血糖値", timeSlots: ["夕", "眠前"], group: "当日" },
  { value: "当日夕食後血糖", label: "当日の夕食後1hの血糖値", timeSlots: ["夕", "眠前"], group: "当日" },
  { value: "当日眠前血糖", label: "当日の眠前の血糖値", timeSlots: ["眠前"], group: "当日" },
];

// 調整対象の選択肢（前日・当日すべてのタイミング）
const TARGET_OPTIONS = [
  // 前日
  { value: "前日の朝", label: "前日の朝食", group: "前日" },
  { value: "前日の昼", label: "前日の昼食", group: "前日" },
  { value: "前日の夕", label: "前日の夕食", group: "前日" },
  { value: "前日の眠前", label: "前日の眠前", group: "前日" },
  // 当日
  { value: "当日の朝", label: "当日の朝食", group: "当日" },
  { value: "当日の昼", label: "当日の昼食", group: "当日" },
  { value: "当日の夕", label: "当日の夕食", group: "当日" },
  { value: "当日の眠前", label: "当日の眠前", group: "当日" },
] as const;

// 時間帯の定義
const TIME_SLOTS = [
  { value: "朝", label: "朝食", icon: Coffee, color: "text-orange-500" },
  { value: "昼", label: "昼食", icon: Sun, color: "text-yellow-500" },
  { value: "夕", label: "夕食", icon: Sunset, color: "text-purple-500" },
  { value: "眠前", label: "眠前", icon: Moon, color: "text-blue-500" },
] as const;

// 調整対象の選択肢を取得（時間帯に基づく）
const getTargetOptions = (_timeSlot: string) => {
  return TARGET_OPTIONS;
};

// 時間帯の表示用マッピング
const TIME_SLOT_DISPLAY: Record<string, string> = {
  "朝": "朝（朝食時）",
  "昼": "昼（昼食時）",
  "夕": "夕（夕食時）",
  "眠前": "眠前",
};

// 測定タイミングの表示用関数
const getConditionTypeLabel = (conditionType: string): string => {
  const option = MEASUREMENT_OPTIONS.find(opt => opt.value === conditionType);
  if (option) {
    return option.label;
  }
  
  // 古い形式の場合は、そのまま表示
  const oldFormatMap: Record<string, string> = {
    "食前血糖": "食前の血糖値",
    "食後血糖": "食後1hの血糖値",
    "眠前血糖": "眠前の血糖値",
    "夜間血糖": "夜間の血糖値",
  };
  
  return oldFormatMap[conditionType] || conditionType;
};

// 調整対象タイミングの表示用関数
const getTargetTimeSlotLabel = (targetTimeSlot: string): string => {
  const option = TARGET_OPTIONS.find(opt => opt.value === targetTimeSlot);
  if (option) {
    return option.label;
  }
  
  // 古い形式の場合は、そのまま表示
  const oldFormatMap: Record<string, string> = {
    "前日の眠前": "前日の眠前",
    "朝": "朝",
    "昼": "昼",
    "夕": "夕",
    "眠前": "眠前",
  };
  
  return oldFormatMap[targetTimeSlot] || targetTimeSlot;
};

// 調整量のフォーマット
const formatAdjustmentAmount = (amount: number) => {
  return amount > 0 ? `+${amount}` : `${amount}`;
};

export default function AdjustmentRules() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AdjustmentRule | null>(null);
  const [formData, setFormData] = useState<RuleFormData>(initialFormData);
  const [activeTab, setActiveTab] = useState<string>("朝");
  const { presets } = useInsulinPresets();

  // ルール一覧取得
  const { data: rulesData, isLoading } = useQuery({
    queryKey: ["adjustmentRules"],
    queryFn: async () => {
      const response = await fetch("/api/adjustment-rules", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("ルールの取得に失敗しました");
      }

      return response.json() as Promise<{ rules: AdjustmentRule[] }>;
    },
  });

  // ルール作成
  const createMutation = useMutation({
    mutationFn: async (data: RuleFormData) => {
      const response = await fetch("/api/adjustment-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      const text = await response.text();
      const result = text ? JSON.parse(text) : {};

      if (!response.ok) {
        throw new Error(result.message || "ルールの作成に失敗しました");
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adjustmentRules"] });
      toast({
        title: "作成成功",
        description: "ルールを作成しました",
      });
      setIsDialogOpen(false);
      setFormData(initialFormData);
    },
    onError: (error: Error) => {
      toast({
        title: "作成失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // ルール更新
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: RuleFormData }) => {
      const response = await fetch(`/api/adjustment-rules/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      const text = await response.text();
      const result = text ? JSON.parse(text) : {};

      if (!response.ok) {
        throw new Error(result.message || "ルールの更新に失敗しました");
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adjustmentRules"] });
      toast({
        title: "更新成功",
        description: "ルールを更新しました",
      });
      setIsDialogOpen(false);
      setEditingRule(null);
      setFormData(initialFormData);
    },
    onError: (error: Error) => {
      toast({
        title: "更新失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // ルール削除
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/adjustment-rules/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const text = await response.text();
      const result = text ? JSON.parse(text) : {};

      if (!response.ok) {
        throw new Error(result.message || "ルールの削除に失敗しました");
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adjustmentRules"] });
      toast({
        title: "削除成功",
        description: "ルールを削除しました",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "削除失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.presetId) {
      toast({
        title: "インスリンを選択してください",
        description: "使用するインスリンは必須です",
        variant: "destructive",
      });
      return;
    }
    console.log("フォーム送信:", editingRule ? "更新" : "新規作成", formData);

    // ルール名が空の場合、自動生成
    const finalFormData = {
      ...formData,
      name: formData.name || 
        `${formData.timeSlot}の${formData.conditionType}${formData.threshold}${formData.comparison}→${formData.targetTimeSlot}${formData.adjustmentAmount > 0 ? '+' : ''}${formData.adjustmentAmount}単位`
    };
    
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: finalFormData });
    } else {
      createMutation.mutate(finalFormData);
    }
  };

  const handleEdit = (rule: AdjustmentRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      timeSlot: rule.timeSlot,
      conditionType: rule.conditionType,
      threshold: rule.threshold,
      comparison: rule.comparison as RuleFormData["comparison"],
      adjustmentAmount: rule.adjustmentAmount,
      targetTimeSlot: rule.targetTimeSlot,
      presetId: rule.presetId,
    });
    setIsDialogOpen(true);
  };

  const handleOpenDialog = () => {
    console.log("新規ルール追加: 時間帯 =", activeTab);
    // 現在のタブの時間帯を初期値に設定
    setFormData({
      ...initialFormData,
      timeSlot: activeTab,
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = (open: boolean) => {
    console.log("ダイアログ状態変更:", open ? "開く" : "閉じる");
    setIsDialogOpen(open);
    if (!open) {
      // ダイアログが閉じられたときのみリセット
      setEditingRule(null);
      setFormData(initialFormData);
    }
  };

  // ルールを時間帯ごとにグループ化
  const groupRulesByTimeSlot = (rules: AdjustmentRule[]) => {
    const grouped: Record<string, AdjustmentRule[]> = {
      "朝": [],
      "昼": [],
      "夕": [],
      "眠前": [],
    };
    
    rules.forEach((rule) => {
      const slot = rule.timeSlot;
      if (grouped[slot]) {
        grouped[slot].push(rule);
      } else {
        // その他の時間帯も含める
        if (!grouped["その他"]) {
          grouped["その他"] = [];
        }
        grouped["その他"].push(rule);
      }
    });
    
    return grouped;
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Spinner />
        </div>
      </AppLayout>
    );
  }

  const rules = rulesData?.rules || [];
  const groupedRules = groupRulesByTimeSlot(rules);

  return (
    <AppLayout>
      <div className="pt-6 px-6 pb-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">調整ルール管理</h1>
            <p className="text-muted-foreground text-sm">
              血糖値に基づいたインスリン調整ルールを設定
            </p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
            <DialogTrigger asChild>
              <Button size="lg" className="shadow-lg" onClick={handleOpenDialog}>
                <Plus className="w-5 h-5 mr-2" />
                新規ルール
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto z-50">
              <DialogHeader>
                <DialogTitle>
                  {editingRule ? "ルールを編集" : "新しいルールを作成"}
                </DialogTitle>
                <DialogDescription>
                  血糖値の条件とインスリン調整量を設定してください
                </DialogDescription>
              </DialogHeader>

              {presets.length === 0 ? (
                <div className="flex flex-col items-center gap-4 py-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <Syringe className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-1">インスリンが登録されていません</p>
                    <p className="text-xs text-muted-foreground">
                      調整ルールを作成するには、先に設定画面でインスリンを登録してください。
                    </p>
                  </div>
                  <Link href="/settings">
                    <Button onClick={() => setIsDialogOpen(false)}>
                      設定画面でインスリンを登録する
                    </Button>
                  </Link>
                </div>
              ) : (
              <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                {/* ステップ1: いつの測定を見るか */}
                <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">1</div>
                    <h3 className="font-semibold text-sm">インスリン投与のタイミングと判断基準を設定</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="timeSlot" className="text-xs">インスリンを注射するタイミング</Label>
                      <Select
                        value={formData.timeSlot}
                        onValueChange={(value) => {
                          setFormData({ 
                            ...formData, 
                            timeSlot: value,
                            targetTimeSlot: TARGET_OPTIONS[0].value
                          });
                        }}
                      >
                        <SelectTrigger id="timeSlot" className="bg-white dark:bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={5} className="z-[9999] bg-white dark:bg-gray-950 border shadow-lg">
                          <SelectItem value="朝">朝（朝食時）</SelectItem>
                          <SelectItem value="昼">昼（昼食時）</SelectItem>
                          <SelectItem value="夕">夕（夕食時）</SelectItem>
                          <SelectItem value="眠前">眠前</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="conditionType" className="text-xs">判断に使う血糖値の測定タイミング</Label>
                      <Select
                        value={formData.conditionType}
                        onValueChange={(value) => setFormData({ ...formData, conditionType: value })}
                      >
                        <SelectTrigger id="conditionType" className="bg-white dark:bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={5} className="z-[9999] bg-white dark:bg-gray-950 border shadow-lg">
                          {/* 前日のグループ */}
                          <SelectGroup>
                            <SelectLabel>前日</SelectLabel>
                            {MEASUREMENT_OPTIONS
                              .filter(opt => opt.group === "前日" && opt.timeSlots.includes(formData.timeSlot))
                              .map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                          </SelectGroup>
                          
                          {/* 当日のグループ */}
                          <SelectGroup>
                            <SelectLabel>当日</SelectLabel>
                            {MEASUREMENT_OPTIONS
                              .filter(opt => opt.group === "当日" && opt.timeSlots.includes(formData.timeSlot))
                              .map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* ステップ2: 条件設定 */}
                <div className="space-y-3 p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-orange-600 text-white flex items-center justify-center text-xs font-bold">2</div>
                    <h3 className="font-semibold text-sm">調整を行う血糖値の条件を設定</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="threshold" className="text-xs">閾値となる血糖値（mg/dL）</Label>
                      <Input
                        id="threshold"
                        type="number"
                        value={formData.threshold}
                        onChange={(e) => setFormData({ ...formData, threshold: parseInt(e.target.value) || 0 })}
                        min="0"
                        max="600"
                        className="bg-white dark:bg-background"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="comparison" className="text-xs">条件</Label>
                      <Select
                        value={formData.comparison}
                        onValueChange={(value) => setFormData({ ...formData, comparison: value as RuleFormData["comparison"] })}
                      >
                        <SelectTrigger id="comparison" className="bg-white dark:bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={5} className="z-[9999] bg-white dark:bg-gray-950 border shadow-lg">
                          <SelectItem value="以下">以下（≤）</SelectItem>
                          <SelectItem value="未満">未満（＜）</SelectItem>
                          <SelectItem value="以上">以上（≥）</SelectItem>
                          <SelectItem value="超える">超える（＞）</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="text-xs text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30 p-2 rounded">
                    <strong>例：</strong> 低血糖なら70以下、高血糖なら180以上
                  </div>
                </div>

                {/* ステップ3: 調整設定 */}
                <div className="space-y-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold">3</div>
                    <h3 className="font-semibold text-sm">インスリン投与量の調整内容を設定</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="targetTimeSlot" className="text-xs">調整する注射のタイミング</Label>
                      <Select
                        value={formData.targetTimeSlot}
                        onValueChange={(value) => setFormData({ ...formData, targetTimeSlot: value })}
                      >
                        <SelectTrigger id="targetTimeSlot" className="bg-white dark:bg-background">
                          <SelectValue placeholder="選択してください" />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={5} className="z-[9999] bg-white dark:bg-gray-950 border shadow-lg">
                          {/* 前日のグループ */}
                          <SelectGroup>
                            <SelectLabel>前日</SelectLabel>
                            {TARGET_OPTIONS
                              .filter(opt => opt.group === "前日")
                              .map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                          </SelectGroup>
                          
                          {/* 当日のグループ */}
                          <SelectGroup>
                            <SelectLabel>当日</SelectLabel>
                            {TARGET_OPTIONS
                              .filter(opt => opt.group === "当日")
                              .map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="adjustmentAmount" className="text-xs">調整量（正の値=増量、負の値=減量）</Label>
                      <Input
                        id="adjustmentAmount"
                        type="number"
                        value={formData.adjustmentAmount}
                        onChange={(e) => setFormData({ ...formData, adjustmentAmount: parseInt(e.target.value) || 0 })}
                        min="-20"
                        max="20"
                        className="bg-white dark:bg-background"
                        required
                      />
                    </div>
                  </div>

                  {/* 使用するインスリン（必須） */}
                  <div className="space-y-2">
                    <Label htmlFor="presetId" className="text-xs">使用するインスリン</Label>
                    <Select
                      value={formData.presetId ?? ""}
                      onValueChange={(v) => setFormData({ ...formData, presetId: v })}
                    >
                      <SelectTrigger id="presetId" className="bg-white dark:bg-background">
                        <SelectValue placeholder="インスリンを選択してください" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={5} className="z-[9999] bg-white dark:bg-gray-950 border shadow-lg">
                        {presets.map((preset) => (
                          <SelectItem key={preset.id} value={preset.id}>
                            {preset.name}（{preset.category}）
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="text-xs text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 p-2 rounded">
                    <strong>例：</strong> 血糖値が高い → +1〜+2単位増量、低い → -1〜-2単位減量
                  </div>
                </div>

                {/* プレビュー */}
                <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <h4 className="font-semibold text-sm mb-2 text-purple-900 dark:text-purple-100">📋 ルールのプレビュー</h4>
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    <span className="font-semibold">{TIME_SLOT_DISPLAY[formData.timeSlot] || formData.timeSlot}</span>のインスリン投与量は、
                    <span className="font-semibold">{getConditionTypeLabel(formData.conditionType)}</span>が
                    <span className="font-semibold text-orange-600 dark:text-orange-400"> {formData.threshold}mg/dL{formData.comparison}</span>
                    なら、
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      {getTargetTimeSlotLabel(formData.targetTimeSlot)}の
                      {formData.presetId ? presets.find(p => p.id === formData.presetId)?.name ?? "インスリン" : "インスリン"}
                    </span>を
                    <span className={`font-bold ${formData.adjustmentAmount > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formData.adjustmentAmount > 0 ? '+' : ''}{formData.adjustmentAmount}単位
                    </span>
                    調整して投与する
                  </p>
                </div>

                {/* ルール名（オプション） */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs">ルール名（省略可）</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="自動生成されます"
                    className="bg-muted/30"
                  />
                  <p className="text-xs text-muted-foreground">
                    空欄の場合、自動的にルール名が生成されます
                  </p>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleCloseDialog(false)}
                  >
                    キャンセル
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={createMutation.isPending || updateMutation.isPending || !formData.presetId}
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? "保存中..."
                      : editingRule
                      ? "更新"
                      : "作成"}
                  </Button>
                </div>
              </form>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            {TIME_SLOTS.map((slot) => {
              const Icon = slot.icon;
              const count = groupedRules[slot.value]?.length || 0;
              return (
                <TabsTrigger key={slot.value} value={slot.value} className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${slot.color}`} />
                  <span>{slot.label}</span>
                  {count > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-primary/20 text-primary">
                      {count}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {TIME_SLOTS.map((slot) => {
            const timeSlotRules = groupedRules[slot.value] || [];
            const Icon = slot.icon;
            
            return (
              <TabsContent key={slot.value} value={slot.value} className="mt-0">
                {timeSlotRules.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Icon className={`w-12 h-12 mb-4 ${slot.color}`} />
                      <p className="text-muted-foreground text-center mb-4">
                        {slot.label}のルールがまだ登録されていません
                      </p>
                      <p className="text-sm text-muted-foreground text-center mb-6">
                        「新規ルール」ボタンから{slot.label}の調整ルールを作成してください
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {timeSlotRules.map((rule) => (
                      <Card key={rule.id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-lg">{rule.name}</CardTitle>
                              <CardDescription className="mt-1">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                  {rule.timeSlot}
                                </span>
                              </CardDescription>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(rule)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (confirm("このルールを削除しますか？")) {
                                    deleteMutation.mutate(rule.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-muted-foreground">条件:</span>
                              <span>
                                {getConditionTypeLabel(rule.conditionType)} {rule.threshold}mg/dL{rule.comparison}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-muted-foreground">調整:</span>
                              <span className={rule.adjustmentAmount > 0 ? "text-blue-600 font-semibold" : "text-red-600 font-semibold"}>
                                {getTargetTimeSlotLabel(rule.targetTimeSlot)}の
                                {rule.presetId ? (presets.find(p => p.id === rule.presetId)?.name ?? "インスリン") : "インスリン"}
                                {" "}{formatAdjustmentAmount(rule.adjustmentAmount)}単位
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </AppLayout>
  );
}
