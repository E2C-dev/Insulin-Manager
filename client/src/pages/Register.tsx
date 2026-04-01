import { useState, useEffect } from "react";
import { Eye, EyeOff, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Spinner } from "@/components/ui/spinner";

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

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [consentChecked, setConsentChecked] = useState<Record<string, boolean>>({});

  // 既にログインしている場合はホームへリダイレクト
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  // 有効な規約バージョンを取得
  const { data: termsData } = useQuery<{ active: TermsVersion[] }>({
    queryKey: ["terms", "active"],
    queryFn: async () => {
      const res = await fetch("/api/terms/active");
      if (!res.ok) return { active: [] };
      return res.json();
    },
  });

  const activeVersions = termsData?.active ?? [];
  const allConsented =
    activeVersions.length === 0 ||
    activeVersions.every((v) => consentChecked[v.id] === true);

  const registerMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string; version_ids: string[] }) => {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });

      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error("サーバーからの応答が不正です");
      }

      if (!response.ok) {
        throw new Error(data.message || "登録に失敗しました");
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
      toast({
        title: "登録成功",
        description: data.message || "アカウントが作成されました",
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "登録失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (username.length < 3) {
      toast({ title: "入力エラー", description: "ユーザー名は3文字以上で入力してください", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "入力エラー", description: "パスワードは6文字以上で入力してください", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "パスワード確認エラー", description: "パスワードが一致しません", variant: "destructive" });
      return;
    }
    if (!allConsented) {
      toast({ title: "同意エラー", description: "利用規約とプライバシーポリシーへの同意が必要です", variant: "destructive" });
      return;
    }

    const version_ids = activeVersions.map((v) => v.id);
    registerMutation.mutate({ username, password, version_ids });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md space-y-3">
        {/* 緊急案内バナー */}
        <Alert className="border-red-400 bg-red-50 dark:bg-red-950">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 dark:text-red-200 text-sm">
            <strong>緊急時は本サービスを使用しないでください。</strong><br />
            体調急変・生命の危機・自傷などの場合は <strong>119番・110番</strong> または医療機関へ。
          </AlertDescription>
        </Alert>

        <Card className="shadow-xl bg-white dark:bg-gray-900">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">新規登録</CardTitle>
            <CardDescription className="text-center">
              新しいアカウントを作成してください
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {registerMutation.isError && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {registerMutation.error?.message || "登録に失敗しました"}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="username">ユーザー名</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="ユーザー名を入力"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={registerMutation.isPending}
                  minLength={3}
                />
                <p className="text-sm text-gray-500">3文字以上で入力してください</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">パスワード</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="パスワードを入力"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={registerMutation.isPending}
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-sm text-gray-500">6文字以上で入力してください</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">パスワード（確認）</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="パスワードを再入力"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={registerMutation.isPending}
                />
              </div>

              {/* 利用規約・PP 同意セクション */}
              {activeVersions.length > 0 && (
                <div className="space-y-3 rounded-md border border-gray-200 dark:border-gray-700 p-4">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    以下の内容を確認し、すべてに同意してください
                  </p>

                  <div className="rounded bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                    <p>• 本サービスは<strong>個人開発のツール</strong>であり、医療行為・診断・治療を一切提供しません。</p>
                    <p>• 開発者は本サービスの利用によって生じる損害について<strong>一切の責任を負いません</strong>。</p>
                    <p>• サービスは予告なく変更・停止・廃止される場合があります。</p>
                  </div>

                  {activeVersions.map((v) => (
                    <div key={v.id} className="flex items-start space-x-3">
                      <Checkbox
                        id={`consent-${v.id}`}
                        checked={consentChecked[v.id] ?? false}
                        onCheckedChange={(checked) =>
                          setConsentChecked((prev) => ({ ...prev, [v.id]: checked === true }))
                        }
                        disabled={registerMutation.isPending}
                      />
                      <label
                        htmlFor={`consent-${v.id}`}
                        className="text-sm leading-tight cursor-pointer"
                      >
                        <span className="font-medium">
                          {DOC_TYPE_LABEL[v.docType] ?? v.docType} {v.version}
                        </span>
                        {v.summary && (
                          <span className="text-gray-500 dark:text-gray-400 ml-1">（{v.summary}）</span>
                        )}
                        の内容を読み、同意します。
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                className="w-full"
                disabled={registerMutation.isPending || !allConsented}
              >
                {registerMutation.isPending ? "登録中..." : "同意して登録"}
              </Button>

              <div className="text-sm text-center text-gray-600 dark:text-gray-400">
                既にアカウントをお持ちの方は{" "}
                <button
                  type="button"
                  onClick={() => setLocation("/login")}
                  className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-medium underline"
                >
                  ログイン
                </button>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
