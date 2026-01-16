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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Spinner className="mx-auto" />
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  // 認証されていない場合は何も表示しない
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

