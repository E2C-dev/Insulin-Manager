import { useQuery } from "@tanstack/react-query";

interface FeatureFlags {
  show_ads: boolean;
  enable_user_registration: boolean;
  [key: string]: boolean;
}

const defaultFlags: FeatureFlags = {
  show_ads: false,
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
    showAds: resolvedFlags.show_ads,
    enableRegistration: resolvedFlags.enable_user_registration,
  };
}
