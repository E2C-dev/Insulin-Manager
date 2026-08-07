import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LogOut,
  Save, Activity, Plus, Syringe,
  AlertTriangle, Download, UserX,
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
import { Link, useLocation } from "wouter";
import { QUERY_KEYS } from "@/lib/query-keys";
import { safeGetLocalStorage, safeSetLocalStorageString } from "@/lib/storage-utils";
import {
  INSULIN_CATALOG,
  type InsulinCategory,
  type InsulinBrandOption,
  type InsulinPreset,
} from "@/lib/types";
import {
  getUserGlucoseRange,
  saveUserGlucoseRange,
  DEFAULT_GLUCOSE_RANGE,
  GLUCOSE_DANGER_LOW,
  GLUCOSE_DANGER_HIGH,
} from "@/lib/glucoseStatus";

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
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isSavingCondition, setIsSavingCondition] = useState(false);

  // 退会 (アカウント削除) — 利用規約 v2.0 第6条2項により即時・復旧不可
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  // 症状設定のstate
  const [diseaseType, setDiseaseType] = useState("type1");
  const [diagnosisYear, setDiagnosisYear] = useState(new Date().getFullYear().toString());

  // 血糖値の目標範囲 (作業5-1: glucoseStatus.ts に統合した色分けロジックに反映される)
  const [targetGlucoseLow, setTargetGlucoseLow] = useState(String(DEFAULT_GLUCOSE_RANGE.low));
  const [targetGlucoseHigh, setTargetGlucoseHigh] = useState(String(DEFAULT_GLUCOSE_RANGE.high));

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
    const savedDisease = safeGetLocalStorage("diseaseType");
    const savedYear = safeGetLocalStorage("diagnosisYear");
    if (savedDisease) setDiseaseType(savedDisease);
    if (savedYear) setDiagnosisYear(savedYear);

    const savedRange = getUserGlucoseRange();
    setTargetGlucoseLow(String(savedRange.low));
    setTargetGlucoseHigh(String(savedRange.high));
  }, []);

  // 症状設定の保存
  const handleSaveCondition = () => {
    setIsSavingCondition(true);
    try {
      safeSetLocalStorageString("diseaseType", diseaseType);
      safeSetLocalStorageString("diagnosisYear", diagnosisYear);

      const low = parseInt(targetGlucoseLow, 10);
      const high = parseInt(targetGlucoseHigh, 10);
      if (!Number.isNaN(low) && !Number.isNaN(high) && low < high) {
        saveUserGlucoseRange({ low, high });
      } else {
        toast({
          title: "目標範囲を確認してください",
          description: "下限は上限より小さい数値で入力してください（症状情報自体は保存しました）",
          variant: "destructive",
        });
      }

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

  // 退会 (アカウント削除)
  const deleteAccountMutation = useMutation({
    mutationFn: async (password: string) => {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "退会に失敗しました");
      }
      return res.json();
    },
    onSuccess: () => {
      setDeleteOpen(false);
      setDeletePassword("");
      // サーバー側でセッションを破棄済み。クライアントのキャッシュも全消しして
      // 削除済みユーザーのデータが画面に残らないようにする。
      queryClient.setQueryData(QUERY_KEYS.USER_PROFILE, null);
      queryClient.clear();
      toast({
        title: "退会が完了しました",
        description: "アカウントと記録データを削除しました",
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "退会に失敗しました",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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

            {/* 血糖値の目標範囲 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">血糖値の目標範囲 (mg/dL)</Label>
              <p className="text-xs text-muted-foreground">
                記録一覧・ホーム画面の色分け表示に使われます（70未満/180超は常に危険域として赤・オレンジ表示されます）
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={targetGlucoseLow}
                  onChange={(e) => setTargetGlucoseLow(e.target.value)}
                  className="h-9 text-sm max-w-[100px]"
                  min={GLUCOSE_DANGER_LOW}
                  max={GLUCOSE_DANGER_HIGH}
                  aria-label="目標範囲の下限"
                />
                <span className="text-sm text-muted-foreground">〜</span>
                <Input
                  type="number"
                  value={targetGlucoseHigh}
                  onChange={(e) => setTargetGlucoseHigh(e.target.value)}
                  className="h-9 text-sm max-w-[100px]"
                  min={GLUCOSE_DANGER_LOW}
                  max={GLUCOSE_DANGER_HIGH}
                  aria-label="目標範囲の上限"
                />
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

        {/* ===== Section 3: 退会（アカウントの削除） =====
            利用規約 v2.0 第6条2項により、退会＝即時削除・復旧不可。
            誤タップを避けるため、独立したカードに分け、上のログアウト（塗りつぶしの赤）
            とは見た目を変えた枠線ボタンにし、実行前に必ずパスワードを求める。 */}
        <Card className="mt-6 border-destructive/40">
          <CardHeader className="p-4 pb-3">
            <div className="flex items-center gap-2">
              <UserX className="w-5 h-5 text-destructive" />
              <div>
                <CardTitle className="text-base text-destructive">退会（アカウントの削除）</CardTitle>
                <CardDescription className="text-xs">
                  アカウントと記録データを完全に削除します
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs space-y-1.5">
              <p className="font-semibold text-destructive">
                記録はすべて削除され、元に戻すことはできません。
              </p>
              <p className="text-muted-foreground">
                利用規約 第6条2項のとおり、退会の申込みによりアカウントおよび記録データは直ちに削除され、以後、復旧することはできません。
              </p>
              <p className="text-muted-foreground">
                先に PDF / Excel で記録を出力しておくことをおすすめします。
              </p>
            </div>

            <Link href="/logbook" data-testid="link-export-before-delete">
              <Button variant="outline" size="sm" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                記録の出力画面へ（PDF / Excel）
              </Button>
            </Link>

            <Button
              variant="outline"
              className="w-full border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                setDeletePassword("");
                setDeleteOpen(true);
              }}
              data-testid="button-open-delete-account"
            >
              <UserX className="w-4 h-4 mr-2" />
              退会する
            </Button>
          </CardContent>
        </Card>

        {/* 退会の確認ダイアログ */}
        <Dialog
          open={deleteOpen}
          onOpenChange={(open) => {
            if (!deleteAccountMutation.isPending) setDeleteOpen(open);
          }}
        >
          <DialogContent
            className="max-w-md max-h-mobile-dialog overflow-y-auto"
            data-testid="dialog-delete-account"
          >
            <DialogHeader>
              <DialogTitle className="text-destructive">退会（アカウントの削除）</DialogTitle>
              <DialogDescription>
                本当に退会しますか。この操作は取り消せません。
              </DialogDescription>
            </DialogHeader>

            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm space-y-2">
                <p className="font-semibold" data-testid="text-delete-warning">
                  記録はすべて削除され、元に戻すことはできません。
                </p>
                <p>
                  血糖値・インスリンの投与記録・調整ルール・インスリン設定・同意履歴を含め、すべて削除されます。
                </p>
                <p>
                  先に PDF / Excel で記録を出力しておくことをおすすめします。
                </p>
              </AlertDescription>
            </Alert>

            <Link href="/logbook" data-testid="link-export-in-delete-dialog">
              <Button variant="outline" size="sm" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                記録の出力画面を開く（PDF / Excel）
              </Button>
            </Link>

            <div className="space-y-1.5">
              <Label htmlFor="delete-password">確認のため、パスワードを入力してください</Label>
              <Input
                id="delete-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="パスワードを入力"
                autoComplete="current-password"
                disabled={deleteAccountMutation.isPending}
                data-testid="input-delete-password"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setDeleteOpen(false)}
                disabled={deleteAccountMutation.isPending}
                data-testid="button-cancel-delete-account"
              >
                キャンセル
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteAccountMutation.mutate(deletePassword)}
                disabled={deleteAccountMutation.isPending || !deletePassword}
                data-testid="button-confirm-delete-account"
              >
                <UserX className="w-4 h-4 mr-2" />
                {deleteAccountMutation.isPending ? "削除中..." : "完全に削除する"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
}
