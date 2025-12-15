import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Camera, User, Settings as SettingsIcon, LogOut, ChevronRight, UploadCloud } from "lucide-react";
import { DEFAULT_SETTINGS } from "@/lib/types";

export default function Settings() {
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
              <h3 className="font-bold text-lg">Alex Doe</h3>
              <p className="text-sm text-muted-foreground">1型糖尿病 • 2018年から</p>
            </div>
            <Button variant="ghost" size="icon">
              <SettingsIcon className="w-5 h-5 text-muted-foreground" />
            </Button>
          </CardContent>
        </Card>

        {/* AI Import Feature */}
        <Card className="overflow-hidden border-primary/20 shadow-md">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
            <div className="flex items-center gap-2 mb-1">
              <Camera className="w-5 h-5" />
              <h3 className="font-bold">手書きノート取込</h3>
            </div>
            <p className="text-xs opacity-80">AIでデータを自動デジタル化</p>
          </div>
          <CardContent className="p-4">
            <div className="text-center py-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                紙の自己管理ノートを撮影して、履歴を自動的に取り込みます。
              </p>
              <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 border-0">
                <Camera className="w-4 h-4 mr-2" /> カメラを起動
              </Button>
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
              <CardTitle className="text-base">基礎インスリン (単位)</CardTitle>
              <CardDescription>時間帯ごとの基準量</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 grid grid-cols-4 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">朝</Label>
                <Input type="number" defaultValue={DEFAULT_SETTINGS.basalRates.Morning} className="h-9 text-center" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">昼</Label>
                <Input type="number" defaultValue={DEFAULT_SETTINGS.basalRates.Noon} className="h-9 text-center" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">夕</Label>
                <Input type="number" defaultValue={DEFAULT_SETTINGS.basalRates.Evening} className="h-9 text-center" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">眠前</Label>
                <Input type="number" defaultValue={DEFAULT_SETTINGS.basalRates.Night} className="h-9 text-center" />
              </div>
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
          <div className="flex items-center justify-between p-3 rounded-lg bg-card border hover:bg-muted/50 transition-colors cursor-pointer">
            <span className="text-sm font-medium">通知設定</span>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-card border hover:bg-muted/50 transition-colors cursor-pointer">
            <span className="text-sm font-medium">データ出力 (PDF)</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <Button variant="destructive" className="w-full mt-6" size="lg">
            <LogOut className="w-4 h-4 mr-2" /> ログアウト
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
