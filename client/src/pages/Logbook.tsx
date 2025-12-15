import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MOCK_ENTRIES } from "@/lib/mockData";
import { format, isSameDay, startOfWeek, addDays } from "date-fns";
import { ja } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Printer, Activity, Droplets, Clock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { getTimeSlotColor, getGlucoseStatusColor, DEFAULT_SETTINGS, TIME_SLOT_LABELS, TIME_SLOT_SHORT_LABELS } from "@/lib/types";

export default function Logbook() {
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  
  const nextWeek = () => setCurrentWeekStart(addDays(currentWeekStart, 7));
  const prevWeek = () => setCurrentWeekStart(addDays(currentWeekStart, -7));

  // Generate 14 days for the "Book View"
  const days = Array.from({ length: 14 }).map((_, i) => addDays(currentWeekStart, i));

  const getEntryForSlot = (date: Date, slot: string) => {
    return MOCK_ENTRIES.find(e => isSameDay(e.timestamp, date) && e.timeSlot === slot);
  };

  const settings = DEFAULT_SETTINGS;
  const enabledSlots = settings.enabledTimeSlots;

  return (
    <AppLayout>
      <div className="pt-12 px-4 pb-6">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">記録ノート</h1>
            <p className="text-muted-foreground text-sm">履歴を確認</p>
          </div>
          <Button variant="outline" size="icon" className="rounded-full shadow-sm" title="PDF出力">
            <Printer className="w-4 h-4" />
          </Button>
        </div>

        <Tabs defaultValue="list" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="list">リスト表示</TabsTrigger>
            <TabsTrigger value="book">手帳表示</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            {days.slice(0, 7).map((day) => {
               const dayEntries = MOCK_ENTRIES.filter(e => isSameDay(e.timestamp, day) && enabledSlots.includes(e.timeSlot));
               if (dayEntries.length === 0) return null;

               return (
                 <div key={day.toISOString()} className="space-y-3">
                   <h3 className="text-base font-semibold text-muted-foreground ml-1 sticky top-0 bg-background/95 backdrop-blur py-2 z-10">
                     {format(day, "M月d日 (EE)", { locale: ja })}
                   </h3>
                   <div className="grid grid-cols-2 gap-3">
                     {dayEntries.map(entry => (
                       <Card key={entry.id} className="overflow-hidden border-0 shadow-md">
                         <CardContent className="p-3">
                           <div className="flex flex-col gap-2">
                             <div className="flex items-center justify-between">
                               <span className={`text-xs px-2 py-0.5 rounded text-white font-medium ${getTimeSlotColor(entry.timeSlot)}`}>
                                 {TIME_SLOT_SHORT_LABELS[entry.timeSlot]}
                               </span>
                               <span className="text-xs text-muted-foreground flex items-center gap-1">
                                 <Clock className="w-3 h-3" />
                                 {format(entry.timestamp, "H:mm")}
                               </span>
                             </div>
                             
                             <div className="flex items-center gap-2">
                               <Activity className="w-4 h-4 text-muted-foreground" />
                               <div className="flex-1">
                                 <p className="text-xs text-muted-foreground">血糖値</p>
                                 <p className={`text-lg font-bold leading-none ${getGlucoseStatusColor(entry.glucoseLevel, settings)}`}>
                                   {entry.glucoseLevel}
                                 </p>
                               </div>
                               <span className="text-xs text-muted-foreground">mg/dL</span>
                             </div>
                             
                             {entry.insulinUnits && (
                               <div className="flex items-center gap-2 bg-primary/5 -mx-3 -mb-3 px-3 py-2">
                                 <Droplets className="w-4 h-4 text-primary" />
                                 <div className="flex-1">
                                   <p className="text-xs text-muted-foreground">投与量</p>
                                   <p className="text-base font-bold text-primary leading-none">
                                     {entry.insulinUnits}単位
                                   </p>
                                 </div>
                                 <span className="text-[10px] uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                   {entry.type === 'Meal' ? '食事' : entry.type === 'Correction' ? '補正' : '基礎'}
                                 </span>
                               </div>
                             )}
                           </div>
                         </CardContent>
                       </Card>
                     ))}
                   </div>
                 </div>
               );
            })}
          </TabsContent>

          <TabsContent value="book">
            <div className="flex justify-between items-center mb-4 bg-muted/30 p-2 rounded-lg">
              <Button variant="ghost" size="sm" onClick={prevWeek}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-sm font-medium">
                {format(currentWeekStart, "M/d")} - {format(addDays(currentWeekStart, 13), "M/d")}
              </span>
              <Button variant="ghost" size="sm" onClick={nextWeek}><ChevronRight className="w-4 h-4" /></Button>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-3 flex items-start gap-2">
              <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-xs text-muted-foreground">
                <span className="font-bold text-foreground">表の見方：</span> 上段の数字が<span className="font-semibold text-foreground">血糖値 (mg/dL)</span>、下段の数字が<span className="font-semibold text-primary">インスリン投与量 (単位)</span>を示します
              </div>
            </div>

            <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
              <div className={`grid bg-muted/50 border-b text-[9px] font-bold text-center py-2`} style={{ gridTemplateColumns: `2rem repeat(${enabledSlots.length}, 1fr)` }}>
                <div className="text-[8px]">日付</div>
                {enabledSlots.map(slot => (
                  <div key={slot} className={getTimeSlotColor(slot).replace('bg-', 'text-').replace(' text-white', '')}>
                    {TIME_SLOT_SHORT_LABELS[slot]}
                  </div>
                ))}
              </div>
              
              <div className="divide-y text-xs">
                {days.map(day => (
                  <div key={day.toISOString()} className={`grid min-h-[3rem]`} style={{ gridTemplateColumns: `2rem repeat(${enabledSlots.length}, 1fr)` }}>
                    <div className="p-1 flex flex-col justify-center items-center bg-muted/10 border-r font-medium text-muted-foreground text-[9px]">
                      <span>{format(day, "d")}</span>
                      <span className="text-[8px]">{format(day, "EE", { locale: ja })}</span>
                    </div>
                    {enabledSlots.map(slot => {
                      const entry = getEntryForSlot(day, slot);
                      return (
                        <div key={slot} className="p-1 flex flex-col justify-center items-center text-center relative hover:bg-muted/20 transition-colors gap-0.5">
                          {entry ? (
                            <>
                              <span className={`font-bold text-xs ${getGlucoseStatusColor(entry.glucoseLevel, settings)}`}>
                                {entry.glucoseLevel}
                              </span>
                              {entry.insulinUnits ? (
                                <span className="text-[10px] text-primary font-semibold bg-primary/10 px-1 py-0.5 rounded">
                                  {entry.insulinUnits}
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/30">-</span>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="text-muted-foreground/20 text-xs">-</span>
                              <span className="text-[10px] text-muted-foreground/20">-</span>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
