CREATE TABLE IF NOT EXISTS "whatsapp_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL UNIQUE REFERENCES "organizations"("id") ON DELETE CASCADE,
  "phone_number_id" text NOT NULL,
  "whatsapp_business_id" text NOT NULL,
  "access_token" text NOT NULL,
  "display_phone_number" text,
  "display_name" text,
  "webhook_verify_token" text NOT NULL UNIQUE,
  "is_active" boolean DEFAULT true,
  "ai_auto_reply" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "whatsapp_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "message_id" uuid REFERENCES "messages"("id") ON DELETE SET NULL,
  "wa_message_id" text UNIQUE,
  "wa_contact_id" text,
  "direction" text NOT NULL,
  "status" text DEFAULT 'sent',
  "message_type" text DEFAULT 'text',
  "media_url" text,
  "media_mime_type" text,
  "raw_payload" jsonb,
  "created_at" timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_whatsapp_messages_wa_id"
  ON "whatsapp_messages"("wa_message_id");

CREATE INDEX IF NOT EXISTS "idx_whatsapp_messages_conv"
  ON "whatsapp_messages"("conversation_id");
