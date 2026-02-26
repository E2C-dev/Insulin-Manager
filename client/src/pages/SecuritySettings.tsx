import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Eye, EyeOff, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";

export default function SecuritySettings() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const res = await fetch("/api/auth/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "エラーが発生しました");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ パスワードを変更しました" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "新しいパスワードと確認用パスワードが一致しません", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "新しいパスワードは8文字以上で入力してください", variant: "destructive" });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">セキュリティ設定</h1>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">パスワード変更</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 現在のパスワード */}
              <div className="space-y-1.5">
                <Label htmlFor="current-pw">現在のパスワード</Label>
                <div className="relative">
                  <Input
                    id="current-pw"
                    type={showCurrentPw ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="現在のパスワードを入力"
                    className="pr-10"
                    required
                  />
                  <button type="button" onClick={() => setShowCurrentPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 新しいパスワード */}
              <div className="space-y-1.5">
                <Label htmlFor="new-pw">新しいパスワード（8文字以上）</Label>
                <div className="relative">
                  <Input
                    id="new-pw"
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="新しいパスワードを入力"
                    className="pr-10"
                    required
                    minLength={8}
                  />
                  <button type="button" onClick={() => setShowNewPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 確認用パスワード */}
              <div className="space-y-1.5">
                <Label htmlFor="confirm-pw">新しいパスワード（確認）</Label>
                <div className="relative">
                  <Input
                    id="confirm-pw"
                    type={showConfirmPw ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="もう一度入力してください"
                    className="pr-10"
                    required
                  />
                  <button type="button" onClick={() => setShowConfirmPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={changePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
              >
                <Save className="w-4 h-4 mr-2" />
                {changePasswordMutation.isPending ? "変更中..." : "パスワードを変更する"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* ===== AdSense広告スペース ===== */}
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
