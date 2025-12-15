import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MOCK_ENTRIES } from "@/lib/mockData";
import { format, isSameDay, startOfWeek, addDays } from "date-fns";
import { ChevronLeft, ChevronRight, Printer, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { getTimeSlotColor, getGlucoseStatusColor, DEFAULT_SETTINGS } from "@/lib/types";

export default function Logbook() {
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date()));
  
  const nextWeek = () => setCurrentWeekStart(addDays(currentWeekStart, 7));
  const prevWeek = () => setCurrentWeekStart(addDays(currentWeekStart, -7));

  // Generate 14 days for the "Book View"
  const days = Array.from({ length: 14 }).map((_, i) => addDays(currentWeekStart, i));

  const getEntryForSlot = (date: Date, slot: string) => {
    return MOCK_ENTRIES.find(e => isSameDay(e.timestamp, date) && e.timeSlot === slot);
  };

  return (
    <AppLayout>
      <div className="pt-12 px-4 pb-6">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Logbook</h1>
            <p className="text-muted-foreground text-sm">Review your history</p>
          </div>
          <Button variant="outline" size="icon" className="rounded-full shadow-sm" title="Export PDF">
            <Printer className="w-4 h-4" />
          </Button>
        </div>

        <Tabs defaultValue="list" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="list">List View</TabsTrigger>
            <TabsTrigger value="book">Book View</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            {days.slice(0, 7).map((day) => { // Show 7 days for list view simplicity
               const dayEntries = MOCK_ENTRIES.filter(e => isSameDay(e.timestamp, day));
               if (dayEntries.length === 0) return null;

               return (
                 <div key={day.toISOString()} className="space-y-2">
                   <h3 className="text-sm font-semibold text-muted-foreground ml-1 sticky top-0 bg-background/95 backdrop-blur py-2 z-10">
                     {format(day, "EEEE, MMM d")}
                   </h3>
                   {dayEntries.map(entry => (
                     <Card key={entry.id} className="overflow-hidden border-l-4" style={{ borderLeftColor: `hsl(var(--time-${entry.timeSlot.toLowerCase() === 'night' ? 'night' : entry.timeSlot.toLowerCase() === 'evening' ? 'evening' : entry.timeSlot.toLowerCase() === 'noon' ? 'noon' : 'morning'}))` }}>
                       <CardContent className="p-3 flex items-center justify-between">
                         <div className="flex flex-col gap-1">
                           <div className="flex items-center gap-2">
                             <span className={`text-xs px-1.5 py-0.5 rounded text-white ${getTimeSlotColor(entry.timeSlot)}`}>
                               {entry.timeSlot}
                             </span>
                             <span className="text-xs text-muted-foreground">{format(entry.timestamp, "h:mm a")}</span>
                           </div>
                           <span className={`text-xl font-bold ${getGlucoseStatusColor(entry.glucoseLevel, DEFAULT_SETTINGS)}`}>
                             {entry.glucoseLevel} <span className="text-xs font-normal text-muted-foreground">mg/dL</span>
                           </span>
                         </div>
                         <div className="text-right">
                           {entry.insulinUnits && (
                             <div className="flex flex-col items-end">
                               <span className="font-bold text-lg">{entry.insulinUnits}u</span>
                               <span className="text-[10px] uppercase text-muted-foreground">{entry.type}</span>
                             </div>
                           )}
                         </div>
                       </CardContent>
                     </Card>
                   ))}
                 </div>
               );
            })}
          </TabsContent>

          <TabsContent value="book">
            <div className="flex justify-between items-center mb-4 bg-muted/30 p-2 rounded-lg">
              <Button variant="ghost" size="sm" onClick={prevWeek}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-sm font-medium">
                {format(currentWeekStart, "MMM d")} - {format(addDays(currentWeekStart, 13), "MMM d")}
              </span>
              <Button variant="ghost" size="sm" onClick={nextWeek}><ChevronRight className="w-4 h-4" /></Button>
            </div>

            <div className="bg-card border rounded-lg overflow-hidden shadow-sm">
              <div className="grid grid-cols-[3rem_1fr_1fr_1fr_1fr] bg-muted/50 border-b text-[10px] font-bold text-center py-2">
                <div>Date</div>
                <div className="text-time-morning">Morn</div>
                <div className="text-time-noon">Noon</div>
                <div className="text-time-evening">Eve</div>
                <div className="text-time-night">Night</div>
              </div>
              
              <div className="divide-y text-xs">
                {days.map(day => (
                  <div key={day.toISOString()} className="grid grid-cols-[3rem_1fr_1fr_1fr_1fr] min-h-[3rem]">
                    <div className="p-1 flex flex-col justify-center items-center bg-muted/10 border-r font-medium text-muted-foreground text-[10px]">
                      <span>{format(day, "d")}</span>
                      <span>{format(day, "EE")}</span>
                    </div>
                    {['Morning', 'Noon', 'Evening', 'Night'].map(slot => {
                      const entry = getEntryForSlot(day, slot);
                      return (
                        <div key={slot} className="p-1 flex flex-col justify-center items-center text-center relative hover:bg-muted/20 transition-colors">
                          {entry ? (
                            <>
                              <span className={`font-bold ${getGlucoseStatusColor(entry.glucoseLevel, DEFAULT_SETTINGS)}`}>
                                {entry.glucoseLevel}
                              </span>
                              {entry.insulinUnits && (
                                <span className="text-[10px] text-primary bg-primary/10 px-1 rounded mt-0.5">
                                  {entry.insulinUnits}u
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground/20">-</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground text-center mt-4">
              Tip: Rotate device for easier viewing
            </p>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
