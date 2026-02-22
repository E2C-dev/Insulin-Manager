import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Bug, Lightbulb, Sparkles, MoreVertical } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

interface Feedback {
  id: string;
  category: string;
  title: string;
  body: string;
  contactEmail: string | null;
  status: string;
  createdAt: string;
  userId: string | null;
}

const CATEGORY_ICONS: Record<string, React.ReactElement> = {
  bug: <Bug size={14} className="inline mr-1 text-red-500" />,
  feature: <Sparkles size={14} className="inline mr-1 text-blue-500" />,
  improvement: <Lightbulb size={14} className="inline mr-1 text-yellow-500" />,
  other: <MessageSquare size={14} className="inline mr-1 text-gray-500" />,
};

const CATEGORY_LABELS: Record<string, string> = {
  bug: "バグ",
  feature: "機能要望",
  improvement: "改善提案",
  other: "その他",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  open: "default",
  in_review: "secondary",
  done: "outline",
  closed: "outline",
};

const STATUS_LABELS: Record<string, string> = {
  open: "未対応",
  in_review: "検討中",
  done: "対応済み",
  closed: "クローズ",
};

const NEXT_STATUSES: Record<string, { value: string; label: string }[]> = {
  open: [{ value: "in_review", label: "検討中にする" }, { value: "closed", label: "クローズ" }],
  in_review: [{ value: "done", label: "対応済みにする" }, { value: "closed", label: "クローズ" }],
  done: [{ value: "closed", label: "クローズ" }],
  closed: [{ value: "open", label: "再オープン" }],
};

async function fetchFeedbacks(): Promise<{ feedbacks: Feedback[] }> {
  const res = await fetch("/api/admin/feedback", { credentials: "include" });
  if (!res.ok) throw new Error("取得失敗");
  return res.json();
}

async function updateStatus(id: string, status: string) {
  const res = await fetch(`/api/admin/feedback/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("更新失敗");
  return res.json();
}

export default function AdminFeedback() {
  const [selected, setSelected] = useState<Feedback | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "feedback"],
    queryFn: fetchFeedbacks,
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "feedback"] });
      toast({ title: "ステータスを更新しました" });
    },
    onError: () => {
      toast({ title: "更新失敗", variant: "destructive" });
    },
  });

  const feedbacks = data?.feedbacks ?? [];
  const counts = feedbacks.reduce(
    (acc, f) => { acc[f.status] = (acc[f.status] ?? 0) + 1; return acc; },
    {} as Record<string, number>
  );

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">フィードバック管理</h1>
          <p className="text-sm text-muted-foreground mt-1">ユーザーからのバグ報告・機能要望・改善提案</p>
        </div>

        {/* サマリーバッジ */}
        <div className="flex gap-2 flex-wrap">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <Badge key={key} variant={STATUS_VARIANTS[key]} className="text-sm px-3 py-1">
              {label}: {counts[key] ?? 0}件
            </Badge>
          ))}
        </div>

        {/* テーブル */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>種類</TableHead>
                <TableHead>タイトル</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>日時</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    読み込み中...
                  </TableCell>
                </TableRow>
              ) : feedbacks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    フィードバックはまだありません
                  </TableCell>
                </TableRow>
              ) : (
                feedbacks.map((fb) => (
                  <TableRow
                    key={fb.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelected(fb)}
                  >
                    <TableCell className="whitespace-nowrap">
                      {CATEGORY_ICONS[fb.category]}
                      {CATEGORY_LABELS[fb.category] ?? fb.category}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{fb.title}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[fb.status]}>
                        {STATUS_LABELS[fb.status] ?? fb.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(fb.createdAt).toLocaleDateString("ja-JP")}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical size={14} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(NEXT_STATUSES[fb.status] ?? []).map((s) => (
                            <DropdownMenuItem
                              key={s.value}
                              onClick={() => mutation.mutate({ id: fb.id, status: s.value })}
                            >
                              {s.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* 詳細パネル */}
        {selected && (
          <div className="border rounded-lg p-5 space-y-3 bg-muted/30">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs text-muted-foreground">
                  {CATEGORY_ICONS[selected.category]}{CATEGORY_LABELS[selected.category]}
                </span>
                <h2 className="font-semibold text-lg mt-0.5">{selected.title}</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>閉じる</Button>
            </div>
            <p className="text-sm whitespace-pre-wrap">{selected.body}</p>
            {selected.contactEmail && (
              <p className="text-sm text-muted-foreground">
                返信先: <a href={`mailto:${selected.contactEmail}`} className="underline">{selected.contactEmail}</a>
              </p>
            )}
            <div className="flex gap-2 pt-2 flex-wrap">
              {(NEXT_STATUSES[selected.status] ?? []).map((s) => (
                <Button
                  key={s.value}
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    mutation.mutate({ id: selected.id, status: s.value });
                    setSelected((prev) => prev ? { ...prev, status: s.value } : null);
                  }}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
