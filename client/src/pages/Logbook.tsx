import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdBanner } from "@/components/AdBanner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Plus, Calendar, Coffee, Sun, Sunset, Moon, Activity, Trash2, Edit2, Download, FileText, Sheet } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, differenceInDays } from "date-fns";
import { Link } from "wouter";
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
import { type ApiGlucoseEntry, type ApiInsulinEntry, type DailyEntry } from "@/lib/types";
import { getGlucoseStatusColorClass, getGlucoseStatusLabel } from "@/lib/glucoseStatus";
import { safeFormat, formatJstDate } from "@/lib/date-utils";
import { QUERY_KEYS } from "@/lib/query-keys";
import { exportLogbookToPDF } from "@/lib/pdfExport";
import { useAuth } from "@/hooks/use-auth";

export default function Logbook() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  // PDF出力の90日超警告ダイアログ (BUG-008)
  const [isPdfWarnOpen, setIsPdfWarnOpen] = useState(false);
  const [pendingPdfDays, setPendingPdfDays] = useState<number>(0);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingEntry, setDeletingEntry] = useState<{ date: string; glucoseIds: string[]; insulinIds: string[] } | null>(null);

  const today = formatJstDate(new Date());

  const { data: glucoseData, isLoading: glucoseLoading } = useQuery({
    queryKey: QUERY_KEYS.GLUCOSE_ENTRIES,
    queryFn: async () => {
      const response = await fetch("/api/glucose-entries", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("血糖値記録の取得に失敗しました");
      const data = await response.json();
      return data.entries as ApiGlucoseEntry[];
    },
  });

  const { data: insulinData, isLoading: insulinLoading } = useQuery({
    queryKey: QUERY_KEYS.INSULIN_ENTRIES,
    queryFn: async () => {
      const response = await fetch("/api/insulin-entries", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("インスリン記録の取得に失敗しました");
      const data = await response.json();
      return data.entries as ApiInsulinEntry[];
    },
  });

  const deleteGlucoseMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/glucose-entries/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("削除に失敗しました");
      return id;
    },
  });

  const deleteInsulinMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/insulin-entries/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("削除に失敗しました");
      return id;
    },
  });

  // 全日程（記録なし含む）を返す。
  // Sprint 3 (S3-5): useMemo 化。
  // 旧: 関数として定義し、レンダー毎・呼び出し毎に for ループを再実行 (1ヶ月=30回)。
  // 新: glucoseData / insulinData / viewMode が変わったときだけ再計算する。
  // 呼び出し側は processedEntries (値) を直接参照する。
  const processedEntries = useMemo<(DailyEntry & { hasAnyRecord: boolean })[]>(() => {
    const days = viewMode === "week" ? 7 : 30;
    const entriesMap = new Map<string, DailyEntry>();

    for (let i = 0; i < days; i++) {
      const date = format(subDays(new Date(), i), "yyyy-MM-dd");
      entriesMap.set(date, {
        date,
        morning: {},
        lunch: {},
        dinner: {},
        bedtime: {},
        glucoseIds: [],
        insulinIds: [],
      });
    }

    if (glucoseData) {
      for (const entry of glucoseData) {
        const dailyEntry = entriesMap.get(entry.date);
        if (dailyEntry) {
          (dailyEntry.glucoseIds ??= []).push(entry.id);
          switch (entry.timeSlot) {
            case "BreakfastBefore":
              dailyEntry.morning.glucoseBefore = entry.glucoseLevel;
              break;
            case "BreakfastAfter1h":
              dailyEntry.morning.glucoseAfter = entry.glucoseLevel;
              break;
            case "LunchBefore":
              dailyEntry.lunch.glucoseBefore = entry.glucoseLevel;
              break;
            case "LunchAfter1h":
              dailyEntry.lunch.glucoseAfter = entry.glucoseLevel;
              break;
            case "DinnerBefore":
              dailyEntry.dinner.glucoseBefore = entry.glucoseLevel;
              break;
            case "DinnerAfter1h":
              dailyEntry.dinner.glucoseAfter = entry.glucoseLevel;
              break;
            case "BeforeSleep":
              dailyEntry.bedtime.glucose = entry.glucoseLevel;
              break;
          }
        }
      }
    }

    if (insulinData) {
      for (const entry of insulinData) {
        const dailyEntry = entriesMap.get(entry.date);
        if (dailyEntry) {
          (dailyEntry.insulinIds ??= []).push(entry.id);
          const units = parseFloat(entry.units);
          switch (entry.timeSlot) {
            case "Breakfast":
              dailyEntry.morning.insulin = units;
              dailyEntry.morning.insulinId = entry.id;
              break;
            case "Lunch":
              dailyEntry.lunch.insulin = units;
              dailyEntry.lunch.insulinId = entry.id;
              break;
            case "Dinner":
              dailyEntry.dinner.insulin = units;
              dailyEntry.dinner.insulinId = entry.id;
              break;
            case "Bedtime":
              dailyEntry.bedtime.insulin = units;
              dailyEntry.bedtime.insulinId = entry.id;
              break;
          }
        }
      }
    }

    return Array.from(entriesMap.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(entry => ({
        ...entry,
        hasAnyRecord:
          (entry.glucoseIds?.length ?? 0) > 0 || (entry.insulinIds?.length ?? 0) > 0 ||
          !!entry.morning.glucoseBefore || !!entry.morning.glucoseAfter || !!entry.morning.insulin ||
          !!entry.lunch.glucoseBefore || !!entry.lunch.glucoseAfter || !!entry.lunch.insulin ||
          !!entry.dinner.glucoseBefore || !!entry.dinner.glucoseAfter || !!entry.dinner.insulin ||
          !!entry.bedtime.glucose || !!entry.bedtime.insulin,
      }));
  }, [glucoseData, insulinData, viewMode]);

  const handleDeleteClick = (entry: DailyEntry, event: React.MouseEvent) => {
    event.stopPropagation();
    setDeletingEntry({
      date: entry.date,
      glucoseIds: entry.glucoseIds ?? [],
      insulinIds: entry.insulinIds ?? [],
    });
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingEntry) return;

    try {
      const deletePromises = [
        ...deletingEntry.glucoseIds.map(id => deleteGlucoseMutation.mutateAsync(id)),
        ...deletingEntry.insulinIds.map(id => deleteInsulinMutation.mutateAsync(id)),
      ];

      await Promise.all(deletePromises);

      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GLUCOSE_ENTRIES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.INSULIN_ENTRIES });

      toast({
        title: "削除成功",
        description: `${safeFormat(deletingEntry.date, "M月d日")}の記録を削除しました`,
      });
    } catch (error) {
      toast({
        title: "削除失敗",
        description: "記録の削除に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setDeletingEntry(null);
    }
  };

  // 血糖値レベルのラベルを返す（異常値のみ）。閾値判定は glucoseStatus.ts に統合済み。
  const getGlucoseLabel = (value?: number) => {
    const status = getGlucoseStatusLabel(value);
    if (status === "低") return <span className="text-xs font-semibold text-red-600 ml-0.5">低</span>;
    if (status === "高") return <span className="text-xs font-semibold text-amber-600 ml-0.5">高</span>;
    return null;
  };

  // 編集画面に遷移（記録入力画面で編集）
  const handleEditClick = (date: string, timeSlot: string, event: React.MouseEvent) => {
    event.stopPropagation();
    window.location.href = `/entry?date=${date}&timeSlot=${timeSlot}`;
  };

  // CSVエクスポート（ブラウザのみで完結）
  const handleExportCSV = () => {
    const entries = processedEntries;
    const header = [
      "日付",
      "朝食(食前血糖mg/dL)",
      "朝食(食後血糖mg/dL)",
      "朝食(インスリンu)",
      "昼食(食前血糖mg/dL)",
      "昼食(食後血糖mg/dL)",
      "昼食(インスリンu)",
      "夕食(食前血糖mg/dL)",
      "夕食(食後血糖mg/dL)",
      "夕食(インスリンu)",
      "眠前(血糖mg/dL)",
      "眠前(インスリンu)",
    ].join(",");

    const rows = entries.map(e =>
      [
        e.date,
        e.morning.glucoseBefore ?? "",
        e.morning.glucoseAfter ?? "",
        e.morning.insulin ?? "",
        e.lunch.glucoseBefore ?? "",
        e.lunch.glucoseAfter ?? "",
        e.lunch.insulin ?? "",
        e.dinner.glucoseBefore ?? "",
        e.dinner.glucoseAfter ?? "",
        e.dinner.insulin ?? "",
        e.bedtime.glucose ?? "",
        e.bedtime.insulin ?? "",
      ].join(",")
    );

    const csvContent = "\uFEFF" + [header, ...rows].join("\n"); // BOM付きでExcel対応
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const rangeLabel = viewMode === "week" ? "1週間" : "1ヶ月";
    link.download = `血糖値記録_${rangeLabel}_${format(new Date(), "yyyyMMdd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({ title: "CSV出力完了", description: "ファイルをダウンロードしました" });
  };

  /**
   * PDF出力を実行する内部関数。差分90日超のときは AlertDialog で警告
   * (BUG-008)。viewMode が week/month の現状は最大30日で警告は出ないが、
   * 将来 viewMode 拡張に備えて期間判定を実装している。
   *
   * Sprint 2.5: window.print() ではなく client/src/lib/pdfExport.ts の
   * exportLogbookToPDF を呼び出して jsPDF でA4 PDFを直接生成する。
   * processedEntries (Sprint 3 で useMemo 化) が返す配列は pdfExport.ts 側の
   * DailyEntry interface (subset) と構造的にcompatible。
   */
  const runExportPdf = async () => {
    try {
      const dailyEntries = processedEntries;
      // 記録のある日だけPDFに含める（空白行で埋め尽くされたPDFを避ける）
      const meaningful = dailyEntries.filter(e => e.hasAnyRecord);
      // 全期間で記録ゼロなら PDF を生成しない（runExportPdf 呼び出し前にUIで
      // hasAnyRecordAtAll をガードしているが、念のため二重チェック）
      if (meaningful.length === 0) {
        toast({
          title: "PDF出力できません",
          description: "表示中の期間に記録がありません。",
          variant: "destructive",
        });
        return;
      }
      const username = user?.username ?? "ユーザー";
      await exportLogbookToPDF(meaningful, username);
      toast({
        title: "PDF出力完了",
        description: "ファイルをダウンロードしました",
      });
    } catch (err) {
      console.error('[pdf-export] failed:', err);
      toast({
        title: "PDF出力に失敗しました",
        description: "時間をおいて再度お試しください。",
        variant: "destructive",
      });
    }
  };

  const handleExportPDF = () => {
    // 表示中の期間 (week=7日 / month=30日 / 将来拡張時はここを書き換える)
    const startDate = subDays(new Date(), viewMode === "week" ? 7 : 30);
    let days = differenceInDays(new Date(), startDate);

    // E2E テスト専用フック: 現状の UI は week(7日)/month(30日) しか選べず、
    // 90日超のケースを通常操作で再現できない (将来のカスタム期間選択拡張の
    // ための準備コード)。Playwright から `?e2eForceDays=95` を付けて遷移した
    // 時だけ days を上書きし、警告ダイアログの表示を決定的に検証できるように
    // する。import.meta.env.DEV 分岐のみなので本番ビルドには含まれない。
    if (import.meta.env.DEV) {
      const override = new URLSearchParams(window.location.search).get("e2eForceDays");
      if (override) {
        const forced = parseInt(override, 10);
        if (!Number.isNaN(forced)) days = forced;
      }
    }

    if (days > 90) {
      setPendingPdfDays(days);
      setIsPdfWarnOpen(true);
      return;
    }
    runExportPdf();
  };

  const confirmExportPdfAfterWarning = () => {
    setIsPdfWarnOpen(false);
    runExportPdf();
  };

  const isLoading = glucoseLoading || insulinLoading;
  const isDeleting = deleteGlucoseMutation.isPending || deleteInsulinMutation.isPending;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]" data-testid="loading-state">
          <Spinner />
        </div>
      </AppLayout>
    );
  }

  const entries = processedEntries;
  const hasAnyRecordAtAll = entries.some(e => e.hasAnyRecord);

  return (
    <AppLayout>
      <div className="pt-6 px-6 pb-6 space-y-6">
        <PageHeader
          title="記録ノート"
          subtitle="日々の血糖値とインスリン記録"
          action={
            <Link href="/entry" data-testid="link-new-entry">
              <Button size="lg" className="shadow-lg" data-testid="button-new-entry">
                <Plus className="w-5 h-5 mr-2" />
                新規記録
              </Button>
            </Link>
          }
        />

        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button
              variant={viewMode === "week" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("week")}
              data-testid="button-view-week"
            >
              <Calendar className="w-4 h-4 mr-1.5" />
              1週間
            </Button>
            <Button
              variant={viewMode === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("month")}
              data-testid="button-view-month"
            >
              <Calendar className="w-4 h-4 mr-1.5" />
              1ヶ月
            </Button>
          </div>
          {hasAnyRecordAtAll && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-muted-foreground"
                  data-testid="button-export-dropdown"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  出力
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCSV} data-testid="menu-item-export-csv">
                  <Sheet className="w-4 h-4 mr-2" />
                  CSVで出力
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF} data-testid="menu-item-export-pdf">
                  <FileText className="w-4 h-4 mr-2" />
                  PDFで出力
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              記録一覧
            </CardTitle>
            <CardDescription>
              血糖値：食前/食後（mg/dL）、インスリン（u）
            </CardDescription>

            <div className="pt-3 mt-3 border-t space-y-3">
              {/* 血糖値の目安 */}
              <div>
                <p className="text-xs font-semibold mb-2 text-muted-foreground">血糖値の目安</p>
                <div className="flex flex-wrap gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-600"></div>
                    <span className="text-muted-foreground">70未満：低血糖</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-600"></div>
                    <span className="text-muted-foreground">70-180：目標範囲</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-600"></div>
                    <span className="text-muted-foreground">180超：高血糖</span>
                  </div>
                </div>
              </div>

              {/* 単位の説明 */}
              <div className="flex items-center gap-2 text-xs bg-muted/30 p-2 rounded">
                <span className="font-semibold text-muted-foreground">表示単位：</span>
                <div className="flex gap-3">
                  <span className="text-muted-foreground">血糖値 = mg/dL</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">
                    インスリン = <span className="text-primary font-semibold">u</span>（単位 / unit）
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!hasAnyRecordAtAll ? (
              <div className="text-center py-12 text-muted-foreground p-6" data-testid="empty-state">
                <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="mb-2" data-testid="text-empty-message">記録がまだありません</p>
                <p className="text-sm" data-testid="text-empty-hint">
                  「新規記録」ボタンから記録を追加してください
                </p>
              </div>
            ) : (
              <div className="w-full">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b sticky top-0">
                    <tr>
                      <th className="p-2 text-left font-semibold w-[90px]">
                        日付
                      </th>
                      <th className="p-2 text-center font-semibold border-l">
                        <div className="flex flex-col items-center gap-1">
                          <Coffee className="w-3 h-3 text-orange-500" />
                          <span className="text-xs">朝食</span>
                        </div>
                      </th>
                      <th className="p-2 text-center font-semibold border-l">
                        <div className="flex flex-col items-center gap-1">
                          <Sun className="w-3 h-3 text-yellow-500" />
                          <span className="text-xs">昼食</span>
                        </div>
                      </th>
                      <th className="p-2 text-center font-semibold border-l">
                        <div className="flex flex-col items-center gap-1">
                          <Sunset className="w-3 h-3 text-purple-500" />
                          <span className="text-xs">夕食</span>
                        </div>
                      </th>
                      <th className="p-2 text-center font-semibold border-l">
                        <div className="flex flex-col items-center gap-1">
                          <Moon className="w-3 h-3 text-blue-500" />
                          <span className="text-xs">眠前</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => {
                      const isToday = entry.date === today;
                      const rowBg = isToday
                        ? "bg-primary/5"
                        : entry.hasAnyRecord
                          ? "bg-white dark:bg-background"
                          : "bg-muted/10";

                      return (
                        <tr key={entry.date} className={rowBg} data-testid={`row-entry-${entry.date}`}>
                          <td className={`p-2 text-left font-medium border-b text-[11px] ${isToday ? "border-l-2 border-l-primary" : ""}`}>
                            <div className="flex items-center justify-between gap-1">
                              <div data-testid={`text-date-${entry.date}`}>
                                {isToday && (
                                  <div className="text-xs text-primary font-bold mb-0.5">今日</div>
                                )}
                                {safeFormat(entry.date, "M/d\n(E)").split('\n').map((line, i) => (
                                  <div key={i} className={!entry.hasAnyRecord ? "text-muted-foreground/50" : ""}>{line}</div>
                                ))}
                              </div>
                              {entry.hasAnyRecord && (
                                <button
                                  onClick={(e) => handleDeleteClick(entry, e)}
                                  className="p-2.5 hover:bg-destructive/10 active:bg-destructive/20 rounded touch-manipulation"
                                  title="この日の記録を削除"
                                  data-testid={`button-delete-${entry.date}`}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive/50 hover:text-destructive" />
                                </button>
                              )}
                            </div>
                          </td>

                          <td className="p-1.5 border-b border-l text-center" data-testid={`cell-morning-${entry.date}`}>
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="flex flex-col items-center gap-0.5">
                                <div className="flex items-center gap-0.5 text-xs">
                                  <span className={`font-semibold ${getGlucoseStatusColorClass(entry.morning.glucoseBefore)}`} data-testid={`text-morning-glucose-before-${entry.date}`}>
                                    {entry.morning.glucoseBefore || "-"}
                                  </span>
                                  {getGlucoseLabel(entry.morning.glucoseBefore)}
                                </div>
                                <div className="flex items-center gap-0.5 text-xs">
                                  <span className={`font-semibold ${getGlucoseStatusColorClass(entry.morning.glucoseAfter)}`} data-testid={`text-morning-glucose-after-${entry.date}`}>
                                    {entry.morning.glucoseAfter || "-"}
                                  </span>
                                  {getGlucoseLabel(entry.morning.glucoseAfter)}
                                </div>
                              </div>
                              {entry.morning.insulin ? (
                                <div className="flex items-center gap-0.5">
                                  <span className="text-xs text-primary font-semibold" data-testid={`text-morning-insulin-${entry.date}`}>
                                    {entry.morning.insulin}u
                                  </span>
                                  <button
                                    onClick={(e) => handleEditClick(entry.date, "BreakfastBefore", e)}
                                    className="p-2.5 hover:bg-blue-100 active:bg-blue-200 rounded touch-manipulation"
                                    title="編集"
                                  >
                                    <Edit2 className="w-4 h-4 text-blue-400 hover:text-blue-600" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </div>
                          </td>

                          <td className="p-1.5 border-b border-l text-center" data-testid={`cell-lunch-${entry.date}`}>
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="flex flex-col items-center gap-0.5">
                                <div className="flex items-center gap-0.5 text-xs">
                                  <span className={`font-semibold ${getGlucoseStatusColorClass(entry.lunch.glucoseBefore)}`} data-testid={`text-lunch-glucose-before-${entry.date}`}>
                                    {entry.lunch.glucoseBefore || "-"}
                                  </span>
                                  {getGlucoseLabel(entry.lunch.glucoseBefore)}
                                </div>
                                <div className="flex items-center gap-0.5 text-xs">
                                  <span className={`font-semibold ${getGlucoseStatusColorClass(entry.lunch.glucoseAfter)}`} data-testid={`text-lunch-glucose-after-${entry.date}`}>
                                    {entry.lunch.glucoseAfter || "-"}
                                  </span>
                                  {getGlucoseLabel(entry.lunch.glucoseAfter)}
                                </div>
                              </div>
                              {entry.lunch.insulin ? (
                                <div className="flex items-center gap-0.5">
                                  <span className="text-xs text-primary font-semibold" data-testid={`text-lunch-insulin-${entry.date}`}>
                                    {entry.lunch.insulin}u
                                  </span>
                                  <button
                                    onClick={(e) => handleEditClick(entry.date, "LunchBefore", e)}
                                    className="p-2.5 hover:bg-blue-100 active:bg-blue-200 rounded touch-manipulation"
                                    title="編集"
                                  >
                                    <Edit2 className="w-4 h-4 text-blue-400 hover:text-blue-600" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </div>
                          </td>

                          <td className="p-1.5 border-b border-l text-center" data-testid={`cell-dinner-${entry.date}`}>
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="flex flex-col items-center gap-0.5">
                                <div className="flex items-center gap-0.5 text-xs">
                                  <span className={`font-semibold ${getGlucoseStatusColorClass(entry.dinner.glucoseBefore)}`} data-testid={`text-dinner-glucose-before-${entry.date}`}>
                                    {entry.dinner.glucoseBefore || "-"}
                                  </span>
                                  {getGlucoseLabel(entry.dinner.glucoseBefore)}
                                </div>
                                <div className="flex items-center gap-0.5 text-xs">
                                  <span className={`font-semibold ${getGlucoseStatusColorClass(entry.dinner.glucoseAfter)}`} data-testid={`text-dinner-glucose-after-${entry.date}`}>
                                    {entry.dinner.glucoseAfter || "-"}
                                  </span>
                                  {getGlucoseLabel(entry.dinner.glucoseAfter)}
                                </div>
                              </div>
                              {entry.dinner.insulin ? (
                                <div className="flex items-center gap-0.5">
                                  <span className="text-xs text-primary font-semibold" data-testid={`text-dinner-insulin-${entry.date}`}>
                                    {entry.dinner.insulin}u
                                  </span>
                                  <button
                                    onClick={(e) => handleEditClick(entry.date, "DinnerBefore", e)}
                                    className="p-2.5 hover:bg-blue-100 active:bg-blue-200 rounded touch-manipulation"
                                    title="編集"
                                  >
                                    <Edit2 className="w-4 h-4 text-blue-400 hover:text-blue-600" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </div>
                          </td>

                          <td className="p-1.5 border-b border-l text-center" data-testid={`cell-bedtime-${entry.date}`}>
                            <div className="flex flex-col items-center gap-0.5">
                              <div className="flex items-center gap-0.5 text-xs">
                                <span className={`font-semibold ${getGlucoseStatusColorClass(entry.bedtime.glucose)}`} data-testid={`text-bedtime-glucose-${entry.date}`}>
                                  {entry.bedtime.glucose || "-"}
                                </span>
                                {getGlucoseLabel(entry.bedtime.glucose)}
                              </div>
                              {entry.bedtime.insulin ? (
                                <div className="flex items-center gap-0.5">
                                  <span className="text-xs text-primary font-semibold" data-testid={`text-bedtime-insulin-${entry.date}`}>
                                    {entry.bedtime.insulin}u
                                  </span>
                                  <button
                                    onClick={(e) => handleEditClick(entry.date, "BeforeSleep", e)}
                                    className="p-2.5 hover:bg-blue-100 active:bg-blue-200 rounded touch-manipulation"
                                    title="編集"
                                  >
                                    <Edit2 className="w-4 h-4 text-blue-400 hover:text-blue-600" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <AdBanner />
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>記録を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingEntry && (
                <>
                  <span className="font-semibold text-foreground" data-testid="text-delete-date">
                    {safeFormat(deletingEntry.date, "yyyy年M月d日 (E)")}
                  </span>
                  の記録をすべて削除します。この操作は取り消せません。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} data-testid="button-cancel-delete">
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {isDeleting ? "削除中..." : "削除する"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PDF出力 90日超 警告ダイアログ (BUG-008) */}
      <AlertDialog open={isPdfWarnOpen} onOpenChange={setIsPdfWarnOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>長期間のPDF出力</AlertDialogTitle>
            <AlertDialogDescription>
              90日を超える期間 (約{pendingPdfDays}日) のPDF出力はブラウザがフリーズする可能性があります。続行しますか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-pdf-warning">
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmExportPdfAfterWarning} data-testid="button-confirm-pdf-warning">
              続行
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
