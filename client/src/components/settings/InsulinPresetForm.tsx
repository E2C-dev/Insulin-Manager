import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Save, X, ChevronLeft, Clock, Timer, Syringe, Info } from "lucide-react";
import {
  type InsulinPreset,
  type InsulinCategory,
  type InsulinBrandOption,
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
  onBack?: () => void;  // called when user wants to go back to brand selection
}

const SLOT_TO_FIELD: Record<string, keyof Pick<InsulinPresetFormData, "defaultBreakfastUnits" | "defaultLunchUnits" | "defaultDinnerUnits" | "defaultBedtimeUnits">> = {
  Breakfast: "defaultBreakfastUnits",
  Lunch: "defaultLunchUnits",
  Dinner: "defaultDinnerUnits",
  Bedtime: "defaultBedtimeUnits",
};

// カテゴリを表示用グループにマッピング
export const DISPLAY_GROUPS: { label: string; categories: InsulinCategory[] }[] = [
  { label: "食事時に使うインスリン（速効型）", categories: ["超速効型", "速効型"] },
  { label: "就寝・基礎インスリン（長時間型）", categories: ["持効型", "超持効型", "中間型"] },
  { label: "混合型", categories: ["混合型"] },
];

// brand名からカテゴリを逆引き
function findBrandOption(brandName: string): { category: InsulinCategory; option: InsulinBrandOption } | null {
  for (const [category, options] of Object.entries(INSULIN_CATALOG) as [InsulinCategory, InsulinBrandOption[]][]) {
    const option = options.find(o => o.brand === brandName);
    if (option) return { category, option };
  }
  return null;
}

// 病名別おすすめカテゴリマッピング
export const DISEASE_SUGGESTED_CATEGORIES: Record<string, InsulinCategory[]> = {
  type1: ["超速効型", "速効型", "持効型", "超持効型"],
  type2: ["持効型", "超持効型", "混合型", "超速効型"],
  gestational: ["超速効型", "速効型", "持効型"],
  other: [],
};

