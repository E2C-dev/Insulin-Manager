import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MOCK_ENTRIES } from "@/lib/mockData";
import { DEFAULT_SETTINGS, getGlucoseStatusColor, getTimeSlotColor } from "@/lib/types";
import { ArrowRight, Droplets, Plus, Activity, Clock, AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const latestEntry = MOCK_ENTRIES[0];
  const settings = DEFAULT_SETTINGS;

  // Determine current timeslot for Smart Action
  const currentHour = new Date().getHours();
  let currentSlot = "Morning";
  let nextAction = "Lunch";
  let slotColor = "text-time-morning";
  
  if (currentHour >= 11 && currentHour < 17) {
    currentSlot = "Noon";
    nextAction = "Dinner";
    slotColor = "text-time-noon";
  } else if (currentHour >= 17 && currentHour < 21) {
    currentSlot = "Evening";
    nextAction = "Bedtime";
    slotColor = "text-time-evening";
  } else if (currentHour >= 21 || currentHour < 5) {
    currentSlot = "Night";
    nextAction = "Breakfast";
    slotColor = "text-time-night";
  }

  return (
    <AppLayout>
      {/* Header */}
      <header className="bg-primary pt-12 pb-16 px-6 rounded-b-[2.5rem] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl pointer-events-none" />
        <div className="relative z-10 text-primary-foreground">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-primary-foreground/80 text-sm font-medium">Good Afternoon</p>
              <h1 className="text-2xl font-bold">Alex Doe</h1>
            </div>
            <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
              <Activity className="w-6 h-6" />
            </div>
          </div>

          <div className="flex items-end gap-3 mb-2">
            <span className="text-6xl font-bold tracking-tighter">
              {latestEntry.glucoseLevel}
            </span>
            <span className="text-xl font-medium mb-3 opacity-80">mg/dL</span>
          </div>
          
          <div className="flex items-center gap-2 text-sm opacity-90">
            <Clock className="w-4 h-4" />
            <span>Last checked {format(latestEntry.timestamp, 'h:mm a')}</span>
            {latestEntry.insulinUnits && (
              <span className="bg-white/20 px-2 py-0.5 rounded text-xs ml-2">
                {latestEntry.insulinUnits}u Active
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="px-6 -mt-8 relative z-20 space-y-6">
        
        {/* Smart Action Card */}
        <Card className="shadow-lg border-0 overflow-hidden">
          <CardContent className="p-0">
            <div className="p-5 flex items-center justify-between bg-card">
              <div>
                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">
                  Up Next
                </p>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <span className={slotColor}>●</span> {currentSlot} Check
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Target: {settings.targetGlucoseLow}-{settings.targetGlucoseHigh} mg/dL
                </p>
              </div>
              <Button 
                onClick={() => setLocation("/entry")}
                size="lg" 
                className="h-14 w-14 rounded-2xl shadow-md p-0"
              >
                <Plus className="w-8 h-8" />
              </Button>
            </div>
            <div className="bg-muted/30 px-5 py-3 border-t border-border flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Standard Dose</span>
              <span className="font-bold text-foreground">{settings.basalRates[currentSlot as keyof typeof settings.basalRates]}u</span>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-0 shadow-sm bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <div className="bg-blue-100 dark:bg-blue-900/50 p-2.5 rounded-full mb-2 text-blue-600 dark:text-blue-400">
                <Droplets className="w-5 h-5" />
              </div>
              <span className="text-2xl font-bold text-foreground">12u</span>
              <span className="text-xs text-muted-foreground mt-1">Total Insulin Today</span>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-sm bg-orange-50/50 dark:bg-orange-950/20">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <div className="bg-orange-100 dark:bg-orange-900/50 p-2.5 rounded-full mb-2 text-orange-600 dark:text-orange-400">
                <Activity className="w-5 h-5" />
              </div>
              <span className="text-2xl font-bold text-foreground">118</span>
              <span className="text-xs text-muted-foreground mt-1">Avg. Glucose (7d)</span>
            </CardContent>
          </Card>
        </div>

        {/* Recent History Preview */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">Recent History</h3>
            <Button variant="ghost" size="sm" className="text-primary h-auto p-0 hover:bg-transparent" onClick={() => setLocation("/logbook")}>
              View All <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          
          <div className="space-y-3">
            {MOCK_ENTRIES.slice(0, 3).map(entry => (
              <div key={entry.id} className="bg-card p-4 rounded-xl border border-border shadow-sm flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-10 rounded-full ${
                    entry.glucoseLevel > 180 ? 'bg-status-high' : 
                    entry.glucoseLevel < 70 ? 'bg-status-low' : 'bg-status-ok'
                  }`} />
                  <div>
                    <p className="font-bold text-lg leading-none mb-1">
                      {entry.glucoseLevel} <span className="text-xs text-muted-foreground font-normal">mg/dL</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(entry.timestamp, 'MMM d, h:mm a')} • {entry.timeSlot}
                    </p>
                  </div>
                </div>
                {entry.insulinUnits && (
                  <div className="text-right">
                    <span className="font-bold text-primary block">{entry.insulinUnits}u</span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase">{entry.type}</span>
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
