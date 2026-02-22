import { useState } from "react";
import { MessageSquarePlus, X, Send, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = [
  { value: "bug", label: "🐛 バグ報告" },
  { value: "feature", label: "✨ 機能要望" },
  { value: "improvement", label: "💡 改善提案" },
  { value: "other", label: "💬 その他" },
];

async function submitFeedback(data: {
  category: string;
  title: string;
  body: string;
  contactEmail?: string;
}) {
  const res = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "送信に失敗しました");
  }
  return res.json();
}

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: submitFeedback,
    onSuccess: () => {
      toast({
        title: "ありがとうございます！",
        description: "フィードバックを受け取りました。改善に活かします。",
      });
      setOpen(false);
      resetForm();
    },
    onError: (err: Error) => {
      toast({
        title: "送信失敗",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  function resetForm() {
    setCategory("");
    setTitle("");
    setBody("");
    setEmail("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category || !title.trim() || !body.trim()) return;
    mutation.mutate({
      category,
      title: title.trim(),
      body: body.trim(),
      contactEmail: email.trim() || undefined,
    });
  }

  const isValid = !!category && title.trim().length > 0 && body.trim().length > 0;

  return (
    <>
      {/* フローティングボタン */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-primary-foreground shadow-lg text-sm font-medium transition-all hover:bg-primary/90 active:scale-95"
        aria-label="フィードバックを送る"
      >
        <MessageSquarePlus size={18} />
        <span>フィードバック</span>
      </button>

      {/* ダイアログ */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg">フィードバックを送る</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              バグ報告・機能要望・改善提案など、何でもお気軽にどうぞ。
            </p>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {/* カテゴリ */}
            <div className="space-y-1.5">
              <Label htmlFor="fb-category">種類 <span className="text-red-500">*</span></Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="fb-category">
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* タイトル */}
            <div className="space-y-1.5">
              <Label htmlFor="fb-title">タイトル <span className="text-red-500">*</span></Label>
              <Input
                id="fb-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="一言でまとめると？"
                maxLength={100}
              />
            </div>

            {/* 本文 */}
            <div className="space-y-1.5">
              <Label htmlFor="fb-body">詳細 <span className="text-red-500">*</span></Label>
              <Textarea
                id="fb-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="できるだけ具体的に教えてください（画面名、操作手順など）"
                rows={4}
                maxLength={2000}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">{body.length}/2000</p>
            </div>

            {/* メールアドレス（任意） */}
            <div className="space-y-1.5">
              <Label htmlFor="fb-email">返信先メール <span className="text-muted-foreground text-xs">（任意）</span></Label>
              <Input
                id="fb-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="reply@example.com"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!isValid || mutation.isPending}
            >
              {mutation.isPending ? (
                <><Loader2 size={16} className="mr-2 animate-spin" />送信中...</>
              ) : (
                <><Send size={16} className="mr-2" />送信する</>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
