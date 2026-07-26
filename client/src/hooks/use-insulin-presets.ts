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

  // Codex round 5 fix: preset fetch error は medical safety critical のため
  // fail-closed にする。 isError を expose して 呼び出し側で自動計算と保存を
  // ブロックできるようにする。
  const { data: presets = [], isLoading, isError } = useQuery({
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
  // Codex指摘対応 (2026-07-26): 戻り値に presetId を含める。
  // 従来は units のみ返していたため、自動計算 (Entry.tsx の useEffect) で
  // 決まった基礎量がどのプリセット由来かクライアントが把握できず、
  // server/insulinDoseSafetyNet.ts の defense-in-depth チェックが
  // presetId 未送信を理由に自動計算パスを一切検証できていなかった。
  const getBasalDosesFromPresets = useCallback(
    (slot: InsulinTimeSlot): { presetId: string | null; units: number } => {
      for (const preset of presets) {
        const units = getPresetDefaultUnits(preset, slot);
        if (units !== null) return { presetId: preset.id, units };
      }
      const stored = safeParseLocalStorage<Record<string, number>>("basalInsulinDoses", {});
      return { presetId: null, units: stored[slot] ?? 0 };
    },
    [presets]
  );

  return {
    presets,
    isLoading,
    isError,
    createPreset: createMutation.mutateAsync,
    updatePreset: updateMutation.mutateAsync,
    deletePreset: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    getBasalDosesFromPresets,
  };
}
