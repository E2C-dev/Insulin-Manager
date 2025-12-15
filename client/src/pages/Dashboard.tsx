import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MOCK_ENTRIES } from "@/lib/mockData";
import { DEFAULT_SETTINGS, TIME_SLOT_LABELS, TimeSlot, TIME_SLOT_SHORT_LABELS } from "@/lib/types";
import { ArrowRight, Droplets, Plus, Activity, Clock } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const latestEntry = MOCK_ENTRIES[0];
  const settings = DEFAULT_SETTINGS;

  // Determine current timeslot for Smart Action
  const currentHour = new Date().getHours();
  let currentSlot: TimeSlot = "BreakfastBefore";
  let slotColor = "text-time-morning";
  
  if (currentHour >= 6 && currentHour < 8) {
    currentSlot = "BreakfastBefore";
    slotColor = "text-time-morning";
  } else if (currentHour >= 8 && currentHour < 11) {
    currentSlot = "BreakfastAfter";
    slotColor = "text-time-morning";
  } else if (currentHour >= 11 && currentHour < 13) {
    currentSlot = "LunchBefore";
    slotColor = "text-time-noon";
  } else if (currentHour >= 13 && currentHour < 17) {
    currentSlot = "LunchAfter";
    slotColor = "text-time-noon";
  } else if (currentHour >= 17 && currentHour < 19) {
    currentSlot = "DinnerBefore";
    slotColor = "text-time-evening";
  } else if (currentHour >= 19 && currentHour < 21) {
    currentSlot = "DinnerAfter";
    slotColor = "text-time-evening";
  } else {
    currentSlot = "Bedtime";
    slotColor = "text-time-night";
  }

  // Define simplified time slots for the header display
  const displaySlots: TimeSlot[] = ['BreakfastBefore', 'LunchBefore', 'DinnerBefore', 'Bedtime'];

  const headerLabels: Partial<Record<TimeSlot, string>> = {
    BreakfastBefore: '朝',
    LunchBefore: '昼',
    DinnerBefore: '夕',
    Bedtime: '眠',
  };

  return (
    <AppLayout>
      {/* Header - Compact Redesign */}
      <header className="bg-primary pt-8 pb-10 px-6 rounded-b-[2rem] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl pointer-events-none" />
        <div className="relative z-10 text-primary-foreground">
          
          {/* Top Row: Greeting & Glucose */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <p className="text-primary-foreground/80 text-xs font-medium mb-1">こんにちは, Alex</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tighter">
                  {latestEntry.glucoseLevel}
                </span>
                <span className="text-sm font-medium opacity-80">mg/dL</span>
              </div>
            </div>
            
            <div className="text-right">
              <div className="bg-white/10 px-3 py-1.5 rounded-lg backdrop-blur-sm inline-flex items-center gap-1.5 mb-1">
                <Clock className="w-3 h-3" />
                <span className="text-xs font-medium">{format(latestEntry.timestamp, 'H:mm')}</span>
              </div>
              <p className="text-[10px] opacity-70">残存 {latestEntry.insulinUnits || 0}単位</p>
            </div>
          </div>

          {/* Basal Rates Overview */}
          <div className="bg-white/10 rounded-xl p-3 backdrop-blur-sm border border-white/10">
            <div className="flex justify-between items-center">
              {displaySlots.map((slot) => {
                const isCurrent = slot === currentSlot || 
                                  (slot === 'BreakfastBefore' && currentSlot === 'BreakfastAfter') ||
                                  (slot === 'LunchBefore' && currentSlot === 'LunchAfter') ||
                                  (slot === 'DinnerBefore' && currentSlot === 'DinnerAfter');
                
                return (
                  <div key={slot} className={`flex flex-col items-center gap-1 ${isCurrent ? 'opacity-100' : 'opacity-60'}`}>
                    <span className="text-[10px] font-medium">{headerLabels[slot]}</span>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isCurrent ? 'bg-white text-primary shadow-sm' : 'bg-primary-foreground/10'}`}>
                      {settings.basalRates[slot]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </header>

      <div className="px-6 -mt-6 relative z-20 space-y-5">
        
        {/* Next Action Card */}
        <Card className="shadow-md border-0 overflow-hidden">
           <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${slotColor.replace('text-', 'bg-')}`}></span>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">次のアクション</p>
                </div>
                <h3 className="text-lg font-bold">
                  {TIME_SLOT_LABELS[currentSlot]}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  目標: {settings.targetGlucoseLow}-{settings.targetGlucoseHigh}
                </p>
              </div>
              <Button 
                onClick={() => setLocation("/entry")}
                size="icon"
                className="h-10 w-10 rounded-full shadow-sm"
              >
                <Plus className="w-5 h-5" />
              </Button>
           </CardContent>
        </Card>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-0 shadow-sm bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="p-3 flex flex-col items-center justify-center text-center">
              <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-full mb-2 text-blue-600 dark:text-blue-400">
                <Droplets className="w-4 h-4" />
              </div>
              <span className="text-xl font-bold text-foreground">12単位</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">本日のインスリン</span>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm bg-orange-50/50 dark:bg-orange-950/20">
            <CardContent className="p-3 flex flex-col items-center justify-center text-center">
              <div className="bg-orange-100 dark:bg-orange-900/50 p-2 rounded-full mb-2 text-orange-600 dark:text-orange-400">
                <Activity className="w-4 h-4" />
              </div>
              <span className="text-xl font-bold text-foreground">118</span>
              <span className="text-[10px] text-muted-foreground mt-0.5">平均血糖 (7日)</span>
            </CardContent>
          </Card>
        </div>

        {/* Recent History Preview */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-base">最近の記録</h3>
            <Button variant="ghost" size="sm" className="text-primary h-8 text-xs hover:bg-transparent px-0" onClick={() => setLocation("/logbook")}>
              すべて見る <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
          
          <div className="space-y-2">
            {MOCK_ENTRIES.slice(0, 3).map(entry => (
              <div key={entry.id} className="bg-card p-3 rounded-lg border border-border/50 shadow-sm flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className={`w-1.5 h-8 rounded-full ${
                    entry.glucoseLevel > 180 ? 'bg-status-high' : 
                    entry.glucoseLevel < 70 ? 'bg-status-low' : 'bg-status-ok'
                  }`} />
                  <div>
                    <p className="font-bold text-base leading-none mb-1">
                      {entry.glucoseLevel} <span className="text-[10px] text-muted-foreground font-normal">mg/dL</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(entry.timestamp, 'M/d H:mm')} • {TIME_SLOT_LABELS[entry.timeSlot]}
                    </p>
                  </div>
                </div>
                {entry.insulinUnits && (
                  <div className="text-right">
                    <span className="font-bold text-primary block text-sm">{entry.insulinUnits}単位</span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase">{entry.type === 'Meal' ? '食事' : entry.type === 'Correction' ? '補正' : '基礎'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
