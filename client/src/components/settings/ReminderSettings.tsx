import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bell, BellOff } from "lucide-react";
import {
  REMINDER_LABELS,
  formatReminderTime,
  useReminders,
} from "@/hooks/use-reminders";
import type { ReminderSetting } from "@/features/native/contract";

/**
 * ReminderSettings —— 記録リマインダーの設定 (iOS ビルドのみ描画される)
 *
 * App Store Review Guideline 4.2 対策として載せるネイティブ機能の 1 つ。
 * ただし「審査のために付けた機能」にしないこと。記録の継続率に直接効く
 * ので、既定 OFF・時刻は利用者が決める・過度に鳴らさない、を守る。
 *
 * Web ビルドでは useReminders().isSupported が false になり、
 * このコンポーネントは null を返す (押しても動かないスイッチを見せない)。
 */
export function ReminderSettings() {
  const { isSupported, settings, permission, isBusy, requestPermission, updateSlot } =
    useReminders();

  if (!isSupported) return null;

  const enabledCount = settings.filter((s) => s.enabled).length;

  return (
    <Card data-testid="reminder-settings">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="w-4 h-4" />
          記録リマインダー
        </CardTitle>
        <CardDescription>
          決めた時刻に通知でお知らせします。通知はこの端末の中だけで動き、サーバーには送信されません。
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {permission === "denied" && (
          <Alert variant="destructive">
            <BellOff className="w-4 h-4" />
            <AlertDescription>
              通知がオフになっています。iOSの「設定」→「インスリア」→「通知」から許可してください。
            </AlertDescription>
          </Alert>
        )}

        {permission === "prompt" && (
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-sm text-muted-foreground">
              リマインダーを使うには通知の許可が必要です。
            </p>
            <Button
              size="sm"
              onClick={() => void requestPermission()}
              disabled={isBusy}
              data-testid="reminder-request-permission"
            >
              {isBusy ? "確認中..." : "通知を許可する"}
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {settings.map((setting) => (
            <ReminderRow
              key={setting.slotId}
              setting={setting}
              disabled={permission !== "granted"}
              onToggle={(enabled) => updateSlot(setting.slotId, { enabled })}
              onTimeChange={(hour, minute) => updateSlot(setting.slotId, { hour, minute })}
            />
          ))}
        </div>

        {permission === "granted" && (
          <p className="text-xs text-muted-foreground" data-testid="reminder-summary">
            {enabledCount === 0
              ? "現在オンになっているリマインダーはありません。"
              : `${enabledCount}件のリマインダーがオンになっています。`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface ReminderRowProps {
  setting: ReminderSetting;
  disabled: boolean;
  onToggle: (enabled: boolean) => void;
  onTimeChange: (hour: number, minute: number) => void;
}

function ReminderRow({ setting, disabled, onToggle, onTimeChange }: ReminderRowProps) {
  const inputId = `reminder-time-${setting.slotId}`;

  /**
   * <input type="time"> は "HH:MM" を返す。空文字 (クリア操作) や
   * 不正値を setState に流すと NaN が localStorage に載るため、
   * ここで必ず数値として検証してから通知する。
   */
  const handleChange = (value: string) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value);
    if (!match) return;

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return;

    onTimeChange(hour, minute);
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={inputId} className="min-w-12 text-sm">
        {REMINDER_LABELS[setting.slotId]}
      </Label>

      <div className="flex items-center gap-3">
        <Input
          id={inputId}
          type="time"
          value={formatReminderTime(setting)}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          className="w-32"
          data-testid={inputId}
        />
        <Switch
          checked={setting.enabled}
          onCheckedChange={onToggle}
          disabled={disabled}
          aria-label={`${REMINDER_LABELS[setting.slotId]}のリマインダー`}
          data-testid={`reminder-toggle-${setting.slotId}`}
        />
      </div>
    </div>
  );
}
