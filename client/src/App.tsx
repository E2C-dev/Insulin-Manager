import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import { ConsentGate } from "@/components/ConsentGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import LandingPage from "@/pages/LandingPage";
import Logbook from "@/pages/Logbook";
import Entry from "@/pages/Entry";
import Settings from "@/pages/Settings";
import AdjustmentRules from "@/pages/AdjustmentRules";
import SecuritySettings from "@/pages/SecuritySettings";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import TermsViewer from "@/pages/TermsViewer";
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminFeatureFlags from "@/pages/admin/AdminFeatureFlags";
import AdminAuditLogs from "@/pages/admin/AdminAuditLogs";
import AdminFeedback from "@/pages/admin/AdminFeedback";

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

function Router() {
  return (
    <Switch>
      <Route path="/login">{() => <PageBoundary><Login /></PageBoundary>}</Route>
      <Route path="/register">{() => <PageBoundary><Register /></PageBoundary>}</Route>
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
