import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Save, Sparkles, AlertTriangle } from "lucide-react";
import { DEFAULT_SETTINGS, TimeSlot } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Entry() {
  const [, setLocation] = useLocation();
  const [glucose, setGlucose] = useState<string>("");
  const [insulin, setInsulin] = useState<string>("");
  const [note, setNote] = useState("");
  const [timeSlot, setTimeSlot] = useState<TimeSlot>("Morning");
  const [suggestedDose, setSuggestedDose] = useState<{ total: number, correction: number, basal: number } | null>(null);

  // Auto-detect time slot
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) setTimeSlot("Morning");
    else if (hour >= 11 && hour < 17) setTimeSlot("Noon");
    else if (hour >= 17 && hour < 21) setTimeSlot("Evening");
    else setTimeSlot("Night");
  }, []);

  // Simple Sliding Scale Calculation Simulation
  useEffect(() => {
    const gVal = parseInt(glucose);
    if (!isNaN(gVal) && gVal > 0) {
      const settings = DEFAULT_SETTINGS;
      const basal = settings.basalRates[timeSlot];
      
      let correction = 0;
      if (gVal > settings.targetGlucoseHigh) {
        correction = Math.ceil((gVal - settings.targetGlucoseHigh) / settings.insulinSensitivityFactor);
      }

      setSuggestedDose({
        total: basal + correction,
        correction,
        basal
      });
      
      // Auto-fill insulin if empty (UX convenience)
      if (insulin === "") {
        // Don't auto-set immediately to let user type, but show suggestion clearly
      }
    } else {
      setSuggestedDose(null);
    }
  }, [glucose, timeSlot]);

  const applySuggestion = () => {
    if (suggestedDose) {
      setInsulin(suggestedDose.total.toString());
    }
  };

  const handleSave = () => {
    // In a real app, save to context/db
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans max-w-md mx-auto">
      {/* Header */}
      <div className="p-4 flex items-center gap-4 bg-background z-10 sticky top-0 safe-area-top">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-xl font-bold">New Entry</h1>
        <div className="ml-auto">
          <Button variant="ghost" className="text-primary font-bold" onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 safe-area-bottom">
        
        {/* Time Selection */}
        <div className="grid grid-cols-4 gap-2">
          {(["Morning", "Noon", "Evening", "Night"] as TimeSlot[]).map((slot) => (
            <button
              key={slot}
              onClick={() => setTimeSlot(slot)}
              className={cn(
                "py-2 rounded-lg text-xs font-semibold transition-all border-2",
                timeSlot === slot 
                  ? `border-time-${slot.toLowerCase()} bg-time-${slot.toLowerCase()}/10 text-time-${slot.toLowerCase()}` 
                  : "border-transparent bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {slot}
            </button>
          ))}
        </div>

        {/* Glucose Input */}
        <div className="space-y-4">
          <Label className="text-lg font-semibold">Glucose Level (mg/dL)</Label>
          <div className="relative">
            <Input 
              type="number" 
              inputMode="numeric" 
              placeholder="0" 
              className="text-5xl font-bold h-24 text-center bg-transparent border-0 border-b-2 border-border focus-visible:ring-0 focus-visible:border-primary rounded-none px-0"
              value={glucose}
              onChange={(e) => setGlucose(e.target.value)}
              autoFocus
            />
            {parseInt(glucose) > 180 && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2 text-status-high animate-pulse">
                <AlertTriangle className="w-8 h-8" />
              </div>
            )}
          </div>
        </div>

        {/* Smart Suggestion Card */}
        {suggestedDose && (
          <div 
            className="bg-primary/5 border border-primary/20 rounded-xl p-4 cursor-pointer active:scale-98 transition-transform"
            onClick={applySuggestion}
          >
            <div className="flex items-start gap-3">
              <div className="bg-primary/20 p-2 rounded-full text-primary">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <h3 className="font-semibold text-primary">AI Suggestion</h3>
                  <span className="text-2xl font-bold text-primary">{suggestedDose.total}u</span>
                </div>
                <div className="text-xs text-muted-foreground flex gap-3">
                  <span>Base: {suggestedDose.basal}u</span>
                  <span>+</span>
                  <span>Correction: {suggestedDose.correction}u</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 italic">
                  Tap to apply. Calculated based on ISF 1:{DEFAULT_SETTINGS.insulinSensitivityFactor}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Insulin Input */}
        <div className="space-y-4">
          <Label className="text-lg font-semibold">Insulin Dose (Units)</Label>
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="icon" 
              className="h-12 w-12 rounded-full shrink-0"
              onClick={() => setInsulin(prev => Math.max(0, (parseInt(prev || "0") - 1)).toString())}
            >
              -
            </Button>
            <Input 
              type="number" 
              inputMode="numeric" 
              placeholder="0" 
              className="text-4xl font-bold h-16 text-center bg-muted/30 border-transparent focus-visible:ring-0 rounded-xl"
              value={insulin}
              onChange={(e) => setInsulin(e.target.value)}
            />
            <Button 
              variant="outline" 
              size="icon" 
              className="h-12 w-12 rounded-full shrink-0"
              onClick={() => setInsulin(prev => (parseInt(prev || "0") + 1).toString())}
            >
              +
            </Button>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label>Notes</Label>
          <Textarea 
            placeholder="Add a note (e.g. Pizza for lunch)..." 
            className="bg-muted/30 border-transparent resize-none h-24 rounded-xl"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="h-20" /> {/* Spacer */}
      </div>

      <div className="p-4 bg-background border-t fixed bottom-0 w-full max-w-md safe-area-bottom">
        <Button size="lg" className="w-full text-lg h-14 rounded-xl shadow-lg shadow-primary/20" onClick={handleSave}>
          <Save className="w-5 h-5 mr-2" /> Save Entry
        </Button>
      </div>
    </div>
  );
}
