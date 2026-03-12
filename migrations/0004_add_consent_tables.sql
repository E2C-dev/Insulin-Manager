-- 規約バージョン管理テーブル
CREATE TABLE "terms_versions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "doc_type" text NOT NULL,         -- "terms" | "privacy"
  "version" text NOT NULL,
  "summary" text,
  "is_active" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "activated_at" timestamp
);

-- ユーザー同意記録テーブル
CREATE TABLE "user_consents" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "terms_version_id" varchar NOT NULL REFERENCES "terms_versions"("id"),
  "consented_at" timestamp NOT NULL DEFAULT now(),
  "ip_address" text,
  "user_agent" text,
  UNIQUE ("user_id", "terms_version_id")
);

CREATE INDEX "idx_user_consents_user_id" ON "user_consents"("user_id");
CREATE INDEX "idx_terms_versions_active" ON "terms_versions"("doc_type", "is_active");

-- 初期バージョンを登録（利用規約 v1.0 と プライバシーポリシー v1.0）
INSERT INTO "terms_versions" ("doc_type", "version", "summary", "is_active", "activated_at") VALUES
  ('terms',   'v1.0', 'サービス開始に伴う初版利用規約です。', true, now()),
  ('privacy', 'v1.0', 'サービス開始に伴う初版プライバシーポリシーです。', true, now());