export function InsulinPresetForm({ initialValues, onSubmit, onCancel, isSubmitting, onBack }: InsulinPresetFormProps) {
  // 編集モード時は brand から selectedBrand を復元
  const initialBrand = initialValues?.brand
    ? findBrandOption(initialValues.brand)
    : null;

  // localStorage から病名を読み込んでおすすめカテゴリを決定
  const savedDisease = typeof window !== "undefined" ? (localStorage.getItem("diseaseType") ?? "other") : "other";
  const suggestedCategories = DISEASE_SUGGESTED_CATEGORIES[savedDisease] ?? [];

  const [wizardStep, setWizardStep] = useState<1 | 2>(initialValues?.brand ? 2 : 1);
  const [selectedCategory, setSelectedCategory] = useState<InsulinCategory | null>(
    initialBrand?.category ?? null
  );
  const [selectedBrand, setSelectedBrand] = useState<InsulinBrandOption | null>(
    initialBrand?.option ?? null
  );
  const [name, setName] = useState(initialValues?.name ?? "");
  const [units, setUnits] = useState<Record<string, string>>({
    Breakfast: initialValues?.defaultBreakfastUnits ?? "",
    Lunch: initialValues?.defaultLunchUnits ?? "",
    Dinner: initialValues?.defaultDinnerUnits ?? "",
    Bedtime: initialValues?.defaultBedtimeUnits ?? "",
  });

  const handleBrandSelect = (category: InsulinCategory, option: InsulinBrandOption) => {
    setSelectedCategory(category);
    setSelectedBrand(option);
    // 名前を shortName で auto-fill（既存値がある場合は上書きしない）
    if (!name) setName(option.shortName);
    setWizardStep(2);
  };

  const handleBackToStep1 = () => {
    setWizardStep(1);
    setSelectedBrand(null);
    setSelectedCategory(null);
    setName("");
  };

  const handleUnitsChange = (slot: string, value: string) => {
    setUnits(prev => ({ ...prev, [slot]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrand || !selectedCategory) return;

    await onSubmit({
      name: name.trim() || selectedBrand.shortName,
      category: selectedCategory,
      brand: selectedBrand.brand,
      defaultBreakfastUnits: units.Breakfast || null,
      defaultLunchUnits: units.Lunch || null,
      defaultDinnerUnits: units.Dinner || null,
      defaultBedtimeUnits: units.Bedtime || null,
      sortOrder: initialValues?.sortOrder ?? 0,
    });
  };

  // ステップ1: ブランド選択カードグリッド
  if (wizardStep === 1) {
    return (
      <Card className="border-2 border-primary/20">
        <CardContent className="p-4">
          <div className="space-y-1 mb-4">
            <p className="text-sm font-semibold">使っているインスリンを選んでください</p>
            <p className="text-xs text-muted-foreground">ブランド名をタップすると詳細と投与量を設定できます</p>
          </div>

          {suggestedCategories.length > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-primary/5 rounded-md border border-primary/20 mb-1">
              <span className="text-xs text-muted-foreground font-medium">病名に応じてよく処方されるインスリンを上に表示しています</span>
            </div>
          )}

          <div className="space-y-4">
            {DISPLAY_GROUPS.map((group) => {
              const brandsInGroup = group.categories.flatMap(cat =>
                (INSULIN_CATALOG[cat] ?? []).map(opt => ({ category: cat, option: opt, isSuggested: suggestedCategories.includes(cat) }))
              );
              if (brandsInGroup.length === 0) return null;
              // おすすめを先頭に
              const sorted = [...brandsInGroup].sort((a, b) => (b.isSuggested ? 1 : 0) - (a.isSuggested ? 1 : 0));
              return (
                <div key={group.label}>
                  <p className="text-xs font-medium text-muted-foreground mb-2 pb-1 border-b">
                    {group.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {sorted.map(({ category, option, isSuggested }) => (
                      <button
                        key={option.brand}
                        type="button"
                        onClick={() => handleBrandSelect(category, option)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-colors text-left ${
                          isSuggested
                            ? "border-primary/50 bg-primary/5 hover:border-primary hover:bg-primary/10"
                            : "border-border bg-white dark:bg-gray-900 hover:border-primary hover:bg-primary/5"
                        }`}
                      >
                        <span className="text-base">{option.icon}</span>
                        <div className="flex flex-col items-start">
                          <span className="text-sm font-medium">{option.shortName}</span>
                          {isSuggested && (
                            <span className="text-[10px] text-primary font-semibold leading-none mt-0.5">処方例</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t">
            <Button type="button" variant="outline" onClick={onCancel} className="w-full">
              <X className="w-4 h-4 mr-1" />
              キャンセル
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ステップ2: 詳細確認 + 投与量設定
  return (
    <Card className="border-2 border-primary/20">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ブランド詳細パネル */}
          {selectedBrand && selectedCategory && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{selectedBrand.icon}</span>
                <div>
                  <p className="font-semibold text-sm">{selectedBrand.shortName}</p>
                  <p className="text-xs text-muted-foreground">{selectedBrand.brand}</p>
                </div>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700 font-medium">
                  {selectedCategory}
                </span>
              </div>

              <p className="text-xs text-blue-800 dark:text-blue-200">{selectedBrand.description}</p>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="flex items-start gap-1">
                  <Clock className="w-3 h-3 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">効き始め</p>
                    <p className="text-xs font-medium">{selectedBrand.onset}</p>
                  </div>
                </div>
                <div className="flex items-start gap-1">
                  <Timer className="w-3 h-3 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">持続時間</p>
                    <p className="text-xs font-medium">{selectedBrand.duration}</p>
                  </div>
                </div>
                <div className="flex items-start gap-1">
                  <Syringe className="w-3 h-3 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">使い方</p>
                    <p className="text-xs font-medium">{selectedBrand.timing}</p>
                  </div>
                </div>
              </div>

              {(!initialValues?.brand || onBack) && (
                <button
                  type="button"
                  onClick={onBack ?? handleBackToStep1}
                  className="flex items-center gap-1 text-xs text-blue-700 dark:text-blue-300 hover:underline"
                >
                  <ChevronLeft className="w-3 h-3" />
                  別のインスリンを選ぶ
                </button>
              )}
            </div>
          )}

          {/* 投与量グリッド */}
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label className="text-sm font-medium">いつ何単位使いますか？</Label>
              <Info className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground -mt-1">使わないタイミングは空欄のままでOKです</p>
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

          {/* カスタム名（省略可） */}
          <div className="space-y-1">
            <Label htmlFor="preset-name" className="text-sm">
              このインスリンの呼び名（省略可）
            </Label>
            <Input
              id="preset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={selectedBrand?.shortName ?? "例: 朝のノボラピッド"}
              className="h-9"
            />
            <p className="text-xs text-muted-foreground">
              空欄の場合「{selectedBrand?.shortName}」として登録されます
            </p>
          </div>

          {/* ボタン */}
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting} className="flex-1">
              <X className="w-4 h-4 mr-1" />
              キャンセル
            </Button>
            <Button type="submit" disabled={isSubmitting || !selectedBrand} className="flex-1">
              <Save className="w-4 h-4 mr-1" />
              {isSubmitting ? "保存中..." : "登録する"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
