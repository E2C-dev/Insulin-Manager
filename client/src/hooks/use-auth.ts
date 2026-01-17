import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  username: string;
}

interface AuthResponse {
  user: User;
}

// 現在のユーザー情報を取得
async function fetchCurrentUser(): Promise<User | null> {
  try {
    const response = await fetch("/api/auth/me", {
      credentials: "include",
    });

    if (!response.ok) {
      return null;
    }

    // レスポンスが空でないか確認
    const text = await response.text();
    if (!text) {
      return null;
    }

    const data: AuthResponse = JSON.parse(text);
    return data.user;
  } catch (error) {
    console.error("ユーザー情報取得エラー:", error);
    return null;
  }
}

// ログアウト処理
async function logout(): Promise<void> {
  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("ログアウトに失敗しました");
    }

    // レスポンスが空でないか確認してからパース
    const text = await response.text();
    if (text) {
      JSON.parse(text);
    }
  } catch (error) {
    console.error("ログアウトエラー:", error);
    throw new Error("ログアウトに失敗しました");
  }
}

export function useAuth() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // ユーザー情報の取得
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["auth", "user"],
    queryFn: fetchCurrentUser,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5分間はキャッシュを使用
  });

  // ログアウト処理
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.setQueryData(["auth", "user"], null);
      toast({
        title: "ログアウト",
        description: "ログアウトしました",
      });
      setLocation("/login");
    },
    onError: (error: Error) => {
      toast({
        title: "エラー",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout: () => logoutMutation.mutate(),
    isLoggingOut: logoutMutation.isPending,
  };
}

