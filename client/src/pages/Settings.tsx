import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Camera, User, Settings as SettingsIcon, LogOut, ChevronRight, Clock, X, Check, RotateCcw, Image as ImageIcon } from "lucide-react";
import { DEFAULT_SETTINGS, TIME_SLOTS, TIME_SLOT_LABELS } from "@/lib/types";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";

export default function Settings() {
  const { user, logout, isLoggingOut } = useAuth();
  const [enabledSlots, setEnabledSlots] = useState(DEFAULT_SETTINGS.enabledTimeSlots);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleSlot = (slot: string) => {
    setEnabledSlots(prev => 
      prev.includes(slot as any) 
        ? prev.filter(s => s !== slot)
        : [...prev, slot as any]
    );
  };

  // カメラを起動
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // 背面カメラを優先
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
      setIsCameraOpen(true);
    } catch (error) {
      console.error('カメラの起動に失敗しました:', error);
      alert('カメラにアクセスできませんでした。ブラウザの設定を確認してください。');
    }
  };

  // カメラを停止
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // 写真を撮影
  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedImage(imageData);
        stopCamera();
      }
    }
  };

  // 撮り直し
  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  // 画像を確定して処理
  const confirmImage = async () => {
    setIsProcessing(true);
    
    // ここでOCR処理やAPIへの送信を行う
    // 今回はシミュレーション
    setTimeout(() => {
      setIsProcessing(false);
      setCapturedImage(null);
      setIsCameraOpen(false);
      alert('画像を取り込みました！\n（実際の実装では、ここでOCR処理を行い、データを自動入力します）');
    }, 2000);
  };

  // 画像ファイルを選択
  const selectImage = () => {
    fileInputRef.current?.click();
  };

  // ファイルが選択された時の処理
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // 画像ファイルかチェック
      if (!file.type.startsWith('image/')) {
        alert('画像ファイルを選択してください');
        return;
      }

      // ファイルサイズチェック（10MB以下）
      if (file.size > 10 * 1024 * 1024) {
        alert('ファイルサイズが大きすぎます（10MB以下）');
        return;
      }

      // ファイルを読み込み
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        setCapturedImage(imageData);
        setIsCameraOpen(true);
      };
      reader.readAsDataURL(file);
    }

    // input をリセット（同じファイルを再選択可能にする）
    event.target.value = '';
  };

  // ダイアログを閉じる
  const closeCamera = () => {
    stopCamera();
    setCapturedImage(null);
    setIsCameraOpen(false);
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

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
                紙の自己管理ノートを撮影または画像から取り込んで、履歴を自動的にデジタル化します。
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 border-0"
                  onClick={startCamera}
                >
                  <Camera className="w-4 h-4 mr-2" /> カメラ
                </Button>
                <Button 
                  variant="outline"
                  className="w-full border-blue-600 text-blue-600 hover:bg-blue-50"
                  onClick={selectImage}
                >
                  <ImageIcon className="w-4 h-4 mr-2" /> 画像選択
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                カメラで撮影、またはギャラリーから画像を選択できます
              </p>
            </div>
            {/* 隠しファイル入力 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
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
                  <CardTitle className="text-base">記録タイミング</CardTitle>
                  <CardDescription>測定・記録するタイミングを選択</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-2">
              {TIME_SLOTS.map(slot => (
                <div key={slot} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <Label htmlFor={slot} className="text-sm font-medium cursor-pointer flex-1">
                    {TIME_SLOT_LABELS[slot]}
                  </Label>
                  <Switch 
                    id={slot}
                    checked={enabledSlots.includes(slot)}
                    onCheckedChange={() => toggleSlot(slot)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base">基礎インスリン (単位)</CardTitle>
              <CardDescription>時間帯ごとの基準量</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-2">
              {TIME_SLOTS.filter(slot => enabledSlots.includes(slot)).map(slot => (
                <div key={slot} className="flex items-center justify-between">
                  <Label className="text-sm text-muted-foreground">
                    {TIME_SLOT_LABELS[slot]}
                  </Label>
                  <div className="flex items-center gap-2 w-20">
                    <Input 
                      type="number" 
                      defaultValue={DEFAULT_SETTINGS.basalRates[slot]} 
                      className="h-8 text-center" 
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

      {/* カメラダイアログ */}
      <Dialog open={isCameraOpen} onOpenChange={closeCamera}>
        <DialogContent className="max-w-lg p-0 gap-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5" />
              手書きノート取込
            </DialogTitle>
            <DialogDescription>
              {capturedImage ? '撮影した画像を確認してください' : 'ノートを撮影してください'}
            </DialogDescription>
          </DialogHeader>

          <div className="relative bg-black">
            {!capturedImage ? (
              // カメラビュー
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full aspect-[4/3] object-cover"
              />
            ) : (
              // 撮影画像プレビュー
              <img
                src={capturedImage}
                alt="撮影画像"
                className="w-full aspect-[4/3] object-cover"
              />
            )}

            {/* 閉じるボタン */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/70"
              onClick={closeCamera}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="p-4 space-y-3">
            {!capturedImage ? (
              // 撮影ボタン
              <Button
                size="lg"
                className="w-full"
                onClick={capturePhoto}
              >
                <Camera className="w-5 h-5 mr-2" />
                撮影する
              </Button>
            ) : (
              // 撮影後のアクション
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={retakePhoto}
                  disabled={isProcessing}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  撮り直す
                </Button>
                <Button
                  size="lg"
                  onClick={confirmImage}
                  disabled={isProcessing}
                >
                  <Check className="w-4 h-4 mr-2" />
                  {isProcessing ? '処理中...' : '確定'}
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground text-center">
              {!capturedImage 
                ? 'ノート全体が画面に収まるように撮影してください'
                : 'AIがデータを読み取り、自動で記録します'}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
