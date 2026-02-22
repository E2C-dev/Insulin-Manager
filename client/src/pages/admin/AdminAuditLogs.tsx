import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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

interface AuditLogsResponse {
  logs: AuditLog[];
  pagination: { page: number; limit: number; total: number };
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

function formatValue(jsonStr: string | null): string {
  if (!jsonStr) return "—";
  try {
    const obj = JSON.parse(jsonStr);
    return Object.entries(obj)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(", ");
  } catch {
    return jsonStr;
  }
}

export default function AdminAuditLogs() {
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data, isLoading } = useQuery<AuditLogsResponse>({
    queryKey: ["admin", "audit-logs-full", { page }],
    queryFn: () =>
      fetch(`/api/admin/audit-logs?page=${page}&limit=${limit}`, {
        credentials: "include",
      }).then((r) => r.json()),
  });

  const logs = data?.logs ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination
    ? Math.ceil(pagination.total / pagination.limit)
    : 1;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">監査ログ</h1>
          <p className="text-muted-foreground text-sm mt-1">
            管理者による操作の完全な履歴
          </p>
        </div>

        <div className="border rounded-lg bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日時</TableHead>
                <TableHead>管理者</TableHead>
                <TableHead>操作</TableHead>
                <TableHead>対象</TableHead>
                <TableHead>変更前</TableHead>
                <TableHead>変更後</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    読み込み中...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    監査ログがありません
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("ja-JP", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {log.adminUsername ?? "不明"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-1 rounded font-medium ${
                          ACTION_COLORS[log.action] ??
                          "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.targetType}
                      {log.targetId && (
                        <span className="font-mono ml-1 text-foreground/60">
                          ({log.targetId.slice(0, 8)}...)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {formatValue(log.previousValue)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {formatValue(log.newValue)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* ページネーション */}
        {pagination && totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              全 {pagination.total} 件中{" "}
              {(pagination.page - 1) * pagination.limit + 1}〜
              {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
              件を表示
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="flex items-center text-sm px-2">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
