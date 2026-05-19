-- B-002 完全解消: insulin_entries に UNIQUE 制約を追加
--
-- 注意: このマイグレーションは CEO 承認後に手動で適用すること。
-- 既に重複データがある場合は事前にクレンジング SQL が必要。
-- 本番環境では `npx drizzle-kit push` ではなく直接実行すること。
--
-- 適用前確認:
--   SELECT user_id, date, time_slot, preset_id, COUNT(*) c
--   FROM insulin_entries
--   GROUP BY user_id, date, time_slot, preset_id
--   HAVING COUNT(*) > 1;
--
-- 既存重複がある場合のクレンジング (updated_at最新を残し他削除、 同時刻は id 昇順を残す):
--   DELETE FROM insulin_entries g1
--   USING insulin_entries g2
--   WHERE g1.user_id = g2.user_id
--     AND g1.date = g2.date
--     AND g1.time_slot = g2.time_slot
--     AND ((g1.preset_id IS NULL AND g2.preset_id IS NULL)
--          OR g1.preset_id = g2.preset_id)
--     AND g1.id != g2.id
--     AND (g1.updated_at < g2.updated_at
--          OR (g1.updated_at = g2.updated_at AND g1.id > g2.id));

-- インスリン: 1ユーザー × 1日 × 1タイムスロット × 1プリセット につき1エントリ
-- preset_id が NULL でも互いに重複と扱う (= NULLS NOT DISTINCT)。
-- 持効型+速効型分割注射のため preset_id 別 を許容したいケースは preset_id 必須化で対応。
ALTER TABLE "insulin_entries"
  ADD CONSTRAINT "insulin_entries_user_date_slot_preset_unique"
  UNIQUE NULLS NOT DISTINCT ("user_id", "date", "time_slot", "preset_id");
