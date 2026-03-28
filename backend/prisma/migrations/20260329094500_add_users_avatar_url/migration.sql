-- users may exist without avatar_url (CREATE TABLE IF NOT EXISTS skipped full definition)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_url" TEXT;
