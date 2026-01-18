import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Plus, Calendar, Coffee, Sun, Sunset, Moon, Activity, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { format, subDays, startOfDay } from "date-fns";
import { ja } from "date-fns/locale";
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

interface DailyEntry {
  date: string;
  morning: { 
    glucoseBefore?: number;  // 食前血糖値
    glucoseAfter?: number;   // 食後血糖値
    insulin?: number;
  };
  lunch: { 
    glucoseBefore?: number;  // 食前血糖値
    glucoseAfter?: number;   // 食後血糖値
    insulin?: number;
  };
  dinner: { 
    glucoseBefore?: number;  // 食前血糖値
    glucoseAfter?: number;   // 食後血糖値
    insulin?: number;
  };
  bedtime: { 
    glucose?: number;        // 眠前は1回のみ
    insulin?: number;
  };
}

export default function Logbook() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [viewMode, setViewMode] = useState<"week" | "month">("week");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingDate, setDeletingDate] = useState<string | null>(null);

  // 仮のデータ - 実際にはAPIから取得
  const { data: entriesData, isLoading } = useQuery({
    queryKey: ["entries", selectedDate, viewMode],
    queryFn: async () => {
      // 仮データを返す
      const entries: DailyEntry[] = [];
      const days = viewMode === "week" ? 7 : 30;
      
      for (let i = 0; i < days; i++) {
        const date = format(subDays(new Date(), i), "yyyy-MM-dd");
        entries.push({
          date,
          morning: { 
            glucoseBefore: 95 + Math.floor(Math.random() * 40),
            glucoseAfter: 120 + Math.floor(Math.random() * 50),
            insulin: 5 + Math.floor(Math.random() * 3)
          },
          lunch: { 
            glucoseBefore: 100 + Math.floor(Math.random() * 50),
            glucoseAfter: 130 + Math.floor(Math.random() * 60),
            insulin: 6 + Math.floor(Math.random() * 4)
          },
          dinner: { 
            glucoseBefore: 105 + Math.floor(Math.random() * 45),
            glucoseAfter: 125 + Math.floor(Math.random() * 55),
            insulin: 7 + Math.floor(Math.random() * 3)
          },
          bedtime: { 
            glucose: 100 + Math.floor(Math.random() * 40),
            insulin: 8 + Math.floor(Math.random() * 2)
          },
        });
      }
      
      return { entries };
    },
  });

  // 削除用のMutation
  const deleteMutation = useMutation({
    mutationFn: async (date: string) => {
      // 実際にはAPIを呼び出す
      console.log("削除する日付:", date);
      await new Promise(resolve => setTimeout(resolve, 500));
      return date;
    },
    onSuccess: (deletedDate) => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      toast({
        title: "削除成功",
        description: `${format(new Date(deletedDate), "M月d日", { locale: ja })}の記録を削除しました`,
      });
      setIsDeleteDialogOpen(false);
      setDeletingDate(null);
    },
    onError: (error: Error) => {
      toast({
        title: "削除失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getGlucoseColor = (value?: number) => {
    if (!value) return "text-muted-foreground";
    if (value < 70) return "text-red-600 font-semibold";
    if (value > 180) return "text-orange-600 font-semibold";
    return "text-green-600";
  };

  const handleDeleteClick = (date: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setDeletingDate(date);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingDate) {
      deleteMutation.mutate(deletingDate);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Spinner />
        </div>
      </AppLayout>
    );
  }

  const entries = entriesData?.entries || [];

  return (
    <AppLayout>
      <div className="pt-6 px-6 pb-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">記録ノート</h1>
            <p className="text-muted-foreground text-sm">
              日々の血糖値とインスリン記録
            </p>
          </div>
          
          <Button size="lg" className="shadow-lg">
            <Plus className="w-5 h-5 mr-2" />
            新規記録
          </Button>
        </div>

        {/* 期間選択 */}
        <div className="flex gap-2">
          <Button
            variant={viewMode === "week" ? "default" : "outline"}
            onClick={() => setViewMode("week")}
          >
            <Calendar className="w-4 h-4 mr-2" />
            1週間
          </Button>
          <Button
            variant={viewMode === "month" ? "default" : "outline"}
            onClick={() => setViewMode("month")}
          >
            <Calendar className="w-4 h-4 mr-2" />
            1ヶ月
          </Button>
        </div>

        {/* コンパクトな表形式の記録一覧 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              記録一覧
            </CardTitle>
            <CardDescription>
              血糖値：食前/食後（mg/dL）、インスリン（単位）
            </CardDescription>
            
            {/* 血糖値の目安 */}
            <div className="pt-3 mt-3 border-t">
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
          </CardHeader>
          <CardContent className="p-0">
            {entries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground p-6">
                <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="mb-2">記録がまだありません</p>
                <p className="text-sm">
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
                          <span className="text-[10px]">朝食</span>
                        </div>
                      </th>
                      <th className="p-2 text-center font-semibold border-l">
                        <div className="flex flex-col items-center gap-1">
                          <Sun className="w-3 h-3 text-yellow-500" />
                          <span className="text-[10px]">昼食</span>
                        </div>
                      </th>
                      <th className="p-2 text-center font-semibold border-l">
                        <div className="flex flex-col items-center gap-1">
                          <Sunset className="w-3 h-3 text-purple-500" />
                          <span className="text-[10px]">夕食</span>
                        </div>
                      </th>
                      <th className="p-2 text-center font-semibold border-l">
                        <div className="flex flex-col items-center gap-1">
                          <Moon className="w-3 h-3 text-blue-500" />
                          <span className="text-[10px]">眠前</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, index) => (
                      <tr key={entry.date} className={index % 2 === 0 ? "bg-white dark:bg-background" : "bg-muted/20"}>
                        <td className="p-2 text-left font-medium border-b text-[11px] group">
                          <div className="flex items-center justify-between gap-1">
                            <div>
                              {format(new Date(entry.date), "M/d\n(E)", { locale: ja }).split('\n').map((line, i) => (
                                <div key={i}>{line}</div>
                              ))}
                            </div>
                            <button
                              onClick={(e) => handleDeleteClick(entry.date, e)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded"
                              title="この日の記録を削除"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </button>
                          </div>
                        </td>
                        
                        {/* 朝食 */}
                        <td className="p-1.5 border-b border-l text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className={`font-semibold ${getGlucoseColor(entry.morning.glucoseBefore)}`}>
                                {entry.morning.glucoseBefore || "-"}
                              </span>
                              <span className="text-muted-foreground">/</span>
                              <span className={`font-semibold ${getGlucoseColor(entry.morning.glucoseAfter)}`}>
                                {entry.morning.glucoseAfter || "-"}
                              </span>
                            </div>
                            <span className="text-[10px] text-primary font-semibold">
                              {entry.morning.insulin ? `${entry.morning.insulin}u` : "-"}
                            </span>
                          </div>
                        </td>
                        
                        {/* 昼食 */}
                        <td className="p-1.5 border-b border-l text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className={`font-semibold ${getGlucoseColor(entry.lunch.glucoseBefore)}`}>
                                {entry.lunch.glucoseBefore || "-"}
                              </span>
                              <span className="text-muted-foreground">/</span>
                              <span className={`font-semibold ${getGlucoseColor(entry.lunch.glucoseAfter)}`}>
                                {entry.lunch.glucoseAfter || "-"}
                              </span>
                            </div>
                            <span className="text-[10px] text-primary font-semibold">
                              {entry.lunch.insulin ? `${entry.lunch.insulin}u` : "-"}
                            </span>
                          </div>
                        </td>
                        
                        {/* 夕食 */}
                        <td className="p-1.5 border-b border-l text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className={`font-semibold ${getGlucoseColor(entry.dinner.glucoseBefore)}`}>
                                {entry.dinner.glucoseBefore || "-"}
                              </span>
                              <span className="text-muted-foreground">/</span>
                              <span className={`font-semibold ${getGlucoseColor(entry.dinner.glucoseAfter)}`}>
                                {entry.dinner.glucoseAfter || "-"}
                              </span>
                            </div>
                            <span className="text-[10px] text-primary font-semibold">
                              {entry.dinner.insulin ? `${entry.dinner.insulin}u` : "-"}
                            </span>
                          </div>
                        </td>
                        
                        {/* 眠前 */}
                        <td className="p-1.5 border-b border-l text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={`text-xs font-semibold ${getGlucoseColor(entry.bedtime.glucose)}`}>
                              {entry.bedtime.glucose || "-"}
                            </span>
                            <span className="text-[10px] text-primary font-semibold">
                              {entry.bedtime.insulin ? `${entry.bedtime.insulin}u` : "-"}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 削除確認ダイアログ */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>記録を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingDate && (
                <>
                  <span className="font-semibold text-foreground">
                    {format(new Date(deletingDate), "yyyy年M月d日 (E)", { locale: ja })}
                  </span>
                  の記録をすべて削除します。この操作は取り消せません。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              キャンセル
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "削除中..." : "削除する"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
