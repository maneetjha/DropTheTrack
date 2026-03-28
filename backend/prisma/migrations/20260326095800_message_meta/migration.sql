-- AlterTable (IF NOT EXISTS: meta may already exist from db push / partial migrate)
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "meta" JSONB;

