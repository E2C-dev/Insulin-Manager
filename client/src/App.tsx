import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import { ConsentGate } from "@/components/ConsentGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";

// ルートコンポーネントは React.lazy() で動的 import 化する (Sprint 2 / S2-5)。
// これにより Vite/Rollup が各ページを独立した chunk として出力し、
// 初期 entry chunk のサイズを大きく削減する。
//
// 設計判断:
//   - Login/Register/LandingPage 等の "未ログイン入口" ページも lazy 化対象に含める。
//     →初回ロード時に必ず HTTP 1往復が増えるが、それでも重い vendor chunk
//       (radix/icons/jspdf 等) を本体 entry から切り出す効果が大きい。
//   - NotFound と TermsViewer は遷移時のみ必要なため lazy 化。
//   - Spinner / ProtectedRoute / AdminProtectedRoute / ErrorBoundary / ConsentGate
//     は全ルートで使う / 即座に必要なため eager import を維持する。
//   - Suspense fallback は "全画面 Spinner" 1 つのみで十分 (chunk DL は通常数百ms)。
//     より細かいスケルトン UI は Sprint 3 以降に検討。
const NotFound = lazy(() => import("@/pages/not-found"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const LandingPage = lazy(() => import("@/pages/LandingPage"));
const Logbook = lazy(() => import("@/pages/Logbook"));
const Entry = lazy(() => import("@/pages/Entry"));
const Settings = lazy(() => import("@/pages/Settings"));
const AdjustmentRules = lazy(() => import("@/pages/AdjustmentRules"));
const SecuritySettings = lazy(() => import("@/pages/SecuritySettings"));
const Login = lazy(() => import("@/pages/Login"));
const Register = lazy(() => import("@/pages/Register"));
const TermsViewer = lazy(() => import("@/pages/TermsViewer"));
const AdminLogin = lazy(() => import("@/pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminFeatureFlags = lazy(() => import("@/pages/admin/AdminFeatureFlags"));
const AdminAuditLogs = lazy(() => import("@/pages/admin/AdminAuditLogs"));
const AdminFeedback = lazy(() => import("@/pages/admin/AdminFeedback"));
// Playwright の ErrorBoundary 検証専用ページ (開発環境のみ登録。本番ビルドには含まれない)
const TestErrorBoundaryPage = lazy(() => import("@/pages/__TestErrorBoundary"));

// 未認証 → LP、認証済み → Dashboard
function HomeRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated) return <LandingPage />;
  return <Dashboard />;
}

/**
 * ページ単位の ErrorBoundary。
 * 1ページの未捕捉例外が React Tree 全体に波及するのを防ぐ。
 * 最外層 ErrorBoundary だけだと「あるページが落ちた瞬間に全画面が真っ白」になり、
 * 別ページに遷移する手段すら失われる。ページ単位で包んでおけば
 * fallback UI のままヘッダ/Toaster などの上位 Provider は生きており、
 * 「再読み込み」「ホームへ戻る」操作が確実に行える。
 */
function PageBoundary({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

/**
 * RouteSuspenseFallback
 * lazy ロード中の全画面フォールバック。
 * - 100svh で iOS safe-area を考慮 (Sprint 1 で全画面に適用済の方針)
 * - Spinner のみのシンプル表示 (チャンク DL は通常 < 1 秒)
 */
function RouteSuspenseFallback() {
  return (
    <div
      className="min-h-[100svh] flex items-center justify-center"
      data-testid="route-lazy-loading"
    >
      <div className="text-center space-y-4">
        <Spinner className="size-8 mx-auto" />
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<RouteSuspenseFallback />}>
      <Switch>
        <Route path="/login">{() => <PageBoundary><Login /></PageBoundary>}</Route>
        <Route path="/register">{() => <PageBoundary><Register /></PageBoundary>}</Route>
        {import.meta.env.DEV && (
          <Route path="/__test-error-boundary">
            {() => <PageBoundary><TestErrorBoundaryPage /></PageBoundary>}
          </Route>
        )}
        <Route path="/terms/:docType">{() => <PageBoundary><TermsViewer /></PageBoundary>}</Route>
        <Route path="/">{() => <PageBoundary><HomeRoute /></PageBoundary>}</Route>
        <Route path="/logbook">
          {() => (
            <PageBoundary>
              <ProtectedRoute>
                <Logbook />
              </ProtectedRoute>
            </PageBoundary>
          )}
        </Route>
        <Route path="/entry">
          {() => (
            <PageBoundary>
              <ProtectedRoute>
                <Entry />
              </ProtectedRoute>
            </PageBoundary>
          )}
        </Route>
        <Route path="/settings">
          {() => (
            <PageBoundary>
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            </PageBoundary>
          )}
        </Route>
        <Route path="/adjustment-rules">
          {() => (
            <PageBoundary>
              <ProtectedRoute>
                <AdjustmentRules />
              </ProtectedRoute>
            </PageBoundary>
          )}
        </Route>
        <Route path="/settings/security">
          {() => (
            <PageBoundary>
              <ProtectedRoute>
                <SecuritySettings />
              </ProtectedRoute>
            </PageBoundary>
          )}
        </Route>
        {/* 管理者ルート */}
        <Route path="/admin/login">{() => <PageBoundary><AdminLogin /></PageBoundary>}</Route>
        <Route path="/admin/users">
          {() => (
            <PageBoundary>
              <AdminProtectedRoute>
                <AdminUsers />
              </AdminProtectedRoute>
            </PageBoundary>
          )}
        </Route>
        <Route path="/admin/feature-flags">
          {() => (
            <PageBoundary>
              <AdminProtectedRoute>
                <AdminFeatureFlags />
              </AdminProtectedRoute>
            </PageBoundary>
          )}
        </Route>
        <Route path="/admin/feedback">
          {() => (
            <PageBoundary>
              <AdminProtectedRoute>
                <AdminFeedback />
              </AdminProtectedRoute>
            </PageBoundary>
          )}
        </Route>
        <Route path="/admin/audit-logs">
          {() => (
            <PageBoundary>
              <AdminProtectedRoute>
                <AdminAuditLogs />
              </AdminProtectedRoute>
            </PageBoundary>
          )}
        </Route>
        <Route path="/admin">
          {() => (
            <PageBoundary>
              <AdminProtectedRoute>
                <AdminDashboard />
              </AdminProtectedRoute>
            </PageBoundary>
          )}
        </Route>

        <Route>{() => <PageBoundary><NotFound /></PageBoundary>}</Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    // 最外層 ErrorBoundary: Provider/Toaster を含むツリー全体を保護する。
    // ここで捕捉できなかった例外は React Root が unmount されホワイトアウトする。
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <ConsentGate>
            <Router />
          </ConsentGate>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
