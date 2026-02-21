import { type InsulinPreset, type InsulinTimeSlot, getPresetDefaultUnits } from "@/lib/types";
import { Syringe } from "lucide-react";

interface InsulinPresetSelectorProps {
  timeSlot: InsulinTimeSlot;
  presets: InsulinPreset[];
  selectedPresetId: string | null;
  onPresetSelect: (presetId: string, units: number) => void;
}

export function InsulinPresetSelector({
  timeSlot,
  presets,
  selectedPresetId,
  onPresetSelect,
}: InsulinPresetSelectorProps) {
  const applicablePresets = presets.filter(
    (p) => getPresetDefaultUnits(p, timeSlot) !== null
  );

  if (applicablePresets.length === 0) return null;

  return (
    <div className="space-y-2 pt-3 border-t border-orange-200 dark:border-orange-800">
      <div className="flex items-center gap-2">
        <Syringe className="w-4 h-4 text-orange-700 dark:text-orange-300" />
        <h4 className="text-sm font-semibold text-orange-900 dark:text-orange-100">
          使用するインスリンを選択
        </h4>
      </div>
      <div className="flex flex-wrap gap-2">
        {applicablePresets.map((preset) => {
          const defaultUnits = getPresetDefaultUnits(preset, timeSlot);
          const isSelected = selectedPresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                if (defaultUnits !== null) {
                  onPresetSelect(preset.id, defaultUnits);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                isSelected
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white dark:bg-gray-900 border-orange-200 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-950/30"
              }`}
            >
              <span className="font-medium">{preset.name}</span>
              <span className={`text-xs ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {defaultUnits}u
              </span>
            </button>
          );
        })}
      </div>
      {selectedPresetId && (
        <p className="text-xs text-orange-700 dark:text-orange-300">
          選択したインスリンのデフォルト量が自動入力されました（手動で変更可）
        </p>
      )}
    </div>
  );
}
