import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Trash2, ChevronLeft, ChevronRight, KeyRound, Eye, EyeOff } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface UserItem {
  id: string;
  username: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface UsersResponse {
  users: UserItem[];
  pagination: { page: number; limit: number; total: number };
}

async function apiRequest(method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "エラーが発生しました");
  }
  return res.json();
}

export default function AdminUsers() {
  const { isWritable } = useAdminAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [resetPasswordTarget, setResetPasswordTarget] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const { data, isLoading } = useQuery<UsersResponse>({
    queryKey: ["admin", "users", { page, search }],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "20",
        ...(search ? { search } : {}),
      });
      return apiRequest("GET", `/api/admin/users?${params}`);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({
      id,
      isActive,
    }: {
      id: string;
      isActive: boolean;
    }) => apiRequest("PATCH", `/api/admin/users/${id}/status`, { isActive }),
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast({
        title: `ユーザーを${isActive ? "有効化" : "無効化"}しました`,
      });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      setDeleteTarget(null);
      setDeleteConfirmText("");
      toast({ title: "ユーザーを削除しました" });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      apiRequest("POST", `/api/admin/users/${id}/reset-password`, { newPassword }),
    onSuccess: () => {
      setResetPasswordTarget(null);
      setNewPassword("");
      toast({ title: "✅ パスワードをリセットしました" });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const users = data?.users ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination
    ? Math.ceil(pagination.total / pagination.limit)
    : 1;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">ユーザー管理</h1>
          <p className="text-muted-foreground text-sm mt-1">
            登録ユーザーの一覧と管理
          </p>
        </div>

        {/* 検索フォーム */}
        <form onSubmit={handleSearch} className="flex gap-2 max-w-sm">
          <Input
            type="text"
            placeholder="ユーザー名で検索..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <Button type="submit" variant="outline" size="icon">
            <Search className="w-4 h-4" />
          </Button>
        </form>

        {/* テーブル */}
        <div className="border rounded-lg bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ユーザー名</TableHead>
                <TableHead>ロール</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>最終ログイン</TableHead>
                <TableHead>登録日</TableHead>
                {isWritable && <TableHead className="text-right">操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={isWritable ? 6 : 5}
                    className="text-center py-8 text-muted-foreground"
                  >
                    読み込み中...
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isWritable ? 6 : 5}
                    className="text-center py-8 text-muted-foreground"
                  >
                    ユーザーが見つかりません
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.role === "admin"
                            ? "default"
                            : user.role === "admin_readonly"
                            ? "secondary"
                            : "outline"
                        }
                        className="text-xs"
                      >
                        {user.role === "admin"
                          ? "管理者"
                          : user.role === "admin_readonly"
                          ? "閲覧のみ"
                          : "ユーザー"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isWritable && user.role === "user" ? (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={user.isActive}
                            onCheckedChange={(checked) =>
                              statusMutation.mutate({
                                id: user.id,
                                isActive: checked,
                              })
                            }
                            disabled={statusMutation.isPending}
                          />
                          <span className="text-xs text-muted-foreground">
                            {user.isActive ? "有効" : "無効"}
                          </span>
                        </div>
                      ) : (
                        <Badge
                          variant={user.isActive ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {user.isActive ? "有効" : "無効"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(user.lastLoginAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    {isWritable && (
                      <TableCell className="text-right">
                        {user.role === "user" && (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                              title="パスワードをリセット"
                              onClick={() => {
                                setResetPasswordTarget(user);
                                setNewPassword("");
                                setShowNewPassword(false);
                              }}
                            >
                              <KeyRound className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                setDeleteTarget(user);
                                setDeleteConfirmText("");
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
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

      {/* 削除確認ダイアログ */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteConfirmText("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ユーザーを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                <span className="font-semibold text-foreground">
                  {deleteTarget?.username}
                </span>{" "}
                を削除します。このユーザーのすべてのデータ（インスリン記録、血糖値記録など）が完全に削除されます。
              </span>
              <span className="block text-red-600 font-medium">
                この操作は取り消せません。
              </span>
              <span className="block pt-2">
                確認のため{" "}
                <span className="font-mono font-semibold">削除する</span>{" "}
                と入力してください。
              </span>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="削除する"
                className="mt-2"
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
              disabled={
                deleteConfirmText !== "削除する" || deleteMutation.isPending
              }
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* パスワードリセットダイアログ */}
      <Dialog
        open={!!resetPasswordTarget}
        onOpenChange={(open) => {
          if (!open) {
            setResetPasswordTarget(null);
            setNewPassword("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>パスワードリセット</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">{resetPasswordTarget?.username}</span> の新しいパスワードを設定してください。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="admin-new-password" className="text-sm">新しいパスワード（8文字以上）</Label>
            <div className="relative">
              <Input
                id="admin-new-password"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="新しいパスワードを入力"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPasswordTarget(null)}>
              キャンセル
            </Button>
            <Button
              onClick={() => {
                if (resetPasswordTarget) {
                  resetPasswordMutation.mutate({ id: resetPasswordTarget.id, newPassword });
                }
              }}
              disabled={newPassword.length < 8 || resetPasswordMutation.isPending}
            >
              <KeyRound className="w-4 h-4 mr-2" />
              {resetPasswordMutation.isPending ? "リセット中..." : "リセットする"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
