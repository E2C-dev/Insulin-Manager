import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2, Trash2, Activity } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

interface AdjustmentRule {
  id: string;
  name: string;
  timeSlot: string;
  conditionType: string;
  threshold: number;
  comparison: string;
  adjustmentAmount: number;
  targetTimeSlot: string;
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
}

const initialFormData: RuleFormData = {
  name: "",
  timeSlot: "朝",
  conditionType: "",
  threshold: 70,
  comparison: "以下",
  adjustmentAmount: -1,
  targetTimeSlot: "",
};

export default function AdjustmentRules() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AdjustmentRule | null>(null);
  const [formData, setFormData] = useState<RuleFormData>(initialFormData);

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
    
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: formData });
    } else {
      createMutation.mutate(formData);
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
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRule(null);
    setFormData(initialFormData);
  };

  const formatAdjustmentAmount = (amount: number) => {
    return amount > 0 ? `+${amount}` : amount.toString();
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
              <Button size="lg" className="shadow-lg">
                <Plus className="w-5 h-5 mr-2" />
                新規ルール
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingRule ? "ルールを編集" : "新しいルールを作成"}
                </DialogTitle>
                <DialogDescription>
                  血糖値の条件とインスリン調整量を設定してください
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">ルール名 *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例: 夜間低血糖対応"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="timeSlot">時間帯 *</Label>
                    <Select
                      value={formData.timeSlot}
                      onValueChange={(value) => setFormData({ ...formData, timeSlot: value })}
                    >
                      <SelectTrigger id="timeSlot">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="朝">朝</SelectItem>
                        <SelectItem value="昼">昼</SelectItem>
                        <SelectItem value="夜">夜</SelectItem>
                        <SelectItem value="眠前">眠前</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="conditionType">条件タイプ *</Label>
                    <Input
                      id="conditionType"
                      value={formData.conditionType}
                      onChange={(e) => setFormData({ ...formData, conditionType: e.target.value })}
                      placeholder="例: 夜間低血糖"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="threshold">閾値 (mg/dL) *</Label>
                    <Input
                      id="threshold"
                      type="number"
                      value={formData.threshold}
                      onChange={(e) => setFormData({ ...formData, threshold: parseInt(e.target.value) })}
                      min="0"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="comparison">比較 *</Label>
                    <Select
                      value={formData.comparison}
                      onValueChange={(value) => setFormData({ ...formData, comparison: value as RuleFormData["comparison"] })}
                    >
                      <SelectTrigger id="comparison">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="以下">以下</SelectItem>
                        <SelectItem value="以上">以上</SelectItem>
                        <SelectItem value="未満">未満</SelectItem>
                        <SelectItem value="超える">超える</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="adjustmentAmount">調整量 (単位) *</Label>
                    <Input
                      id="adjustmentAmount"
                      type="number"
                      value={formData.adjustmentAmount}
                      onChange={(e) => setFormData({ ...formData, adjustmentAmount: parseInt(e.target.value) })}
                      min="-20"
                      max="20"
                      required
                    />
                    <p className="text-xs text-muted-foreground">-20〜+20の範囲で入力</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="targetTimeSlot">調整対象 *</Label>
                    <Input
                      id="targetTimeSlot"
                      value={formData.targetTimeSlot}
                      onChange={(e) => setFormData({ ...formData, targetTimeSlot: e.target.value })}
                      placeholder="例: 眠前"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={handleCloseDialog}
                  >
                    キャンセル
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? "保存中..."
                      : editingRule
                      ? "更新"
                      : "作成"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {rules.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Activity className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center mb-4">
                まだルールが登録されていません
              </p>
              <p className="text-sm text-muted-foreground text-center mb-6">
                「新規ルール」ボタンから調整ルールを作成してください
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {rules.map((rule) => (
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
                        {rule.conditionType} {rule.threshold}mg/dL{rule.comparison}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-muted-foreground">調整:</span>
                      <span className={rule.adjustmentAmount > 0 ? "text-blue-600 font-semibold" : "text-red-600 font-semibold"}>
                        {rule.targetTimeSlot} {formatAdjustmentAmount(rule.adjustmentAmount)}単位
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
