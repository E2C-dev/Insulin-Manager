import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  LogOut, ChevronRight,
  Save, Activity, Plus, Syringe,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useInsulinPresets } from "@/hooks/use-insulin-presets";
import {
  InsulinPresetForm,
  DISPLAY_GROUPS,
  DISEASE_SUGGESTED_CATEGORIES,
} from "@/components/settings/InsulinPresetForm";
import { InsulinPresetCard } from "@/components/settings/InsulinPresetCard";
import { Link } from "wouter";
import {
  INSULIN_CATALOG,
  type InsulinCategory,
  type InsulinBrandOption,
  type InsulinPreset,
} from "@/lib/types";

// 病名の選択肢
const DISEASE_OPTIONS = [
  { value: "type1", label: "1型糖尿病" },
  { value: "type2", label: "2型糖尿病" },
  { value: "gestational", label: "妊娠糖尿病" },
  { value: "other", label: "その他の糖尿病" },
] as const;

// 病名別のインスリン説明文
const DISEASE_INSULIN_SUGGESTIONS: Record<string, { note: string }> = {
  type1: {
    note: "1型糖尿病では食事時の超速効型と基礎インスリン（持効型）の組み合わせ（バーサル-ボーラス療法）が一般的です",
  },
  type2: {
    note: "2型糖尿病では持効型から開始することが多く、必要に応じて食事時のインスリンを追加します",
  },
  gestational: {
    note: "妊娠糖尿病では安全性の高い超速効型（Humalog/NovoLog）と持効型が主に使用されます",
  },
  other: {
    note: "担当医の指示に従ってインスリンを選択してください",
  },
};

