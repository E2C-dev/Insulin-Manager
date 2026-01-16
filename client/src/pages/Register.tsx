import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Spinner } from "@/components/ui/spinner";

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // 既にログインしている場合はホームへリダイレクト
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  const registerMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      console.log("=== 登録（モック）開始 ===");
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 1秒遅延

      // モック登録成功
      const mockUser = { id: "mock-user-id", username: credentials.username };
      localStorage.setItem("mock_user", JSON.stringify(mockUser));
      
      return { message: "アカウントを作成しました", user: mockUser };
    },
    onSuccess: (data) => {
      console.log("✅ 登録成功:", data);
      queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
      toast({
        title: "✅ 登録成功",
        description: "アカウントが作成されました（モック）",
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      console.error("❌ 登録失敗コールバック:", error);
      toast({
        title: "❌ 登録失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log("=== 登録フォーム送信開始 ===");
    console.log("ユーザー名:", username);
    console.log("パスワード長:", password.length);
    console.log("確認パスワード長:", confirmPassword.length);
    
    // バリデーション
    if (username.length < 3) {
      const errorMsg = "ユーザー名は3文字以上で入力してください";
      console.error("バリデーションエラー:", errorMsg);
      toast({
        title: "入力エラー",
        description: errorMsg,
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      const errorMsg = "パスワードは6文字以上で入力してください";
      console.error("バリデーションエラー:", errorMsg);
      toast({
        title: "入力エラー",
        description: errorMsg,
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      const errorMsg = "パスワードが一致しません";
      console.error("バリデーションエラー:", errorMsg);
      console.log("パスワード:", password);
      console.log("確認パスワード:", confirmPassword);
      toast({
        title: "パスワード確認エラー",
        description: errorMsg,
        variant: "destructive",
      });
      return;
    }

    console.log("バリデーション通過、APIリクエスト送信");
    registerMutation.mutate({ username, password });
  };

  // 認証チェック中
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-100 dark:from-gray-900 dark:to-gray-800">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md shadow-xl">
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
              <p className="text-xs text-gray-500">3文字以上で入力してください</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                type="password"
                placeholder="パスワードを入力"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={registerMutation.isPending}
                minLength={6}
              />
              <p className="text-xs text-gray-500">6文字以上で入力してください</p>
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
          </CardContent>
          
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? "登録中..." : "登録"}
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
  );
}

