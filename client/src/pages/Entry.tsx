import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";

export default function Entry() {
  return (
    <AppLayout>
      <div className="pt-6 px-6 pb-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">記録入力</h1>
          <p className="text-muted-foreground text-sm">
            インスリン投与量と血糖値を記録
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-primary" />
              新しい記録を追加
            </CardTitle>
            <CardDescription>
              スプレッドシート形式で記録を入力します
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <p className="mb-4">実装中...</p>
              <p className="text-sm">
                朝・昼・夕・眠前の投与量と各測定タイミングの血糖値を入力できます
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
