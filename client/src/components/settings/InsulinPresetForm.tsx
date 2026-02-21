import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Save, X } from "lucide-react";
import {
  type InsulinPreset,
  type InsulinCategory,
  INSULIN_CATEGORIES,
  INSULIN_CATALOG,
  INSULIN_TIME_SLOTS,
  INSULIN_TIME_SLOT_LABELS,
} from "@/lib/types";

export interface InsulinPresetFormData {
  name: string;
  category: InsulinCategory;
  brand: string;
  defaultBreakfastUnits: string | null;
  defaultLunchUnits: string | null;
  defaultDinnerUnits: string | null;
  defaultBedtimeUnits: string | null;
  sortOrder: number;
}

interface InsulinPresetFormProps {
  initialValues?: Partial<InsulinPreset>;
  onSubmit: (data: InsulinPresetFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

const SLOT_TO_FIELD: Record<string, keyof Pick<InsulinPresetFormData, "defaultBreakfastUnits" | "defaultLunchUnits" | "defaultDinnerUnits" | "defaultBedtimeUnits">> = {
  Breakfast: "defaultBreakfastUnits",
  Lunch: "defaultLunchUnits",
  Dinner: "defaultDinnerUnits",
  Bedtime: "defaultBedtimeUnits",
};

export function InsulinPresetForm({ initialValues, onSubmit, onCancel, isSubmitting }: InsulinPresetFormProps) {
  const [name, setName] = useState(initialValues?.name ?? "");
  const [category, setCategory] = useState<InsulinCategory>(initialValues?.category ?? "超速効型");
  const [brand, setBrand] = useState(initialValues?.brand ?? "");
  const [units, setUnits] = useState<Record<string, string>>({
    Breakfast: initialValues?.defaultBreakfastUnits ?? "",
    Lunch: initialValues?.defaultLunchUnits ?? "",
    Dinner: initialValues?.defaultDinnerUnits ?? "",
    Bedtime: initialValues?.defaultBedtimeUnits ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const brandOptions = INSULIN_CATALOG[category] ?? [];

  const handleCategoryChange = (value: InsulinCategory) => {
    setCategory(value);
    setBrand(""); // カテゴリ変更時にブランドをリセット
  };

  const handleUnitsChange = (slot: string, value: string) => {
    setUnits(prev => ({ ...prev, [slot]: value }));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "名前を入力してください";
    if (!brand) newErrors.brand = "ブランドを選択してください";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    await onSubmit({
      name: name.trim(),
      category,
      brand,
      defaultBreakfastUnits: units.Breakfast || null,
      defaultLunchUnits: units.Lunch || null,
      defaultDinnerUnits: units.Dinner || null,
      defaultBedtimeUnits: units.Bedtime || null,
      sortOrder: initialValues?.sortOrder ?? 0,
    });
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* カスタム名 */}
          <div className="space-y-1">
            <Label htmlFor="preset-name" className="text-sm">
              カスタム名 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="preset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 朝のノボラピッド"
              className="h-9"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          {/* カテゴリ・ブランド */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-sm">
                カテゴリ <span className="text-destructive">*</span>
              </Label>
              <Select value={category} onValueChange={handleCategoryChange}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-950">
                  {INSULIN_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-sm">
                ブランド <span className="text-destructive">*</span>
              </Label>
              <Select value={brand} onValueChange={setBrand}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-950">
                  {brandOptions.map((opt) => (
                    <SelectItem key={opt.brand} value={opt.brand}>{opt.brand}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.brand && <p className="text-xs text-destructive">{errors.brand}</p>}
            </div>
          </div>

          {/* デフォルト投与量 */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">
              デフォルト投与量（空欄 = そのタイミングには使わない）
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {INSULIN_TIME_SLOTS.map((slot) => (
                <div key={slot} className="space-y-1">
                  <Label className="text-xs text-center block">{INSULIN_TIME_SLOT_LABELS[slot]}</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={units[slot]}
                      onChange={(e) => handleUnitsChange(slot, e.target.value)}
                      placeholder="-"
                      className="h-8 text-center text-sm"
                      min="0"
                      max="100"
                      step="1"
                    />
                    <span className="text-xs text-muted-foreground shrink-0">u</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ボタン */}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="flex-1">
              <X className="w-4 h-4 mr-1" />
              キャンセル
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              <Save className="w-4 h-4 mr-1" />
              {isSubmitting ? "保存中..." : "保存"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
