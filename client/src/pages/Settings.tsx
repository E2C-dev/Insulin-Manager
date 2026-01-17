import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { User, Settings as SettingsIcon, LogOut, ChevronRight, Clock, FileSpreadsheet, AlertCircle, Upload } from "lucide-react";
import { DEFAULT_SETTINGS, INSULIN_TIME_SLOTS, INSULIN_TIME_SLOT_LABELS } from "@/lib/types";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function Settings() {
  const { user, logout, isLoggingOut } = useAuth();
  const { toast } = useToast();

  // Excel取り込み（構築中）
  const handleExcelImport = () => {
    toast({
      title: "機能構築中",
      description: "Excelフォーマット取り込み機能は現在開発中です。しばらくお待ちください。",
      variant: "default",
    });
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
              <p className="text-sm text-muted-foreground">1型糖尿病 • 2018年から</p>
            </div>
            <Button variant="ghost" size="icon">
              <SettingsIcon className="w-5 h-5 text-muted-foreground" />
            </Button>
          </CardContent>
        </Card>

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
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                  現在構築中です
                </p>
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                  Excelフォーマットのテンプレートとインポート機能を準備中です。もうしばらくお待ちください。
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
              <p className="text-xs text-muted-foreground">
                対応形式: .xlsx, .xls
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Therapy Settings */}
        <div className="space-y-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            治療設定
          </h3>

          <Card>
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                <div>
                  <CardTitle className="text-base">基礎インスリン投与量</CardTitle>
                  <CardDescription>各食事と眠前の基準投与量</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-2">
              {INSULIN_TIME_SLOTS.map(slot => (
                <div key={slot} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <Label className="text-sm font-medium">
                    {INSULIN_TIME_SLOT_LABELS[slot]}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      defaultValue={DEFAULT_SETTINGS.basalInsulinDoses[slot]} 
                      className="h-8 text-center w-20" 
                    />
                    <span className="text-xs text-muted-foreground">単位</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base">補正ルール</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex justify-between items-center">
                <div className="space-y-0.5">
                  <Label className="text-sm">インスリン効果値 (ISF)</Label>
                  <p className="text-xs text-muted-foreground">1単位で下がる血糖値</p>
                </div>
                <div className="flex items-center gap-2 w-24">
                  <Input type="number" defaultValue={DEFAULT_SETTINGS.insulinSensitivityFactor} className="h-8 text-right" />
                  <span className="text-xs text-muted-foreground">mg/dL</span>
                </div>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <div className="space-y-0.5">
                  <Label className="text-sm">糖質比 (カーボ比)</Label>
                  <p className="text-xs text-muted-foreground">1単位でカバーする糖質量</p>
                </div>
                <div className="flex items-center gap-2 w-24">
                  <Input type="number" defaultValue={DEFAULT_SETTINGS.carbRatio} className="h-8 text-right" />
                  <span className="text-xs text-muted-foreground">g</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* App Settings */}
        <div className="space-y-2">
          <Link href="/adjustment-rules">
            <a className="flex items-center justify-between p-3 rounded-lg bg-card border hover:bg-muted/50 transition-colors cursor-pointer">
              <span className="text-sm font-medium">調整ルール管理</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </a>
          </Link>
          <div className="flex items-center justify-between p-3 rounded-lg bg-card border hover:bg-muted/50 transition-colors cursor-pointer">
            <span className="text-sm font-medium">通知設定</span>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-card border hover:bg-muted/50 transition-colors cursor-pointer">
            <span className="text-sm font-medium">データ出力 (PDF)</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <Button 
            variant="destructive" 
            className="w-full mt-6" 
            size="lg"
            onClick={logout}
            disabled={isLoggingOut}
          >
            <LogOut className="w-4 h-4 mr-2" /> 
            {isLoggingOut ? "ログアウト中..." : "ログアウト"}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
