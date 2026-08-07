import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { QUERY_KEYS } from "@/lib/query-keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useApiError } from "@/hooks/use-api-error";
import { Spinner } from "@/components/ui/spinner";

/**
 * 作業5-5: react-hook-form + zod への移行の試験導入 (1ページ目)。
 * バリデーションは resolver に一本化し、コンポーネント側の手動 useState
 * (username/password) と個別の required チェックを廃止する。
 * 併せて作業5-4: 大量のデバッグ用 console.log を整理し、useApiError に統一。
 * 他ページへの展開方針は完了報告を参照。
 */
const loginSchema = z.object({
  username: z.string().min(1, "ユーザー名を入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { reportError } = useApiError();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  // 既にログインしている場合はホームへリダイレクト
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginFormValues) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });

      const text = await response.text();
      let data: { message?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error("サーバーからの応答が不正です: " + text.substring(0, 100));
      }

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("ログインAPIが見つかりません。サーバーが正しく起動しているか確認してください。");
        }
        if (response.status === 401) {
          throw new Error(data.message || "ユーザー名またはパスワードが正しくありません");
        }
        throw new Error(data.message || `ログインに失敗しました (HTTPステータス: ${response.status})`);
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USER_PROFILE });
      toast({
        title: "✅ ログイン成功",
        description: data.message || "ログインしました",
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      reportError(error, { title: "❌ ログイン失敗", logPrefix: "[Login] ログイン失敗" });
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    loginMutation.mutate(values);
  };

  // 認証チェック中
  if (isLoading) {
    return (
      <div className="min-h-[100svh] flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-[100svh] flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md shadow-xl bg-white dark:bg-gray-900">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">ログイン</CardTitle>
          <CardDescription className="text-center">
            アカウントにログインしてください
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {loginMutation.isError && (
              <Alert variant="destructive">
                <AlertDescription>
                  {loginMutation.error?.message || "ログインに失敗しました"}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">ユーザー名</Label>
              <Input
                id="username"
                type="text"
                placeholder="ユーザー名を入力"
                disabled={loginMutation.isPending}
                aria-invalid={!!errors.username}
                aria-describedby={errors.username ? "username-error" : undefined}
                {...register("username")}
              />
              {errors.username && (
                <p id="username-error" role="alert" className="text-xs text-destructive">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                type="password"
                placeholder="パスワードを入力"
                disabled={loginMutation.isPending}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "password-error" : undefined}
                {...register("password")}
              />
              {errors.password && (
                <p id="password-error" role="alert" className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? "ログイン中..." : "ログイン"}
            </Button>

            <div className="text-sm text-center text-gray-600 dark:text-gray-400">
              アカウントをお持ちでない方は{" "}
              <button
                type="button"
                onClick={() => setLocation("/register")}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium underline"
              >
                新規登録
              </button>
            </div>

            {/* 規約への導線 (未ログインでも到達できること: App Store 審査要件) */}
            <div className="flex items-center justify-center gap-3 text-[11px] text-muted-foreground">
              <a
                href="/terms/terms"
                className="underline underline-offset-2 hover:text-foreground"
                data-testid="link-login-terms"
              >
                利用規約
              </a>
              <span aria-hidden="true">・</span>
              <a
                href="/terms/privacy"
                className="underline underline-offset-2 hover:text-foreground"
                data-testid="link-login-privacy"
              >
                プライバシーポリシー
              </a>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
