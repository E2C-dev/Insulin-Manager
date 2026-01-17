import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, TrendingUp } from "lucide-react";

export default function Dashboard() {
  return (
    <AppLayout>
      <div className="pt-6 px-6 pb-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">ダッシュボード</h1>
          <p className="text-muted-foreground text-sm">
            インスリン記録帳の概要
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                今日の記録
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground mt-1">
                まだ記録がありません
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                平均血糖値
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground mt-1">
                データがありません
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>スプレッドシート形式の記録帳</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              朝・昼・夕・眠前の投与量と血糖値測定を記録します
            </p>
            <div className="text-center py-8 text-muted-foreground">
              実装中...
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
