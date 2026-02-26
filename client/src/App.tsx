import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
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

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/" component={HomeRoute} />
      <Route path="/logbook">
        {() => (
          <ProtectedRoute>
            <Logbook />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/entry">
        {() => (
          <ProtectedRoute>
            <Entry />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/settings">
        {() => (
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/adjustment-rules">
        {() => (
          <ProtectedRoute>
            <AdjustmentRules />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/settings/security">
        {() => (
          <ProtectedRoute>
            <SecuritySettings />
          </ProtectedRoute>
        )}
      </Route>
      {/* 管理者ルート */}
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/users">
        {() => (
          <AdminProtectedRoute>
            <AdminUsers />
          </AdminProtectedRoute>
        )}
      </Route>
      <Route path="/admin/feature-flags">
        {() => (
          <AdminProtectedRoute>
            <AdminFeatureFlags />
          </AdminProtectedRoute>
        )}
      </Route>
      <Route path="/admin/feedback">
        {() => (
          <AdminProtectedRoute>
            <AdminFeedback />
          </AdminProtectedRoute>
        )}
      </Route>
      <Route path="/admin/audit-logs">
        {() => (
          <AdminProtectedRoute>
            <AdminAuditLogs />
          </AdminProtectedRoute>
        )}
      </Route>
      <Route path="/admin">
        {() => (
          <AdminProtectedRoute>
            <AdminDashboard />
          </AdminProtectedRoute>
        )}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
