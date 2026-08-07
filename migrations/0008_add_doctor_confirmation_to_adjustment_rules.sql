-- D-003 (薬機法対策パッケージ): adjustment_rules に「主治医指示の転記」記録カラムを追加
--
-- 目的:
--   本アプリの調整ルールは「アプリが投与量を決める」ものではなく、
--   主治医から受けた指示をユーザーが転記したものである、という位置づけを
--   データとして残す (厚労省 医療機器プログラム該当性 判断事例⑫ 対応)。
--
-- 既存データの扱い (重要):
--   既存レコードは doctor_confirmed = false のまま残す。削除もブロックもしない。
--   UI 側は「主治医指示の確認が未入力」バッジを表示するだけに留める。
--   NOT NULL DEFAULT false なので既存行は自動で false が入る。
--
-- 適用前確認:
--   \d adjustment_rules
-- 適用後確認:
--   \d adjustment_rules
--   SELECT count(*) FILTER (WHERE doctor_confirmed) AS confirmed,
--          count(*) FILTER (WHERE NOT doctor_confirmed) AS unconfirmed
--   FROM adjustment_rules;

ALTER TABLE "adjustment_rules"
  ADD COLUMN IF NOT EXISTS "doctor_confirmed" boolean NOT NULL DEFAULT false;

ALTER TABLE "adjustment_rules"
  ADD COLUMN IF NOT EXISTS "instructed_at" date;

ALTER TABLE "adjustment_rules"
  ADD COLUMN IF NOT EXISTS "instructed_by" text;
