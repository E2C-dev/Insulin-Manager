import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Fingerprint, ScanFace } from "lucide-react";
import { useAppLockSettings } from "@/components/AppLockGate";
import { useToast } from "@/hooks/use-toast";
import type { BiometryKind } from "@/features/native/contract";

/**
 * AppLockSettings —— 生体認証によるアプリロックの ON/OFF (iOS ビルドのみ)
 *
 * App Store Review Guideline 4.2 対策として載せるネイティブ機能の 1 つ。
 * 併せて、要配慮個人情報 (血糖値・インスリン投与量・病名) を端末上で
 * 保護する実利がある。プライバシーポリシー第6条の「技術的安全管理措置」と
 * 整合する機能なので、条文を変えるときはここも見直すこと。
 *
 * Web ビルドでは isSupported が false になり null を返す。
 */

/** 端末が持つ生体認証の種類に応じて文言を変える。 */
function describeKind(kind: BiometryKind): { label: string; icon: typeof ScanFace } {
  switch (kind) {
    case "faceId":
      return { label: "Face ID", icon: ScanFace };
    case "touchId":
      return { label: "Touch ID", icon: Fingerprint };
    default:
      return { label: "生体認証", icon: Fingerprint };
  }
}

export function AppLockSettings() {
  const lock = useAppLockSettings();
  const { toast } = useToast();

  if (!lock.isSupported) return null;

  const kind = describeKind(lock.availability?.kind ?? "none");
  const Icon = kind.icon;
  const canToggle = lock.availability?.isAvailable === true && !lock.isAuthenticating;

  const handleToggle = async (next: boolean) => {
    const result = await lock.setEnabled(next);

    if (result.ok) {
      toast({
        title: next ? `✅ ${kind.label}でのロックを有効にしました` : "アプリロックを無効にしました",
      });
      return;
    }

    // 利用者自身のキャンセルは失敗扱いにしない (トーストを出さない)
    if (result.canceled) return;

    toast({
      title: result.message ?? "設定を変更できませんでした",
      variant: "destructive",
    });
  };

  return (
    <Card data-testid="app-lock-settings">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="w-4 h-4" />
          アプリロック
        </CardTitle>
        <CardDescription>
          アプリを開くときに{kind.label}での本人確認を求めます。端末を他の人が触ったときに、記録が見られるのを防げます。
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {lock.availability && !lock.availability.isAvailable && lock.availability.reason && (
          <Alert variant="destructive">
            <AlertDescription>{lock.availability.reason}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{kind.label}でロックする</p>
            <p className="text-xs text-muted-foreground">
              {kind.label}が使えないときは、端末のパスコードでも解除できます。
            </p>
          </div>
          <Switch
            checked={lock.isEnabled}
            onCheckedChange={(next) => void handleToggle(next)}
            disabled={!canToggle}
            aria-label="アプリロック"
            data-testid="app-lock-toggle"
          />
        </div>
      </CardContent>
    </Card>
  );
}
