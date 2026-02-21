import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, TrendingUp, BookOpen, Plus, Syringe, AlertTriangle } from "lucide-react";
import { format, subDays, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Link } from "wouter";
import { type ApiGlucoseEntry, type ApiInsulinEntry, getGlucoseBasicColor } from "@/lib/types";

export default function Dashboard() {
  const today = format(new Date(), "yyyy-MM-dd");
  const sevenDaysAgo = format(subDays(new Date(), 6), "yyyy-MM-dd");

  const { data: glucoseData, isLoading: glucoseLoading } = useQuery({
    queryKey: ["glucose-entries"],
    queryFn: async () => {
      const response = await fetch("/api/glucose-entries", { credentials: "include" });
      if (!response.ok) throw new Error("血糖値記録の取得に失敗しました");
      const data = await response.json();
      return data.entries as ApiGlucoseEntry[];
    },
  });

  const { data: insulinData, isLoading: insulinLoading } = useQuery({
    queryKey: ["insulin-entries"],
    queryFn: async () => {
      const response = await fetch("/api/insulin-entries", { credentials: "include" });
      if (!response.ok) throw new Error("インスリン記録の取得に失敗しました");
      const data = await response.json();
      return data.entries as ApiInsulinEntry[];
    },
  });

  const isLoading = glucoseLoading || insulinLoading;

  // 今日の記録数
  const todayGlucoseCount = glucoseData?.filter(e => e.date === today).length ?? 0;
  const todayInsulinCount = insulinData?.filter(e => e.date === today).length ?? 0;
  const todayTotal = todayGlucoseCount + todayInsulinCount;

  // 直近7日間の平均血糖値
  const recentGlucose = glucoseData?.filter(e => e.date >= sevenDaysAgo) ?? [];
  const avgGlucose = recentGlucose.length > 0
    ? Math.round(recentGlucose.reduce((sum, e) => sum + e.glucoseLevel, 0) / recentGlucose.length)
    : null;

  // 直近7日間の最新血糖値（今日の最後）
  const todayGlucoseEntries = glucoseData?.filter(e => e.date === today) ?? [];
  const latestGlucose = todayGlucoseEntries.length > 0
    ? todayGlucoseEntries[todayGlucoseEntries.length - 1]?.glucoseLevel
    : null;

  // 直近7日間の記録日リスト
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
    const hasGlucose = glucoseData?.some(e => e.date === date) ?? false;
    const hasInsulin = insulinData?.some(e => e.date === date) ?? false;
    return { date, hasRecord: hasGlucose || hasInsulin };
  });

  // 低血糖アラート（今日の血糖値で70未満がある）
  const lowGlucoseToday = todayGlucoseEntries.some(e => e.glucoseLevel < 70);

  return (
    <AppLayout>
      <div className="pt-6 px-6 pb-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">ダッシュボード</h1>
          <p className="text-muted-foreground text-sm">
            {format(new Date(), "M月d日 (E)", { locale: ja })} の概要
          </p>
        </div>

        {/* 低血糖アラート */}
        {lowGlucoseToday && (
          <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-900 dark:text-red-100">本日、低血糖の記録があります</p>
              <p className="text-xs text-red-700 dark:text-red-300">血糖値が70mg/dL未満の測定値があります</p>
            </div>
          </div>
        )}

        {/* 主要統計カード */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                今日の記録
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-2xl font-bold text-muted-foreground">...</div>
              ) : (
                <>
                  <div className="text-2xl font-bold">{todayTotal}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {todayTotal === 0 ? "まだ記録がありません" : `血糖値${todayGlucoseCount}件・インスリン${todayInsulinCount}件`}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                7日間平均血糖値
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-2xl font-bold text-muted-foreground">...</div>
              ) : avgGlucose !== null ? (
                <>
                  <div className={`text-2xl font-bold ${getGlucoseBasicColor(avgGlucose)}`}>
                    {avgGlucose}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">mg/dL（{recentGlucose.length}件の平均）</p>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold text-muted-foreground">-</div>
                  <p className="text-xs text-muted-foreground mt-1">データがありません</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 本日の最新血糖値 */}
        {latestGlucose !== null && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                本日の最新血糖値
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${getGlucoseBasicColor(latestGlucose)}`}>
                {latestGlucose}
                <span className="text-base font-normal text-muted-foreground ml-1">mg/dL</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 直近7日間の記録状況 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              直近7日間の記録
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {last7Days.map(({ date, hasRecord }) => {
                const isToday = date === today;
                const dayLabel = format(parseISO(date), "E", { locale: ja });
                const dateLabel = format(parseISO(date), "d");
                return (
                  <div key={date} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">{dayLabel}</span>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold
                        ${isToday ? "ring-2 ring-primary ring-offset-1" : ""}
                        ${hasRecord ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                    >
                      {dateLabel}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-primary"></div>
                <span>記録あり</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-muted"></div>
                <span>記録なし</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* クイックアクション */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground">クイックアクション</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/entry">
              <Button className="w-full h-auto py-4 flex-col gap-2" size="lg">
                <Plus className="w-5 h-5" />
                <span className="text-sm">新規記録</span>
              </Button>
            </Link>
            <Link href="/logbook">
              <Button variant="outline" className="w-full h-auto py-4 flex-col gap-2" size="lg">
                <BookOpen className="w-5 h-5" />
                <span className="text-sm">記録ノート</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
