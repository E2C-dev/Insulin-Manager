import { ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Spinner } from "@/components/ui/spinner";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  // 認証されていない場合はログインページへリダイレクト
  useEffect(() => {
    if (!isLoading && !isAuthenticated && location !== "/login") {
      setLocation("/login");
    }
  }, [isAuthenticated, isLoading, location, setLocation]);

  // 認証状態をチェック中
  if (isLoading) {
    return (
      <div className="min-h-[100svh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Spinner className="mx-auto" />
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  // 認証されていない場合はリダイレクト中の Spinner を表示 (一瞬のホワイトアウト防止 BUG-006)
  if (!isAuthenticated) {
    return (
      <div className="min-h-[100svh] flex items-center justify-center" data-testid="protected-redirecting">
        <div className="text-center space-y-4">
          <Spinner className="mx-auto" />
          <p className="text-gray-500">ログインページへ移動中...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

