import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type InsulinPreset, type InsulinTimeSlot, getPresetDefaultUnits } from "@/lib/types";
import { safeParseLocalStorage } from "@/lib/storage-utils";

async function fetchPresets(): Promise<InsulinPreset[]> {
  const response = await fetch("/api/insulin-presets", { credentials: "include" });
  if (!response.ok) throw new Error("プリセットの取得に失敗しました");
  const data = await response.json();
  return data.presets;
}

export function useInsulinPresets() {
  const queryClient = useQueryClient();

  const { data: presets = [], isLoading } = useQuery({
    queryKey: ["insulin-presets"],
    queryFn: fetchPresets,
    staleTime: 1000 * 60 * 5, // 5分間キャッシュ（設定は頻繁に変わらない）
  });

  const createMutation = useMutation({
    mutationFn: async (data: Omit<InsulinPreset, "id" | "userId" | "createdAt" | "updatedAt" | "isActive">) => {
      const response = await fetch("/api/insulin-presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "プリセットの作成に失敗しました");
      }
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["insulin-presets"] }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<InsulinPreset> & { id: string }) => {
      const response = await fetch(`/api/insulin-presets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "プリセットの更新に失敗しました");
      }
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["insulin-presets"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/insulin-presets/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "プリセットの削除に失敗しました");
      }
      return response.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["insulin-presets"] }),
  });

  // 後方互換: プリセットがない場合はlocalStorageからフォールバック
  // useCallback で参照安定化。これを呼び出している useMemo (Entry.tsx の
  // getInsulinTimingInfo) が依存配列に getBasalDosesFromPresets を入れているため、
  // 関数参照が毎レンダー変わると useMemo が常に再計算 → さらに自動計算 useEffect
  // が無限ループ気味に発火し setState → Maximum update depth exceeded で
  // ホワイトアウトする原因になる (B-001 根本原因 B)。
  const getBasalDosesFromPresets = useCallback(
    (slot: InsulinTimeSlot): number => {
      for (const preset of presets) {
        const units = getPresetDefaultUnits(preset, slot);
        if (units !== null) return units;
      }
      const stored = safeParseLocalStorage<Record<string, number>>("basalInsulinDoses", {});
      return stored[slot] ?? 0;
    },
    [presets]
  );

  return {
    presets,
    isLoading,
    createPreset: createMutation.mutateAsync,
    updatePreset: updateMutation.mutateAsync,
    deletePreset: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    getBasalDosesFromPresets,
  };
}
