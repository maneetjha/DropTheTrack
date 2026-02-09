const { Router } = require("express");
const prisma = require("../config/db");
const { requireAuth, optionalAuth } = require("../middleware/auth");

const router = Router();

// Add a song to a room (protected)
router.post("/:roomId/songs", requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { title, url, thumbnail } = req.body;

    if (!title || !url) {
      return res.status(400).json({ error: "title and url are required" });
    }

    // Check room mode — in listen_only, only the host can add songs
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    if (room.mode === "listen_only" && room.createdBy !== req.user.id) {
      return res.status(403).json({ error: "Room is in listen-only mode. Only the host can add songs." });
    }

    const song = await prisma.song.create({
      data: {
        roomId,
        title,
        url,
        thumbnail: thumbnail || null,
        userId: req.user.id,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });
    res.status(201).json({ ...song, hasVoted: false });
  } catch (err) {
    console.error("[Songs] Add error:", err);
    res.status(500).json({ error: "Failed to add song" });
  }
});

// Get the queue for a room (optionalAuth so we can check hasVoted)
router.get("/:roomId/songs", optionalAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user?.id;

    const songs = await prisma.song.findMany({
      where: { roomId, played: false },
      orderBy: [{ upvotes: "desc" }, { createdAt: "asc" }],
      include: {
        user: { select: { id: true, name: true } },
        votes: userId
          ? { where: { userId }, select: { id: true } }
          : false,
      },
    });

    // Map to add hasVoted and strip the votes array
    const result = songs.map((song) => {
      const { votes, ...rest } = song;
      return {
        ...rest,
        hasVoted: Array.isArray(votes) && votes.length > 0,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("[Songs] Get queue error:", err);
    res.status(500).json({ error: "Failed to fetch queue" });
  }
});

// Toggle vote on a song (protected) — vote if not voted, unvote if already voted
router.post("/songs/:songId/upvote", requireAuth, async (req, res) => {
  try {
    const { songId } = req.params;
    const userId = req.user.id;

    // Check if already voted
    const existing = await prisma.vote.findUnique({
      where: {
        songId_userId: { songId, userId },
      },
    });

    let updatedSong;

    if (existing) {
      // Remove vote and decrement
      [, updatedSong] = await prisma.$transaction([
        prisma.vote.delete({
          where: { id: existing.id },
        }),
        prisma.song.update({
          where: { id: songId },
          data: { upvotes: { decrement: 1 } },
          include: {
            user: { select: { id: true, name: true } },
          },
        }),
      ]);
      res.json({ ...updatedSong, hasVoted: false });
    } else {
      // Create vote and increment
      [, updatedSong] = await prisma.$transaction([
        prisma.vote.create({
          data: { songId, userId },
        }),
        prisma.song.update({
          where: { id: songId },
          data: { upvotes: { increment: 1 } },
          include: {
            user: { select: { id: true, name: true } },
          },
        }),
      ]);
      res.json({ ...updatedSong, hasVoted: true });
    }
  } catch (err) {
    console.error("[Songs] Vote toggle error:", err);
    res.status(500).json({ error: "Failed to toggle vote" });
  }
});

module.exports = router;
