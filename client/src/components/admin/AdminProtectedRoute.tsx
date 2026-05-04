import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { Spinner } from "@/components/ui/spinner";

interface AdminProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * AdminProtectedRoute
 *
 * Admin 認証が必要なルートをガードするコンポーネント。
 *
 * Sprint 2 (S2-3) 改修:
 *   ProtectedRoute (BUG-006 fix) と同じ Spinner パターンに統一する。
 *   - isLoading 中: Spinner を表示 (これまでも実施)
 *   - 未認証時: null ではなく Spinner を表示し、redirect 先へ移動中であることを明示する
 *     (1tick の真っ白を避ける white-flash 防止)
 *   - リダイレクトは useEffect 内で副作用として実行 (これまで通り)
 */
export function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/admin/login");
    }
  }, [isAuthenticated, isLoading, setLocation]);

  // 認証状態をチェック中
  if (isLoading) {
    return (
      <div
        className="min-h-[100svh] flex items-center justify-center bg-gray-50"
        data-testid="admin-protected-loading"
      >
        <div className="text-center space-y-4">
          <Spinner className="size-8 text-primary mx-auto" />
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  // 未認証 → /admin/login へリダイレクト中の表示 (white-flash 防止)
  if (!isAuthenticated) {
    return (
      <div
        className="min-h-[100svh] flex items-center justify-center bg-gray-50"
        data-testid="admin-protected-redirecting"
      >
        <div className="text-center space-y-4">
          <Spinner className="size-8 text-primary mx-auto" />
          <p className="text-gray-500">ログインページへ移動中...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
