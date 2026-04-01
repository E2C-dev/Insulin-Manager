import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

const DOC_TYPE_LABEL: Record<string, string> = {
  terms: "利用規約",
  privacy: "プライバシーポリシー",
};

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-6 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-6 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-6 list-decimal">$2</li>')
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
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
            {error && (
              <p className="text-red-600 text-center py-8">ドキュメントの取得に失敗しました。</p>
            )}
            {data?.version?.content && (
              <div
                className="prose dark:prose-invert max-w-none text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(data.version.content) }}
              />
            )}
            {data && !data.version?.content && (
              <p className="text-muted-foreground text-center py-8">本文はまだ登録されていません。</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
