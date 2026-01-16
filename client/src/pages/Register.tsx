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

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
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
      console.log("=== API呼び出し開始 ===");
      console.log("送信データ:", { username: credentials.username, passwordLength: credentials.password.length });
      
      try {
        const response = await fetch("/api/auth/register", {
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
          let errorMessage = data.message || "登録に失敗しました";
          
          // ステータスコード別の詳細メッセージ
          if (response.status === 404) {
            errorMessage = "登録APIが見つかりません。サーバーが正しく起動しているか確認してください。";
            console.error("❌ 404エラー: /api/auth/register エンドポイントが見つかりません");
          } else if (response.status === 400) {
            errorMessage = data.message || "入力内容に問題があります";
          } else if (response.status === 500) {
            errorMessage = data.message || "サーバーエラーが発生しました";
          } else {
            errorMessage = `${errorMessage} (HTTPステータス: ${response.status} ${response.statusText})`;
          }
          
          console.error("❌ 登録失敗:");
          console.error("  ステータス:", response.status, response.statusText);
          console.error("  メッセージ:", errorMessage);
          console.error("  URL:", response.url);
          if (data.errors) {
            console.error("  詳細エラー:", data.errors);
          }
          throw new Error(errorMessage);
        }

        console.log("✅ 登録成功:", data);
        return data;
      } catch (error) {
        if (error instanceof TypeError && error.message.includes('fetch')) {
          console.error("❌ ネットワークエラー: サーバーに接続できません");
          console.error("  サーバーが起動しているか確認してください");
          console.error("  URL: /api/auth/register");
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
      console.log("✅ 登録成功コールバック:", data);
      toast({
        title: "✅ 登録成功",
        description: data.message || "アカウントが作成されました",
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

