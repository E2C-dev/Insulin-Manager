import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
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
import {
  type InsulinPreset,
  INSULIN_TIME_SLOTS,
  INSULIN_TIME_SLOT_LABELS,
  getPresetDefaultUnits,
} from "@/lib/types";
import { InsulinPresetForm, type InsulinPresetFormData } from "./InsulinPresetForm";

interface InsulinPresetCardProps {
  preset: InsulinPreset;
  onUpdate: (data: Partial<InsulinPreset> & { id: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isUpdating: boolean;
  isDeleting: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  超速効型: "bg-orange-100 text-orange-800 border-orange-200",
  速効型: "bg-yellow-100 text-yellow-800 border-yellow-200",
  中間型: "bg-green-100 text-green-800 border-green-200",
  持効型: "bg-blue-100 text-blue-800 border-blue-200",
  超持効型: "bg-purple-100 text-purple-800 border-purple-200",
  混合型: "bg-gray-100 text-gray-800 border-gray-200",
};

export function InsulinPresetCard({ preset, onUpdate, onDelete, isUpdating, isDeleting }: InsulinPresetCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleUpdate = async (data: InsulinPresetFormData) => {
    await onUpdate({ id: preset.id, ...data });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    await onDelete(preset.id);
    setIsDeleteDialogOpen(false);
  };

  if (isEditing) {
    return (
      <InsulinPresetForm
        initialValues={preset}
        onSubmit={handleUpdate}
        onCancel={() => setIsEditing(false)}
        isSubmitting={isUpdating}
      />
    );
  }

  return (
    <>
      <Card className="border">
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-semibold text-sm">{preset.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[preset.category] ?? "bg-gray-100 text-gray-800"}`}>
                  {preset.category}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{preset.brand}</p>

              {/* 投与量グリッド */}
              <div className="grid grid-cols-4 gap-1">
                {INSULIN_TIME_SLOTS.map((slot) => {
                  const units = getPresetDefaultUnits(preset, slot);
                  return (
                    <div key={slot} className="text-center">
                      <div className="text-[10px] text-muted-foreground">{INSULIN_TIME_SLOT_LABELS[slot]}</div>
                      <div className={`text-sm font-semibold ${units !== null ? "text-primary" : "text-muted-foreground/40"}`}>
                        {units !== null ? `${units}u` : "-"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsEditing(true)}
                title="編集"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => setIsDeleteDialogOpen(true)}
                title="削除"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>プリセットを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              「{preset.name}」を削除します。過去の記録には影響しません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "削除中..." : "削除する"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
