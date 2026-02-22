import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface FeatureFlag {
  id: string;
  key: string;
  value: boolean;
  description: string | null;
  updatedAt: string;
  adminUsername?: string | null;
}

const FLAG_LABELS: Record<string, string> = {
  show_ads: "広告表示",
  enable_user_registration: "新規ユーザー登録",
};

async function updateFlag(key: string, value: boolean) {
  const res = await fetch(`/api/admin/feature-flags/${key}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ value }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "エラーが発生しました");
  }
  return res.json();
}

export default function AdminFeatureFlags() {
  const { isWritable } = useAdminAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingChange, setPendingChange] = useState<{
    key: string;
    newValue: boolean;
    label: string;
  } | null>(null);

  const { data, isLoading } = useQuery<{ flags: FeatureFlag[] }>({
    queryKey: ["admin", "feature-flags"],
    queryFn: () =>
      fetch("/api/admin/feature-flags", { credentials: "include" }).then((r) =>
        r.json()
      ),
  });

  const mutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: boolean }) =>
      updateFlag(key, value),
    onSuccess: (_, { value, key }) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "feature-flags"] });
      // フロントエンドのフィーチャーフラグキャッシュも無効化
      queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
      setPendingChange(null);
      toast({
        title: `${FLAG_LABELS[key] ?? key}を${value ? "ON" : "OFF"}にしました`,
      });
    },
    onError: (err: Error) => {
      setPendingChange(null);
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const flags = data?.flags ?? [];

  const handleToggle = (flag: FeatureFlag) => {
    if (!isWritable) return;
    setPendingChange({
      key: flag.key,
      newValue: !flag.value,
      label: FLAG_LABELS[flag.key] ?? flag.key,
    });
  };

  const confirmChange = () => {
    if (!pendingChange) return;
    mutation.mutate({ key: pendingChange.key, value: pendingChange.newValue });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">機能フラグ管理</h1>
          <p className="text-muted-foreground text-sm mt-1">
            サービス内の機能のON/OFFを即座に切り替えられます
          </p>
        </div>

        {!isWritable && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm rounded p-3">
            閲覧のみ権限のため、フラグの変更はできません。
          </div>
        )}

        {isLoading ? (
          <p className="text-muted-foreground text-sm">読み込み中...</p>
        ) : (
          <div className="grid gap-4">
            {flags.map((flag) => (
              <Card key={flag.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {FLAG_LABELS[flag.key] ?? flag.key}
                      </CardTitle>
                      <CardDescription className="text-xs font-mono mt-0.5">
                        {flag.key}
                      </CardDescription>
                    </div>
                    <Switch
                      checked={flag.value}
                      onCheckedChange={() => handleToggle(flag)}
                      disabled={!isWritable || mutation.isPending}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {flag.description && (
                      <p className="text-sm text-muted-foreground">
                        {flag.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      現在:{" "}
                      <span
                        className={`font-semibold ${
                          flag.value ? "text-green-600" : "text-gray-500"
                        }`}
                      >
                        {flag.value ? "ON（有効）" : "OFF（無効）"}
                      </span>
                      {" · "}最終更新:{" "}
                      {new Date(flag.updatedAt).toLocaleString("ja-JP", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 変更確認ダイアログ */}
      <AlertDialog
        open={!!pendingChange}
        onOpenChange={(open) => {
          if (!open) setPendingChange(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>機能フラグを変更しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-foreground">
                {pendingChange?.label}
              </span>{" "}
              を{" "}
              <span
                className={`font-bold ${
                  pendingChange?.newValue ? "text-green-600" : "text-gray-600"
                }`}
              >
                {pendingChange?.newValue ? "ON（有効）" : "OFF（無効）"}
              </span>{" "}
              に変更します。この変更はすぐにサービスに反映されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmChange}
              disabled={mutation.isPending}
            >
              変更する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
