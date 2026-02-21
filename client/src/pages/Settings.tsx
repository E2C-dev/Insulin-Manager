import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  User, Settings as SettingsIcon, LogOut, ChevronRight,
  FileSpreadsheet, AlertCircle, Upload, FileDown, Save,
  Activity, Plus, Syringe,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useInsulinPresets } from "@/hooks/use-insulin-presets";
import { InsulinPresetForm } from "@/components/settings/InsulinPresetForm";
import { InsulinPresetCard } from "@/components/settings/InsulinPresetCard";
import { Link } from "wouter";
import { exportLogbookToPDF } from "@/lib/pdfExport";
import { format, subDays } from "date-fns";
import { type ApiGlucoseEntry, type ApiInsulinEntry, type DailyEntry } from "@/lib/types";

// 病名の選択肢
const DISEASE_OPTIONS = [
  { value: "type1", label: "1型糖尿病" },
  { value: "type2", label: "2型糖尿病" },
  { value: "gestational", label: "妊娠糖尿病" },
  { value: "other", label: "その他の糖尿病" },
] as const;

export default function Settings() {
  const { user, logout, isLoggingOut } = useAuth();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isSavingCondition, setIsSavingCondition] = useState(false);
  const [isAddingPreset, setIsAddingPreset] = useState(false);

  // 症状設定のstate
  const [diseaseType, setDiseaseType] = useState("type1");
  const [diagnosisYear, setDiagnosisYear] = useState(new Date().getFullYear().toString());

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
      toast({ title: "✅ 保存成功", description: "症状情報を保存しました" });
    } catch {
      toast({ title: "保存失敗", description: "症状情報の保存に失敗しました", variant: "destructive" });
    } finally {
      setIsSavingCondition(false);
    }
  };

  // 症状表示用のラベルを取得
  const getDiseaseLabel = () => {
    const disease = DISEASE_OPTIONS.find(opt => opt.value === diseaseType);
    return disease ? disease.label : "未設定";
  };

  // インスリンプリセット追加
  const handleCreatePreset = async (data: Parameters<typeof createPreset>[0]) => {
    try {
      await createPreset(data);
      setIsAddingPreset(false);
      toast({ title: "✅ 追加成功", description: "インスリンを追加しました" });
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
      toast({ title: "✅ 更新成功", description: "インスリン設定を更新しました" });
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
      toast({ title: "✅ 削除成功", description: "インスリンを削除しました" });
    } catch (error) {
      toast({
        title: "削除失敗",
        description: error instanceof Error ? error.message : "削除に失敗しました",
        variant: "destructive",
      });
    }
  };

  // Excel取り込み（構築中）
  const handleExcelImport = () => {
    toast({
      title: "機能構築中",
      description: "Excelフォーマット取り込み機能は現在開発中です。しばらくお待ちください。",
    });
  };

  // PDF出力
  const handlePDFExport = async () => {
    setIsExporting(true);
    try {
      const [glucoseResponse, insulinResponse] = await Promise.all([
        fetch("/api/glucose-entries", { credentials: "include" }),
        fetch("/api/insulin-entries", { credentials: "include" }),
      ]);

      if (!glucoseResponse.ok || !insulinResponse.ok) {
        throw new Error("データの取得に失敗しました");
      }

      const glucoseData = await glucoseResponse.json();
      const insulinData = await insulinResponse.json();

      const glucoseEntries: ApiGlucoseEntry[] = glucoseData.entries;
      const insulinEntries: ApiInsulinEntry[] = insulinData.entries;

      const entriesMap = new Map<string, DailyEntry>();
      const days = 30;

      for (let i = 0; i < days; i++) {
        const date = format(subDays(new Date(), i), "yyyy-MM-dd");
        entriesMap.set(date, { date, morning: {}, lunch: {}, dinner: {}, bedtime: {} });
      }

      for (const entry of glucoseEntries) {
        const dailyEntry = entriesMap.get(entry.date);
        if (dailyEntry) {
          switch (entry.timeSlot) {
            case "BreakfastBefore": dailyEntry.morning.glucoseBefore = entry.glucoseLevel; break;
            case "BreakfastAfter1h": dailyEntry.morning.glucoseAfter = entry.glucoseLevel; break;
            case "LunchBefore": dailyEntry.lunch.glucoseBefore = entry.glucoseLevel; break;
            case "LunchAfter1h": dailyEntry.lunch.glucoseAfter = entry.glucoseLevel; break;
            case "DinnerBefore": dailyEntry.dinner.glucoseBefore = entry.glucoseLevel; break;
            case "DinnerAfter1h": dailyEntry.dinner.glucoseAfter = entry.glucoseLevel; break;
            case "BeforeSleep": dailyEntry.bedtime.glucose = entry.glucoseLevel; break;
          }
        }
      }

      for (const entry of insulinEntries) {
        const dailyEntry = entriesMap.get(entry.date);
        if (dailyEntry) {
          const units = parseFloat(entry.units);
          switch (entry.timeSlot) {
            case "Breakfast": dailyEntry.morning.insulin = units; break;
            case "Lunch": dailyEntry.lunch.insulin = units; break;
            case "Dinner": dailyEntry.dinner.insulin = units; break;
            case "Bedtime": dailyEntry.bedtime.insulin = units; break;
          }
        }
      }

      const entries = Array.from(entriesMap.values())
        .filter(entry =>
          entry.morning.glucoseBefore || entry.morning.glucoseAfter || entry.morning.insulin ||
          entry.lunch.glucoseBefore || entry.lunch.glucoseAfter || entry.lunch.insulin ||
          entry.dinner.glucoseBefore || entry.dinner.glucoseAfter || entry.dinner.insulin ||
          entry.bedtime.glucose || entry.bedtime.insulin
        )
        .sort((a, b) => b.date.localeCompare(a.date));

      if (entries.length === 0) {
        toast({ title: "データがありません", description: "出力するデータがありません。", variant: "destructive" });
        return;
      }

      await exportLogbookToPDF(entries, user?.username || "ユーザー");
      toast({ title: "✅ PDF出力完了", description: `${entries.length}日分の記録をPDFで出力しました` });
    } catch (error) {
      toast({
        title: "出力失敗",
        description: error instanceof Error ? error.message : "PDFの出力に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AppLayout>
      <div className="pt-12 px-6 pb-6 space-y-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">設定</h1>
          <p className="text-muted-foreground text-sm">治療プロファイルの管理</p>
        </div>

        {/* Account */}
        <Card className="border-none shadow-sm bg-primary/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <User className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">{user?.username || "ユーザー"}</h3>
              <p className="text-sm text-muted-foreground">{getDiseaseLabel()} • {diagnosisYear}年から</p>
            </div>
            <Button variant="ghost" size="icon">
              <SettingsIcon className="w-5 h-5 text-muted-foreground" />
            </Button>
          </CardContent>
        </Card>

        {/* Medical Condition Settings */}
        <div className="space-y-4">
          <h3 className="font-bold text-lg">症状設定</h3>
          <Card>
            <CardHeader className="p-4 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  <div>
                    <CardTitle className="text-base">診断情報</CardTitle>
                    <CardDescription className="text-xs">ご自身の症状と発症年を登録してください</CardDescription>
                  </div>
                </div>
                <Button onClick={handleSaveCondition} disabled={isSavingCondition} size="sm">
                  <Save className="w-4 h-4 mr-2" />
                  {isSavingCondition ? "保存中..." : "保存"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="diseaseType" className="text-sm">病名</Label>
                  <Select value={diseaseType} onValueChange={setDiseaseType}>
                    <SelectTrigger id="diseaseType" className="h-9">
                      <SelectValue placeholder="病名を選択" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-950">
                      {DISEASE_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="diagnosisYear" className="text-sm">発症年</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="diagnosisYear"
                      type="number"
                      value={diagnosisYear}
                      onChange={(e) => setDiagnosisYear(e.target.value)}
                      className="h-9 text-sm"
                      min="1900"
                      max={new Date().getFullYear()}
                      placeholder="2018"
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">年</span>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg border">
                <p className="text-xs text-muted-foreground mb-1">プレビュー</p>
                <p className="text-sm font-medium">{getDiseaseLabel()} • {diagnosisYear}年から</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Therapy Settings - Insulin Presets */}
        <div className="space-y-4">
          <h3 className="font-bold text-lg">治療設定</h3>

          <Card>
            <CardHeader className="p-4 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Syringe className="w-5 h-5 text-primary" />
                  <div>
                    <CardTitle className="text-base">インスリン設定</CardTitle>
                    <CardDescription className="text-xs">
                      使用しているインスリン製品を登録してください。記録入力時に選択できます
                    </CardDescription>
                  </div>
                </div>
                {!isAddingPreset && (
                  <Button
                    onClick={() => setIsAddingPreset(true)}
                    size="sm"
                    variant="outline"
                    className="ml-2"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    追加
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              {/* 追加フォーム */}
              {isAddingPreset && (
                <InsulinPresetForm
                  onSubmit={handleCreatePreset}
                  onCancel={() => setIsAddingPreset(false)}
                  isSubmitting={isCreating}
                />
              )}

              {/* プリセット一覧 */}
              {presetsLoading ? (
                <div className="text-center py-4 text-sm text-muted-foreground">読み込み中...</div>
              ) : presets.length === 0 && !isAddingPreset ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Syringe className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm">まだインスリンが登録されていません</p>
                  <p className="text-xs mt-1">「追加」ボタンから登録してください</p>
                </div>
              ) : (
                <div className="space-y-2">
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
              )}
            </CardContent>
          </Card>
        </div>

        {/* App Settings */}
        <div className="space-y-2">
          <Link href="/adjustment-rules" className="flex items-center justify-between p-3 rounded-lg bg-card border hover:bg-muted/50 transition-colors cursor-pointer">
            <span className="text-sm font-medium">調整ルール管理</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
          <div className="flex items-center justify-between p-3 rounded-lg bg-card border hover:bg-muted/50 transition-colors cursor-pointer">
            <span className="text-sm font-medium">通知設定</span>
            <Switch defaultChecked />
          </div>
          <button
            onClick={handlePDFExport}
            disabled={isExporting}
            className="flex items-center justify-between p-3 rounded-lg bg-card border hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed w-full"
          >
            <span className="text-sm font-medium flex items-center gap-2">
              <FileDown className="w-4 h-4" />
              データ出力 (PDF)
            </span>
            <span className="text-xs text-muted-foreground">
              {isExporting ? "出力中..." : "記録ノートをPDF出力"}
            </span>
          </button>
        </div>

        {/* Excel Import Feature */}
        <Card className="overflow-hidden border-dashed border-2 shadow-md">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-4 text-white">
            <div className="flex items-center gap-2 mb-1">
              <FileSpreadsheet className="w-5 h-5" />
              <h3 className="font-bold">Excelフォーマット取込</h3>
            </div>
            <p className="text-xs opacity-80">既存データを簡単にインポート</p>
          </div>
          <CardContent className="p-4">
            <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mb-4">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-1">現在構築中です</p>
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                  Excelフォーマットのテンプレートとインポート機能を準備中です。
                </p>
              </div>
            </div>
            <div className="text-center py-2 space-y-3">
              <p className="text-sm text-muted-foreground">
                専用のExcelテンプレートを使用して、日付・血糖値・インスリン量を一括でインポートできます。
              </p>
              <Button
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 border-0"
                onClick={handleExcelImport}
              >
                <Upload className="w-4 h-4 mr-2" /> Excelファイルを取り込む
              </Button>
              <p className="text-xs text-muted-foreground">対応形式: .xlsx, .xls</p>
            </div>
          </CardContent>
        </Card>

        {/* Logout */}
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
    </AppLayout>
  );
}
