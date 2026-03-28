-- Idempotent: safe when DB was partially migrated, pushed, or already aligned (e.g. Neon + Prisma push).

DROP INDEX IF EXISTS "votes_song_id_voter_id_key";

-- New tables first (songs.user_id / votes.user_id may reference users)
CREATE TABLE IF NOT EXISTS "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" TEXT NOT NULL,
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "room_members" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "messages" (
    "id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "text" VARCHAR(500) NOT NULL,
    "reply_to_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "library_items" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "playlists" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "playlist_items" (
    "id" UUID NOT NULL,
    "playlist_id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playlist_items_pkey" PRIMARY KEY ("id")
);

-- messages may pre-exist without reply_to_id (CREATE TABLE IF NOT EXISTS skips)
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "reply_to_id" UUID;

-- AlterTable rooms
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "code" VARCHAR(8);
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "created_by" UUID;
ALTER TABLE "rooms" ADD COLUMN IF NOT EXISTS "mode" VARCHAR(20) NOT NULL DEFAULT 'open';
UPDATE "rooms" SET "code" = SUBSTRING(REPLACE((gen_random_uuid())::text, '-', ''), 1, 8) WHERE "code" IS NULL;
ALTER TABLE "rooms" ALTER COLUMN "code" SET NOT NULL;

-- AlterTable songs
ALTER TABLE "songs" DROP COLUMN IF EXISTS "added_by";
ALTER TABLE "songs" ADD COLUMN IF NOT EXISTS "user_id" UUID;
UPDATE "songs" SET "user_id" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1) WHERE "user_id" IS NULL AND EXISTS (SELECT 1 FROM "users");
ALTER TABLE "songs" ALTER COLUMN "user_id" SET NOT NULL;

-- AlterTable votes
ALTER TABLE "votes" DROP COLUMN IF EXISTS "voter_id";
ALTER TABLE "votes" ADD COLUMN IF NOT EXISTS "user_id" UUID;
UPDATE "votes" SET "user_id" = (SELECT "id" FROM "users" ORDER BY "created_at" ASC LIMIT 1) WHERE "user_id" IS NULL AND EXISTS (SELECT 1 FROM "users");
ALTER TABLE "votes" ALTER COLUMN "user_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "room_members_room_id_user_id_key" ON "room_members"("room_id", "user_id");
CREATE INDEX IF NOT EXISTS "library_items_user_id_created_at_idx" ON "library_items"("user_id", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "library_items_user_id_url_key" ON "library_items"("user_id", "url");
CREATE INDEX IF NOT EXISTS "playlists_user_id_updated_at_idx" ON "playlists"("user_id", "updated_at");
CREATE INDEX IF NOT EXISTS "playlist_items_playlist_id_created_at_idx" ON "playlist_items"("playlist_id", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "playlist_items_playlist_id_url_key" ON "playlist_items"("playlist_id", "url");
CREATE UNIQUE INDEX IF NOT EXISTS "rooms_code_key" ON "rooms"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "votes_song_id_user_id_key" ON "votes"("song_id", "user_id");

-- AddForeignKey (ignore if already present)
DO $$ BEGIN ALTER TABLE "room_members" ADD CONSTRAINT "room_members_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "room_members" ADD CONSTRAINT "room_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "songs" ADD CONSTRAINT "songs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "messages" ADD CONSTRAINT "messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "library_items" ADD CONSTRAINT "library_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "playlists" ADD CONSTRAINT "playlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
