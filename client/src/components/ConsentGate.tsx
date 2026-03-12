import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

interface TermsVersion {
  id: string;
  docType: string;
  version: string;
  summary: string | null;
}

const DOC_TYPE_LABEL: Record<string, string> = {
  terms: "利用規約",
  privacy: "プライバシーポリシー",
};

interface ConsentGateProps {
  children: React.ReactNode;
}

export function ConsentGate({ children }: ConsentGateProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // 認証済みのときだけ未同意バージョンを取得
  const { data, isLoading: pendingLoading } = useQuery<{ pending: TermsVersion[] }>({
    queryKey: ["consent", "pending"],
    queryFn: async () => {
      const res = await fetch("/api/consent/pending");
      if (!res.ok) return { pending: [] };
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 0,
  });

  const pending = data?.pending ?? [];
  const allChecked = pending.length > 0 && pending.every((v) => checked[v.id] === true);

  const agreeMutation = useMutation({
    mutationFn: async (versionIds: string[]) => {
      const res = await fetch("/api/consent/agree", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version_ids: versionIds }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "同意の送信に失敗しました");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consent", "pending"] });
    },
    onError: (err: Error) => {
      toast({ title: "エラー", description: err.message, variant: "destructive" });
    },
  });

  const handleAgree = () => {
    const ids = pending.map((v) => v.id);
    agreeMutation.mutate(ids);
  };

  // 未認証 or ロード中 or 未同意なし → そのまま子要素を表示
  if (!isAuthenticated || isLoading || pendingLoading || pending.length === 0) {
    return <>{children}</>;
  }

  // 未同意あり → モーダルを表示（背後の画面はブロック）
  return (
    <>
      {children}
      <Dialog open modal>
        <DialogContent
          className="max-w-lg max-h-[90vh] overflow-y-auto"
          // 閉じるボタンを無効化（同意しないと使えない）
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>利用規約・プライバシーポリシーの更新</DialogTitle>
            <DialogDescription>
              以下のドキュメントが更新されました。内容をご確認の上、同意してください。
              同意いただけない場合、本サービスの継続利用はできません。
            </DialogDescription>
          </DialogHeader>

          {/* 緊急案内 */}
          <Alert className="border-red-400 bg-red-50 dark:bg-red-950">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 dark:text-red-200 text-sm">
              緊急時は <strong>119番・110番</strong> または医療機関へ。本サービスは緊急対応手段ではありません。
            </AlertDescription>
          </Alert>

          {/* 同意チェックボックス */}
          <div className="space-y-3">
            {pending.map((v) => (
              <div key={v.id} className="flex items-start space-x-3 rounded-md border p-3">
                <Checkbox
                  id={`recon-${v.id}`}
                  checked={checked[v.id] ?? false}
                  onCheckedChange={(c) =>
                    setChecked((prev) => ({ ...prev, [v.id]: c === true }))
                  }
                  disabled={agreeMutation.isPending}
                />
                <label htmlFor={`recon-${v.id}`} className="text-sm leading-tight cursor-pointer">
                  <span className="font-medium">
                    {DOC_TYPE_LABEL[v.docType] ?? v.docType} {v.version}
                  </span>
                  {v.summary && (
                    <span className="text-muted-foreground ml-1">（{v.summary}）</span>
                  )}
                  <br />
                  の内容を読み、同意します。
                </label>
              </div>
            ))}
          </div>

          <Button
            className="w-full"
            onClick={handleAgree}
            disabled={!allChecked || agreeMutation.isPending}
          >
            {agreeMutation.isPending ? "送信中..." : "すべてに同意してサービスを続ける"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            同意できない場合は、設定画面よりアカウント削除をお申し付けください。
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
