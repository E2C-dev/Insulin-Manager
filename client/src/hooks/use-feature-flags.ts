import { useQuery } from "@tanstack/react-query";

interface FeatureFlags {
  enable_user_registration: boolean;
  [key: string]: boolean;
}

// D-003 (薬機法対策パッケージ): 広告機能を全面撤去したため show_ads フラグは廃止。
// DB 上の旧レコードは残るが、クライアントからは一切参照しない。
const defaultFlags: FeatureFlags = {
  enable_user_registration: true,
};

async function fetchFeatureFlags(): Promise<FeatureFlags> {
  try {
    const res = await fetch("/api/feature-flags/public");
    if (!res.ok) return defaultFlags;
    const data = await res.json();
    return { ...defaultFlags, ...data.flags };
  } catch {
    return defaultFlags;
  }
}

export function useFeatureFlags() {
  const { data: flags } = useQuery({
    queryKey: ["feature-flags"],
    queryFn: fetchFeatureFlags,
    staleTime: 1000 * 60 * 10, // 10分キャッシュ
  });

  const resolvedFlags = flags ?? defaultFlags;

  return {
    flags: resolvedFlags,
    enableRegistration: resolvedFlags.enable_user_registration,
  };
}
