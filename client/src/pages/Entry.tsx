import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, Coffee, Sun, Sunset, Moon, Save, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface EntryFormData {
  date: string;
  morningGlucoseBefore: string;
  morningGlucoseAfter: string;
  morningInsulin: string;
  lunchGlucoseBefore: string;
  lunchGlucoseAfter: string;
  lunchInsulin: string;
  dinnerGlucoseBefore: string;
  dinnerGlucoseAfter: string;
  dinnerInsulin: string;
  bedtimeGlucose: string;
  bedtimeInsulin: string;
}

export default function Entry() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState<EntryFormData>({
    date: format(new Date(), "yyyy-MM-dd"),
    morningGlucoseBefore: "",
    morningGlucoseAfter: "",
    morningInsulin: "",
    lunchGlucoseBefore: "",
    lunchGlucoseAfter: "",
    lunchInsulin: "",
    dinnerGlucoseBefore: "",
    dinnerGlucoseAfter: "",
    dinnerInsulin: "",
    bedtimeGlucose: "",
    bedtimeInsulin: "",
  });

  const [isSaving, setIsSaving] = useState(false);

  const createGlucoseMutation = useMutation({
    mutationFn: async (data: { date: string; timeSlot: string; glucoseLevel: number }) => {
      const response = await fetch("/api/glucose-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "血糖値の記録に失敗しました");
      }
      return response.json();
    },
  });

  const createInsulinMutation = useMutation({
    mutationFn: async (data: { date: string; timeSlot: string; units: string }) => {
      const response = await fetch("/api/insulin-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "インスリンの記録に失敗しました");
      }
      return response.json();
    },
  });

  const handleInputChange = (field: keyof EntryFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const promises: Promise<any>[] = [];

      if (formData.morningGlucoseBefore) {
        promises.push(createGlucoseMutation.mutateAsync({
          date: formData.date,
          timeSlot: "BreakfastBefore",
          glucoseLevel: parseInt(formData.morningGlucoseBefore),
        }));
      }
      if (formData.morningGlucoseAfter) {
        promises.push(createGlucoseMutation.mutateAsync({
          date: formData.date,
          timeSlot: "BreakfastAfter1h",
          glucoseLevel: parseInt(formData.morningGlucoseAfter),
        }));
      }
      if (formData.morningInsulin) {
        promises.push(createInsulinMutation.mutateAsync({
          date: formData.date,
          timeSlot: "Breakfast",
          units: formData.morningInsulin,
        }));
      }

      if (formData.lunchGlucoseBefore) {
        promises.push(createGlucoseMutation.mutateAsync({
          date: formData.date,
          timeSlot: "LunchBefore",
          glucoseLevel: parseInt(formData.lunchGlucoseBefore),
        }));
      }
      if (formData.lunchGlucoseAfter) {
        promises.push(createGlucoseMutation.mutateAsync({
          date: formData.date,
          timeSlot: "LunchAfter1h",
          glucoseLevel: parseInt(formData.lunchGlucoseAfter),
        }));
      }
      if (formData.lunchInsulin) {
        promises.push(createInsulinMutation.mutateAsync({
          date: formData.date,
          timeSlot: "Lunch",
          units: formData.lunchInsulin,
        }));
      }

      if (formData.dinnerGlucoseBefore) {
        promises.push(createGlucoseMutation.mutateAsync({
          date: formData.date,
          timeSlot: "DinnerBefore",
          glucoseLevel: parseInt(formData.dinnerGlucoseBefore),
        }));
      }
      if (formData.dinnerGlucoseAfter) {
        promises.push(createGlucoseMutation.mutateAsync({
          date: formData.date,
          timeSlot: "DinnerAfter1h",
          glucoseLevel: parseInt(formData.dinnerGlucoseAfter),
        }));
      }
      if (formData.dinnerInsulin) {
        promises.push(createInsulinMutation.mutateAsync({
          date: formData.date,
          timeSlot: "Dinner",
          units: formData.dinnerInsulin,
        }));
      }

      if (formData.bedtimeGlucose) {
        promises.push(createGlucoseMutation.mutateAsync({
          date: formData.date,
          timeSlot: "BeforeSleep",
          glucoseLevel: parseInt(formData.bedtimeGlucose),
        }));
      }
      if (formData.bedtimeInsulin) {
        promises.push(createInsulinMutation.mutateAsync({
          date: formData.date,
          timeSlot: "Bedtime",
          units: formData.bedtimeInsulin,
        }));
      }

      if (promises.length === 0) {
        toast({
          title: "入力エラー",
          description: "少なくとも1つの値を入力してください",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }

      await Promise.all(promises);

      queryClient.invalidateQueries({ queryKey: ["glucose-entries"] });
      queryClient.invalidateQueries({ queryKey: ["insulin-entries"] });

      toast({
        title: "保存成功",
        description: `${format(new Date(formData.date), "M月d日", { locale: ja })}の記録を保存しました`,
      });

      setLocation("/logbook");
    } catch (error) {
      toast({
        title: "保存失敗",
        description: error instanceof Error ? error.message : "記録の保存に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const TimeSlotCard = ({ 
    icon: Icon, 
    iconColor, 
    title, 
    glucoseBeforeField, 
    glucoseAfterField, 
    insulinField,
    showBothGlucose = true,
  }: { 
    icon: any; 
    iconColor: string; 
    title: string; 
    glucoseBeforeField?: keyof EntryFormData; 
    glucoseAfterField?: keyof EntryFormData; 
    insulinField: keyof EntryFormData;
    showBothGlucose?: boolean;
  }) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className={`w-5 h-5 ${iconColor}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {showBothGlucose && glucoseBeforeField && glucoseAfterField ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={glucoseBeforeField} className="text-xs text-muted-foreground">
                食前血糖値
              </Label>
              <div className="flex items-center gap-1">
                <Input
                  id={glucoseBeforeField}
                  data-testid={`input-${glucoseBeforeField}`}
                  type="number"
                  placeholder="-"
                  value={formData[glucoseBeforeField]}
                  onChange={(e) => handleInputChange(glucoseBeforeField, e.target.value)}
                  className="h-9"
                  min="20"
                  max="600"
                />
                <span className="text-xs text-muted-foreground">mg/dL</span>
              </div>
            </div>
            <div>
              <Label htmlFor={glucoseAfterField} className="text-xs text-muted-foreground">
                食後血糖値
              </Label>
              <div className="flex items-center gap-1">
                <Input
                  id={glucoseAfterField}
                  data-testid={`input-${glucoseAfterField}`}
                  type="number"
                  placeholder="-"
                  value={formData[glucoseAfterField]}
                  onChange={(e) => handleInputChange(glucoseAfterField, e.target.value)}
                  className="h-9"
                  min="20"
                  max="600"
                />
                <span className="text-xs text-muted-foreground">mg/dL</span>
              </div>
            </div>
          </div>
        ) : glucoseBeforeField ? (
          <div>
            <Label htmlFor={glucoseBeforeField} className="text-xs text-muted-foreground">
              血糖値
            </Label>
            <div className="flex items-center gap-1">
              <Input
                id={glucoseBeforeField}
                data-testid={`input-${glucoseBeforeField}`}
                type="number"
                placeholder="-"
                value={formData[glucoseBeforeField]}
                onChange={(e) => handleInputChange(glucoseBeforeField, e.target.value)}
                className="h-9"
                min="20"
                max="600"
              />
              <span className="text-xs text-muted-foreground">mg/dL</span>
            </div>
          </div>
        ) : null}
        
        <div>
          <Label htmlFor={insulinField} className="text-xs text-muted-foreground">
            インスリン
          </Label>
          <div className="flex items-center gap-1">
            <Input
              id={insulinField}
              data-testid={`input-${insulinField}`}
              type="number"
              step="0.5"
              placeholder="-"
              value={formData[insulinField]}
              onChange={(e) => handleInputChange(insulinField, e.target.value)}
              className="h-9"
              min="0"
              max="100"
            />
            <span className="text-xs text-muted-foreground">単位</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="pt-6 px-6 pb-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            data-testid="button-back"
            onClick={() => setLocation("/logbook")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">記録入力</h1>
            <p className="text-muted-foreground text-sm">
              インスリン投与量と血糖値を記録
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <PlusCircle className="w-5 h-5 text-primary" />
                日付選択
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                type="date"
                data-testid="input-date"
                value={formData.date}
                onChange={(e) => handleInputChange("date", e.target.value)}
                className="max-w-[200px]"
              />
            </CardContent>
          </Card>

          <TimeSlotCard
            icon={Coffee}
            iconColor="text-orange-500"
            title="朝食"
            glucoseBeforeField="morningGlucoseBefore"
            glucoseAfterField="morningGlucoseAfter"
            insulinField="morningInsulin"
          />

          <TimeSlotCard
            icon={Sun}
            iconColor="text-yellow-500"
            title="昼食"
            glucoseBeforeField="lunchGlucoseBefore"
            glucoseAfterField="lunchGlucoseAfter"
            insulinField="lunchInsulin"
          />

          <TimeSlotCard
            icon={Sunset}
            iconColor="text-purple-500"
            title="夕食"
            glucoseBeforeField="dinnerGlucoseBefore"
            glucoseAfterField="dinnerGlucoseAfter"
            insulinField="dinnerInsulin"
          />

          <TimeSlotCard
            icon={Moon}
            iconColor="text-blue-500"
            title="眠前"
            glucoseBeforeField="bedtimeGlucose"
            insulinField="bedtimeInsulin"
            showBothGlucose={false}
          />

          <Button 
            type="submit" 
            className="w-full" 
            size="lg"
            data-testid="button-save"
            disabled={isSaving}
          >
            <Save className="w-5 h-5 mr-2" />
            {isSaving ? "保存中..." : "記録を保存"}
          </Button>
        </form>
      </div>
    </AppLayout>
  );
}
