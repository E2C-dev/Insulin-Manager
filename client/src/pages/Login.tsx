import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Spinner } from "@/components/ui/spinner";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // 既にログインしている場合はホームへリダイレクト
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  const loginMutation = useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      console.log("=== ログインAPI呼び出し開始 ===");
      console.log("ユーザー名:", credentials.username);
      
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
          credentials: "include",
        });

        console.log("レスポンスステータス:", response.status, response.statusText);

        const text = await response.text();
        console.log("レスポンスボディ:", text);
        
        let data;
        
        try {
          data = text ? JSON.parse(text) : {};
          console.log("パースされたデータ:", data);
        } catch (error) {
          console.error("❌ JSONパースエラー:", error);
          console.error("パースできなかったテキスト:", text);
          throw new Error("サーバーからの応答が不正です: " + text.substring(0, 100));
        }

        if (!response.ok) {
          let errorMessage = data.message || "ログインに失敗しました";
          
          // ステータスコード別の詳細メッセージ
          if (response.status === 404) {
            errorMessage = "ログインAPIが見つかりません。サーバーが正しく起動しているか確認してください。";
            console.error("❌ 404エラー: /api/auth/login エンドポイントが見つかりません");
          } else if (response.status === 401) {
            errorMessage = data.message || "ユーザー名またはパスワードが正しくありません";
          } else if (response.status === 500) {
            errorMessage = data.message || "サーバーエラーが発生しました";
          } else {
            errorMessage = `${errorMessage} (HTTPステータス: ${response.status} ${response.statusText})`;
          }
          
          console.error("❌ ログイン失敗:");
          console.error("  ステータス:", response.status, response.statusText);
          console.error("  メッセージ:", errorMessage);
          console.error("  URL:", response.url);
          throw new Error(errorMessage);
        }

        console.log("✅ ログイン成功:", data);
        return data;
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          console.error("❌ ネットワークエラー: サーバーに接続できません");
          console.error("  サーバーが起動しているか確認してください");
          console.error("  URL: /api/auth/login");
          throw new Error("サーバーに接続できません。サーバーが起動しているか確認してください。");
        }
        console.error("❌ 予期しないエラー:", error);
        console.error("  エラータイプ:", error instanceof Error ? error.constructor.name : typeof error);
        if (error instanceof Error) {
          console.error("  エラーメッセージ:", error.message);
          console.error("  スタックトレース:", error.stack);
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log("✅ ログイン成功コールバック:", data);
      toast({
        title: "✅ ログイン成功",
        description: data.message || "ログインしました",
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      console.error("❌ ログイン失敗コールバック:", error);
      toast({
        title: "❌ ログイン失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("=== ログインフォーム送信 ===");
    console.log("ユーザー名:", username);
    loginMutation.mutate({ username, password });
  };

  // 認証チェック中
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">ログイン</CardTitle>
          <CardDescription className="text-center">
            アカウントにログインしてください
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
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
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loginMutation.isPending}
              />
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
                disabled={loginMutation.isPending}
              />
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
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

