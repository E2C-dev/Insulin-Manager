import { useQuery } from "@tanstack/react-query";
import { Users, UserCheck, UserPlus, Flag } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminLayout } from "@/components/admin/AdminLayout";

interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  newUsersLast7Days: number;
  featureFlagCount: number;
}

interface AuditLog {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  previousValue: string | null;
  newValue: string | null;
  createdAt: string;
  adminUsername: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  "user.activate": "ユーザー有効化",
  "user.deactivate": "ユーザー無効化",
  "user.delete": "ユーザー削除",
  "feature_flag.update": "機能フラグ更新",
};

const ACTION_COLORS: Record<string, string> = {
  "user.activate": "bg-green-100 text-green-800",
  "user.deactivate": "bg-yellow-100 text-yellow-800",
  "user.delete": "bg-red-100 text-red-800",
  "feature_flag.update": "bg-blue-100 text-blue-800",
};

function StatCard({
  icon: Icon,
  label,
  value,
  description,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  description?: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { data: statsData } = useQuery<{ stats: SystemStats }>({
    queryKey: ["admin", "stats"],
    queryFn: () =>
      fetch("/api/admin/stats", { credentials: "include" }).then((r) =>
        r.json()
      ),
    refetchInterval: 60000,
  });

  const { data: logsData } = useQuery<{ logs: AuditLog[] }>({
    queryKey: ["admin", "audit-logs", { page: 1, limit: 10 }],
    queryFn: () =>
      fetch("/api/admin/audit-logs?page=1&limit=10", {
        credentials: "include",
      }).then((r) => r.json()),
  });

  const stats = statsData?.stats;
  const recentLogs = logsData?.logs ?? [];

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">概要ダッシュボード</h1>
          <p className="text-muted-foreground text-sm mt-1">
            システムの現在の状態を確認できます
          </p>
        </div>

        {/* 統計カード */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="総ユーザー数"
            value={stats?.totalUsers ?? "—"}
            description="登録済みユーザーの合計"
            color="bg-blue-50 text-blue-600"
          />
          <StatCard
            icon={UserCheck}
            label="アクティブユーザー"
            value={stats?.activeUsers ?? "—"}
            description="有効なアカウント数"
            color="bg-green-50 text-green-600"
          />
          <StatCard
            icon={UserPlus}
            label="直近7日の新規登録"
            value={stats?.newUsersLast7Days ?? "—"}
            description="過去7日間の登録数"
            color="bg-purple-50 text-purple-600"
          />
          <StatCard
            icon={Flag}
            label="機能フラグ数"
            value={stats?.featureFlagCount ?? "—"}
            description="登録されているフラグ数"
            color="bg-orange-50 text-orange-600"
          />
        </div>

        {/* 最近の監査ログ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">最近の操作ログ</CardTitle>
            <CardDescription>管理者による直近10件の操作履歴</CardDescription>
          </CardHeader>
          <CardContent>
            {recentLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                操作ログがありません
              </p>
            ) : (
              <div className="space-y-2">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs px-2 py-1 rounded font-medium ${
                          ACTION_COLORS[log.action] ??
                          "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        by{" "}
                        <span className="font-medium text-foreground">
                          {log.adminUsername ?? "不明"}
                        </span>
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString("ja-JP", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
