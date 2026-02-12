const cron = require("node-cron");
const prisma = require("../config/db");

/**
 * Room cleanup cron job
 * Runs every day at 3:00 AM
 *
 * Deletes:
 * 1. Rooms older than 30 days with zero unplayed songs
 * 2. Played songs older than 7 days (keeps DB lean)
 */
function startCleanupCron() {
  // Run daily at 3:00 AM
  cron.schedule("0 3 * * *", async () => {
    console.log("[Cron] Running room & song cleanup...");

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // 1. Delete stale rooms (created > 30 days ago with no unplayed songs)
      const staleRooms = await prisma.room.findMany({
        where: {
          createdAt: { lt: thirtyDaysAgo },
          songs: {
            none: {
              played: false,
            },
          },
        },
        select: { id: true, name: true },
      });

      if (staleRooms.length > 0) {
        // Cascade delete handles songs, votes, room_members
        const deleted = await prisma.room.deleteMany({
          where: {
            id: { in: staleRooms.map((r) => r.id) },
          },
        });
        console.log(`[Cron] Deleted ${deleted.count} stale rooms (>30 days, no active songs)`);
      }

      // 2. Clean up played songs older than 7 days
      const deletedSongs = await prisma.song.deleteMany({
        where: {
          played: true,
          createdAt: { lt: sevenDaysAgo },
        },
      });

      if (deletedSongs.count > 0) {
        console.log(`[Cron] Deleted ${deletedSongs.count} played songs (>7 days old)`);
      }

      // 3. Clean up orphaned votes (songs that no longer exist)
      // Prisma cascade handles this automatically via onDelete: Cascade

      console.log("[Cron] Cleanup complete");
    } catch (err) {
      console.error("[Cron] Cleanup failed:", err);
    }
  });

  console.log("[Cron] Room cleanup scheduled (daily at 3:00 AM)");
}

module.exports = { startCleanupCron };
