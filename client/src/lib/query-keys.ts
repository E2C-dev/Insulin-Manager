/**
 * QUERY_KEYS — TanStack Query の queryKey 統一定数。
 *
 * 同じデータに異なるキーを使うと invalidateQueries が効かず、
 * 「ルール作成→Entry に戻ったが旧データ表示」(BUG-005) のような
 * キャッシュ非共有バグが発生する。全 queryKey をここに集約する。
 *
 * 用法:
 *   useQuery({ queryKey: QUERY_KEYS.ADJUSTMENT_RULES, ... })
 *   queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADJUSTMENT_RULES })
 *
 * 日付などのパラメータ付きキーは関数で生成する:
 *   useQuery({ queryKey: QUERY_KEYS.GLUCOSE_ENTRIES_BY_DATE(date), ... })
 *   queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GLUCOSE_ENTRIES }) // 全日付を一括無効化
 */
export const QUERY_KEYS = {
  ADJUSTMENT_RULES: [adjustment-rules] as const,
  INSULIN_PRESETS: [insulin-presets] as const,
  INSULIN_ENTRIES: [insulin-entries] as const,
  INSULIN_ENTRIES_BY_DATE: (date: string) => [insulin-entries, date] as const,
  GLUCOSE_ENTRIES: [glucose-entries] as const,
  GLUCOSE_ENTRIES_BY_DATE: (date: string) => [glucose-entries, date] as const,
  FEATURE_FLAGS: [feature-flags] as const,
  AUDIT_LOGS: [audit-logs] as const,
  TERMS_CONTENT: [terms-content] as const,
  USER_PROFILE: [auth, user] as const,
  TUTORIAL_SEEN: [tutorial-seen] as const,
} as const;
