import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { sanitizeHtml } from "@/lib/sanitize";

// BUG-017: 規約データが未取得 (404 等) の場合のフォールバック表示用最低限テキスト
const FALLBACK_TERMS: Record<string, string> = {
  terms:
    "# 利用規約\n\n現在、本文を取得できませんでした。\n本サービスの利用にあたっては、サービス画面に表示される最新の利用規約に従ってください。\n問題が解消しない場合は管理者にお問い合わせください。",
  privacy:
    "# プライバシーポリシー\n\n現在、本文を取得できませんでした。\n本サービスではユーザーアカウント情報・利用データを必要最小限の範囲で取り扱います。\n詳細を確認したい場合は管理者にお問い合わせください。",
  sensitive_data:
    "# 要配慮個人情報（健康情報）の取得への同意\n\n現在、本文を取得できませんでした。\n本サービスは、血糖値・インスリンの種類/投与量/投与日時・主治医の指示票の転記内容その他の健康に関する記録データを、プライバシーポリシー第4条の利用目的のために取得します。\nこれらは個人情報保護法上の要配慮個人情報に該当し得る情報です。\n詳細を確認したい場合は管理者にお問い合わせください。",
};

const DOC_TYPE_LABEL: Record<string, string> = {
  terms: "利用規約",
  privacy: "プライバシーポリシー",
  sensitive_data: "要配慮個人情報（健康情報）の取得への同意",
};

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-6 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-6 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-6 list-decimal">$2</li>')
    // 規約 v2.0 の本文で使う "- " 箇条書き。数字リストと同じ要領で <li> に変換する
    // (sanitizeHtml の ALLOWED_TAGS に li / class は含まれているため表示は壊れない)。
    .replace(/^- (.+)$/gm, '<li class="ml-6 list-disc">$1</li>')
    .replace(/\n/g, "<br />");
}

export default function TermsViewer() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute("/terms/:docType");
  const docType = params?.docType ?? "";

  const { data, isLoading, error } = useQuery<{ version: { docType: string; version: string; content: string | null } }>({
    queryKey: ["terms", "content", docType],
    queryFn: async () => {
      const res = await fetch(`/api/terms/${docType}/content`);
      if (!res.ok) throw new Error("ドキュメントの取得に失敗しました");
      return res.json();
    },
    enabled: !!docType,
  });

  if (!match) return null;

  const title = DOC_TYPE_LABEL[docType] ?? docType;

  return (
    <div className="min-h-[100svh] bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/register")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          戻る
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            )}
            {!isLoading && data?.version?.content && (
              <div
                className="prose dark:prose-invert max-w-none text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMarkdown(data.version.content)) }}
              />
            )}
            {!isLoading && !data?.version?.content && (error || data) && (
              <>
                {/* BUG-017: 取得失敗 or 本文未登録時のフォールバック。
                    管理者が登録するまで完全に空白にせず、最低限の説明を表示する */}
                {error && (
                  <p className="text-amber-600 dark:text-amber-400 text-center text-sm pb-4">
                    ドキュメントの取得に失敗しました。一時的に内容を取得できないため、最新版は管理者にお問い合わせください。
                  </p>
                )}
                {!error && (
                  <p className="text-muted-foreground text-center text-sm pb-4">
                    本文はまだ登録されていません。
                  </p>
                )}
                {FALLBACK_TERMS[docType] && (
                  <div
                    className="prose dark:prose-invert max-w-none text-sm leading-relaxed border-t pt-4 mt-2"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMarkdown(FALLBACK_TERMS[docType])) }}
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
