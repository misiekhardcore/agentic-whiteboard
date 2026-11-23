CREATE TABLE "media" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by_user_id TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP(3) DEFAULT now() NOT NULL
);

CREATE INDEX "Media_storageKey_idx" ON "media" USING btree (storage_key);