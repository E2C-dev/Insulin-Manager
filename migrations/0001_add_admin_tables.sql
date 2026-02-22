-- usersテーブルへの管理者用カラム追加
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'user';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp;

-- フィーチャーフラグテーブル（管理者がON/OFFを制御する機能フラグ）
CREATE TABLE IF NOT EXISTS "feature_flags" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL,
  "value" boolean NOT NULL DEFAULT false,
  "description" text,
  "updated_by" varchar REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "feature_flags_key_unique" UNIQUE("key")
);

-- 監査ログテーブル（管理者操作の履歴）
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "admin_id" varchar REFERENCES "users"("id") ON DELETE SET NULL,
  "action" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" varchar,
  "previous_value" text,
  "new_value" text,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- 初期フィーチャーフラグ
INSERT INTO "feature_flags" ("key", "value", "description")
VALUES
  ('show_ads', false, 'ダッシュボードに広告を表示するかどうか'),
  ('enable_user_registration', true, '新規ユーザー登録を許可するかどうか')
ON CONFLICT ("key") DO NOTHING;
