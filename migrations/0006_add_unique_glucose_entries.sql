-- BUG-011: 連打による重複エントリ防止のための UNIQUE 制約
--
-- 注意: このマイグレーションは CEO 承認後に手動で適用すること。
-- 既に重複データが存在する場合は事前にクレンジング SQL が必要。
-- 本番環境では `npx drizzle-kit push` ではなく直接実行すること。
--
-- 適用前確認:
--   SELECT user_id, date, time_slot, COUNT(*) c FROM glucose_entries
--   GROUP BY user_id, date, time_slot HAVING COUNT(*) > 1;
--
-- 既存重複がある場合のクレンジング例 (最新1件残し他削除):
--   DELETE FROM glucose_entries g1
--   USING glucose_entries g2
--   WHERE g1.user_id = g2.user_id
--     AND g1.date = g2.date
--     AND g1.time_slot = g2.time_slot
--     AND g1.created_at < g2.created_at;

-- 血糖値: 1ユーザー × 1日 × 1タイムスロットにつき1エントリ
ALTER TABLE "glucose_entries"
  ADD CONSTRAINT "glucose_entries_user_date_slot_unique"
  UNIQUE ("user_id", "date", "time_slot");

-- インスリンは UNIQUE 制約を追加しない:
-- 同一タイムスロットで複数のプリセット (持効型 + 速効型混合等) を使うケースがあるため
-- 重複は preset_id まで含めた複合キーが妥当だが、それでも分割注射するユーザーがいるため運用上ペンディング。
