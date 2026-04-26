CREATE TABLE IF NOT EXISTS "canned_responses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "category" text NOT NULL DEFAULT 'general',
  "shortcut" text,
  "content" text NOT NULL,
  "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "is_active" boolean NOT NULL DEFAULT true,
  "usage_count" integer NOT NULL DEFAULT 0,
  "last_used_at" timestamp,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "canned_responses_org_shortcut_unique"
  ON "canned_responses"("org_id", "shortcut");