export default function Settings() {
  const { user, logout, isLoggingOut } = useAuth();
  const { toast } = useToast();
  const [isSavingCondition, setIsSavingCondition] = useState(false);

  // 症状設定のstate
  const [diseaseType, setDiseaseType] = useState("type1");
  const [diagnosisYear, setDiagnosisYear] = useState(new Date().getFullYear().toString());

  // インスリン追加用state
  const [selectedBrandForAdd, setSelectedBrandForAdd] = useState<{
    category: InsulinCategory;
    option: InsulinBrandOption;
  } | null>(null);
  const [editingPreset, setEditingPreset] = useState<InsulinPreset | null>(null);

  // インスリンプリセット
  const {
    presets,
    isLoading: presetsLoading,
    createPreset,
    updatePreset,
    deletePreset,
    isCreating,
    isUpdating,
    isDeleting,
  } = useInsulinPresets();

  // ページロード時にローカルストレージから症状設定を読み込む
  useEffect(() => {
    const savedDisease = localStorage.getItem("diseaseType");
    const savedYear = localStorage.getItem("diagnosisYear");
    if (savedDisease) setDiseaseType(savedDisease);
    if (savedYear) setDiagnosisYear(savedYear);
  }, []);

  // 症状設定の保存
  const handleSaveCondition = () => {
    setIsSavingCondition(true);
    try {
      localStorage.setItem("diseaseType", diseaseType);
      localStorage.setItem("diagnosisYear", diagnosisYear);
      toast({ title: "保存成功", description: "症状情報を保存しました" });
    } catch {
      toast({ title: "保存失敗", description: "症状情報の保存に失敗しました", variant: "destructive" });
    } finally {
      setIsSavingCondition(false);
    }
  };

  // インスリン候補の説明文
  const insulinNote = DISEASE_INSULIN_SUGGESTIONS[diseaseType]?.note ?? DISEASE_INSULIN_SUGGESTIONS.other.note;

  // 選択中の病名に対するおすすめカテゴリ
  const suggestedCategories = DISEASE_SUGGESTED_CATEGORIES[diseaseType] ?? [];

  // インスリンプリセット追加
  const handleCreatePreset = async (data: Parameters<typeof createPreset>[0]) => {
    try {
      await createPreset(data);
      setSelectedBrandForAdd(null);
      toast({ title: "追加成功", description: "インスリンを追加しました" });
    } catch (error) {
      toast({
        title: "追加失敗",
        description: error instanceof Error ? error.message : "追加に失敗しました",
        variant: "destructive",
      });
    }
  };

  // インスリンプリセット更新
  const handleUpdatePreset = async (data: Parameters<typeof updatePreset>[0]) => {
    try {
      await updatePreset(data);
      setEditingPreset(null);
      toast({ title: "更新成功", description: "インスリン設定を更新しました" });
    } catch (error) {
      toast({
        title: "更新失敗",
        description: error instanceof Error ? error.message : "更新に失敗しました",
        variant: "destructive",
      });
    }
  };

  // インスリンプリセット削除
  const handleDeletePreset = async (id: string) => {
    try {
      await deletePreset(id);
      toast({ title: "削除成功", description: "インスリンを削除しました" });
    } catch (error) {
      toast({
        title: "削除失敗",
        description: error instanceof Error ? error.message : "削除に失敗しました",
        variant: "destructive",
      });
    }
  };

  return (
    <AppLayout>
      <div className="pt-4 px-4 pb-6 space-y-4">

        {/* ===== Section 1: 治療・症状設定 ===== */}
        <Card>
          <CardHeader className="p-4 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <div>
                <CardTitle className="text-base">治療・症状設定</CardTitle>
                <CardDescription className="text-xs">病名とインスリンをまとめて設定します</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-5">

            {/* 病名選択 2x2 グリッド */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">病名選択</Label>
              <div className="grid grid-cols-2 gap-2">
                {DISEASE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDiseaseType(option.value)}
                    className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors text-left ${
                      diseaseType === option.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border hover:bg-muted/50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 発症年 */}
            <div className="space-y-2">
              <Label htmlFor="diagnosisYear" className="text-sm font-medium">発症年</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="diagnosisYear"
                  type="number"
                  value={diagnosisYear}
                  onChange={(e) => setDiagnosisYear(e.target.value)}
                  className="h-9 text-sm max-w-[140px]"
                  min="1900"
                  max={new Date().getFullYear()}
                  placeholder="2018"
                />
                <span className="text-sm text-muted-foreground">年</span>
              </div>
            </div>

            {/* 保存ボタン */}
            <Button onClick={handleSaveCondition} disabled={isSavingCondition} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              {isSavingCondition ? "保存中..." : "保存する"}
            </Button>

            {/* インスリンを選択 */}
            <div className="pt-2 border-t space-y-3">
              <div className="flex items-center gap-2">
                <Syringe className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold text-primary">インスリンを選択</p>
              </div>
              <p className="text-xs text-muted-foreground">{insulinNote}</p>

              {/* ブランドカードグリッド - 未選択時のみ表示 */}
              {!selectedBrandForAdd && (
                <div id="insulin-brand-grid" className="space-y-4">
                  {DISPLAY_GROUPS.map((group) => {
                    const brandsInGroup = group.categories.flatMap((cat) =>
                      (INSULIN_CATALOG[cat] ?? []).map((opt) => ({
                        category: cat as InsulinCategory,
                        option: opt,
                        isSuggested: suggestedCategories.includes(cat as InsulinCategory),
                      }))
                    );
                    if (brandsInGroup.length === 0) return null;
                    const sorted = [...brandsInGroup].sort(
                      (a, b) => (b.isSuggested ? 1 : 0) - (a.isSuggested ? 1 : 0)
                    );
                    return (
                      <div key={group.label}>
                        <p className="text-xs font-medium text-muted-foreground mb-2 pb-1 border-b">
                          {group.label}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {sorted.map(({ category, option, isSuggested }) => (
                            <button
                              key={option.brand}
                              type="button"
                              onClick={() => {
                                setSelectedBrandForAdd({ category, option });
                              }}
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-colors text-left ${
                                isSuggested
                                  ? "border-primary/50 bg-primary/5 hover:border-primary hover:bg-primary/10"
                                  : "border-border bg-white dark:bg-gray-900 hover:border-primary hover:bg-primary/5"
                              }`}
                            >
                              <span className="text-base">{option.icon}</span>
                              <div className="flex flex-col items-start">
                                <span className="text-sm font-medium">{option.shortName}</span>
                                {isSuggested && (
                                  <span className="text-[10px] text-primary font-semibold leading-none mt-0.5">
                                    処方例
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ブランド選択後のインラインフォーム (ステップ2) */}
              {selectedBrandForAdd && (
                <div className="mt-3">
                  <InsulinPresetForm
                    initialValues={{
                      brand: selectedBrandForAdd.option.brand,
                      category: selectedBrandForAdd.category,
                    }}
                    onSubmit={handleCreatePreset}
                    onCancel={() => setSelectedBrandForAdd(null)}
                    onBack={() => setSelectedBrandForAdd(null)}
                    isSubmitting={isCreating}
                  />
                </div>
              )}

              {/* 登録済みインスリン */}
              {presetsLoading ? (
                <div className="text-center py-4 text-sm text-muted-foreground">読み込み中...</div>
              ) : presets.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground pt-1">登録済みインスリン</p>
                  {presets.map((preset) => (
                    <InsulinPresetCard
                      key={preset.id}
                      preset={preset}
                      onUpdate={handleUpdatePreset}
                      onDelete={handleDeletePreset}
                      isUpdating={isUpdating}
                      isDeleting={isDeleting}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <Syringe className="w-7 h-7 mx-auto mb-1.5 text-muted-foreground/40" />
                  <p className="text-sm">まだインスリンが登録されていません</p>
                  <p className="text-xs mt-0.5">上のカードから選んで追加してください</p>
                </div>
              )}

              {/* 別のインスリンを追加ボタン (フォーム非表示時のみ) */}
              {!selectedBrandForAdd && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed"
                  onClick={() => {
                    // ブランドグリッドまでスクロール
                    const el = document.getElementById("insulin-brand-grid");
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  別のインスリンを追加
                </Button>
              )}

              {/* 調整ルール管理リンク */}
              <Link
                href="/adjustment-rules"
                className="flex items-center justify-between p-3 rounded-lg bg-card border hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <span className="text-sm font-medium">調整ルール管理</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* ===== Section 2: アプリ設定 ===== */}
        <Card>
          <CardHeader className="p-4 pb-3">
            <CardTitle className="text-base">アプリ設定</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            {/* 通知設定 */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-card border hover:bg-muted/50 transition-colors">
              <span className="text-sm font-medium">通知設定</span>
              <Switch defaultChecked />
            </div>

            {/* ログアウト */}
            <div className="pt-2">
              <Button
                variant="destructive"
                className="w-full"
                size="lg"
                onClick={logout}
                disabled={isLoggingOut}
              >
                <LogOut className="w-4 h-4 mr-2" />
                {isLoggingOut ? "ログアウト中..." : "ログアウト"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ===== Section 3: AdSense広告スペース ===== */}
        <div className="mt-6 pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center mb-2">広告</p>
          <div className="w-full min-h-[100px] bg-muted/30 rounded-lg flex items-center justify-center border border-dashed border-muted-foreground/20">
            {/* AdSense: ca-pub-8606804226935323 */}
            <ins
              className="adsbygoogle"
              style={{ display: "block", width: "100%", minHeight: "100px" } as React.CSSProperties}
              data-ad-client="ca-pub-8606804226935323"
              data-ad-slot="auto"
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
