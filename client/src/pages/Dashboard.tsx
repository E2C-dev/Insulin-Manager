import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdBanner } from "@/components/AdBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, TrendingUp, BookOpen, Flame, AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import { format, subDays, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { type ApiGlucoseEntry, type ApiInsulinEntry, getGlucoseBasicColor } from "@/lib/types";

// 時間帯に応じた挨拶
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 10) return "おはようございます";
  if (hour < 17) return "こんにちは";
  return "こんばんは";
}

// 7日間カレンダーの日付ドットの色を決定
function getDayDotStyle(hasRecord: boolean, avgGlucose: number | null, isToday: boolean): string {
  const ring = isToday ? "ring-2 ring-primary ring-offset-1 " : "";
  if (!hasRecord) return ring + "bg-muted text-muted-foreground";
  if (avgGlucose === null) return ring + "bg-primary text-primary-foreground";
  if (avgGlucose < 70) return ring + "bg-red-500 text-white";
  if (avgGlucose > 180) return ring + "bg-orange-400 text-white";
  return ring + "bg-green-500 text-white";
}

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

  // 直近7日間の平均血糖値
  const recentGlucose = glucoseData?.filter(e => e.date >= sevenDaysAgo) ?? [];
  const avgGlucose = recentGlucose.length > 0
    ? Math.round(recentGlucose.reduce((sum, e) => sum + e.glucoseLevel, 0) / recentGlucose.length)
    : null;

  // 今日の血糖値エントリ
  const todayGlucoseEntries = glucoseData?.filter(e => e.date === today) ?? [];
  const latestGlucose = todayGlucoseEntries.length > 0
    ? todayGlucoseEntries[todayGlucoseEntries.length - 1]?.glucoseLevel
    : null;

  // 低血糖アラート
  const lowGlucoseToday = todayGlucoseEntries.some(e => e.glucoseLevel < 70);

  // 今日の投与状況（4タイムスロット）
  const todayInsulinEntries = insulinData?.filter(e => e.date === today) ?? [];
  const doseSlots: { slot: string; label: string; icon: string }[] = [
    { slot: "Breakfast", label: "朝", icon: "☀️" },
    { slot: "Lunch",     label: "昼", icon: "🌤️" },
    { slot: "Dinner",    label: "夕", icon: "🌆" },
    { slot: "Bedtime",   label: "眠前", icon: "🌙" },
  ];
  const doseStatus = doseSlots.map(({ slot, label, icon }) => {
    const entry = todayInsulinEntries.find(e => e.timeSlot === slot);
    return { label, icon, units: entry ? parseFloat(entry.units) : null };
  });
  const hasTodayInsulin = doseStatus.some(d => d.units !== null);

  // 直近7日間カレンダー（日ごとの平均血糖値付き）
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
    const dayGlucose = glucoseData?.filter(e => e.date === date) ?? [];
    const hasGlucose = dayGlucose.length > 0;
    const hasInsulin = insulinData?.some(e => e.date === date) ?? false;
    const dayAvg = dayGlucose.length > 0
      ? Math.round(dayGlucose.reduce((sum, e) => sum + e.glucoseLevel, 0) / dayGlucose.length)
      : null;
    return { date, hasRecord: hasGlucose || hasInsulin, dayAvg };
  });

  // 連続記録ストリーク（今日から遡って記録がある連続日数）
  const streak = (() => {
    let count = 0;
    for (let i = 0; i < 365; i++) {
      const date = format(subDays(new Date(), i), "yyyy-MM-dd");
      const hasGlucose = glucoseData?.some(e => e.date === date) ?? false;
      const hasInsulin = insulinData?.some(e => e.date === date) ?? false;
      if (hasGlucose || hasInsulin) {
        count++;
      } else {
        break;
      }
    }
    return count;
  })();

  return (
    <AppLayout>
      <div className="pt-3 px-3 pb-3 space-y-2.5">

        {/* ヘッダー：挨拶 + 日付 */}
        <div>
          <p className="text-xs text-muted-foreground">{getGreeting()}</p>
          <h1 className="text-lg font-bold tracking-tight">
            {format(new Date(), "M月d日 (E)", { locale: ja })}
          </h1>
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

        {/* 今日の投与チェック */}
        <Card>
          <CardHeader className="pb-1.5 pt-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              今日の投与状況
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            {isLoading ? (
              <div className="grid grid-cols-4 gap-2">
                {doseSlots.map(s => (
                  <div key={s.slot} className="flex flex-col items-center gap-1">
                    <div className="w-7 h-7 rounded-full bg-muted animate-pulse" />
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2">
                  {doseStatus.map(({ label, icon, units }) => (
                    <div key={label} className="flex flex-col items-center gap-1">
                      <div className={`w-10 h-10 rounded-full flex flex-col items-center justify-center border-2 text-xs font-semibold transition-colors
                        ${units !== null
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-muted bg-muted/30 text-muted-foreground"
                        }`}
                      >
                        <span className="text-base leading-none">{icon}</span>
                        {units !== null && (
                          <span className="text-xs leading-none mt-0.5">{units}u</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{label}</span>
                      {units !== null ? (
                        <CheckCircle2 className="w-3 h-3 text-primary" />
                      ) : (
                        <Circle className="w-3 h-3 text-muted-foreground/40" />
                      )}
                    </div>
                  ))}
                </div>
                {!hasTodayInsulin && (
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    今日はまだインスリンの記録がありません
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* 統計：最新血糖値 + 7日間平均 */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Activity className="w-3 h-3" />
                最新血糖値
              </p>
              {isLoading ? (
                <div className="text-2xl font-bold text-muted-foreground">...</div>
              ) : latestGlucose !== null ? (
                <>
                  <div className={`text-2xl font-bold ${getGlucoseBasicColor(latestGlucose)}`}>
                    {latestGlucose}
                  </div>
                  {latestGlucose < 70 && <span className="text-xs font-semibold text-red-600">低</span>}
                  {latestGlucose > 180 && <span className="text-xs font-semibold text-orange-500">高</span>}
                  <p className="text-xs text-muted-foreground">mg/dL</p>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold text-muted-foreground">-</div>
                  <p className="text-xs text-muted-foreground">今日の記録なし</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                7日間平均
              </p>
              {isLoading ? (
                <div className="text-2xl font-bold text-muted-foreground">...</div>
              ) : avgGlucose !== null ? (
                <>
                  <div className={`text-2xl font-bold ${getGlucoseBasicColor(avgGlucose)}`}>
                    {avgGlucose}
                  </div>
                  {avgGlucose < 70 && <span className="text-xs font-semibold text-red-600">低</span>}
                  {avgGlucose > 180 && <span className="text-xs font-semibold text-orange-500">高</span>}
                  <p className="text-xs text-muted-foreground">mg/dL</p>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold text-muted-foreground">-</div>
                  <p className="text-xs text-muted-foreground">データなし</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 直近7日間カレンダー + ストリーク */}
        <Card>
          <CardHeader className="pb-1.5 pt-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                直近7日間の記録
              </CardTitle>
              {streak > 0 && (
                <div className="flex items-center gap-1 text-xs font-semibold text-orange-500">
                  <Flame className="w-4 h-4" />
                  {streak}日連続
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pb-3 px-3">
            <div className="grid grid-cols-7 gap-1">
              {last7Days.map(({ date, hasRecord, dayAvg }) => {
                const isToday = date === today;
                const dayLabel = format(parseISO(date), "E", { locale: ja });
                const dateLabel = format(parseISO(date), "d");
                return (
                  <div key={date} className="flex flex-col items-center gap-1">
                    <span className="text-xs text-muted-foreground">{dayLabel}</span>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold ${getDayDotStyle(hasRecord, dayAvg, isToday)}`}>
                      {dateLabel}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                <span>良好（70-180）</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-400"></div>
                <span>高血糖（180超）</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                <span>低血糖（70未満）</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-muted"></div>
                <span>記録なし</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <AdBanner />
      </div>
    </AppLayout>
  );
}
