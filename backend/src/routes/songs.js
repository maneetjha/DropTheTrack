const { Router } = require("express");
const prisma = require("../config/db");
const { requireAuth } = require("../middleware/auth");

const router = Router();

// Add a song to a room (protected)
router.post("/:roomId/songs", requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { title, url, thumbnail } = req.body;

    if (!title || !url) {
      return res.status(400).json({ error: "title and url are required" });
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
    res.status(201).json(song);
  } catch (err) {
    console.error("[Songs] Add error:", err);
    res.status(500).json({ error: "Failed to add song" });
  }
});

// Get the queue for a room (public)
router.get("/:roomId/songs", async (req, res) => {
  try {
    const { roomId } = req.params;
    const songs = await prisma.song.findMany({
      where: { roomId, played: false },
      orderBy: [{ upvotes: "desc" }, { createdAt: "asc" }],
      include: {
        user: { select: { id: true, name: true } },
      },
    });
    res.json(songs);
  } catch (err) {
    console.error("[Songs] Get queue error:", err);
    res.status(500).json({ error: "Failed to fetch queue" });
  }
});

// Upvote a song (protected)
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

    if (existing) {
      return res.status(409).json({ error: "Already voted" });
    }

    // Create vote and increment upvote count in a transaction
    const [, updatedSong] = await prisma.$transaction([
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

    res.json(updatedSong);
  } catch (err) {
    console.error("[Songs] Upvote error:", err);
    res.status(500).json({ error: "Failed to upvote" });
  }
});

module.exports = router;
