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

// Remove a song from the queue (host or the person who added it)
router.delete("/songs/:songId", requireAuth, async (req, res) => {
  try {
    const { songId } = req.params;

    const song = await prisma.song.findUnique({
      where: { id: songId },
      include: { room: { select: { createdBy: true } } },
    });

    if (!song) {
      return res.status(404).json({ error: "Song not found" });
    }

    const isHost = song.room.createdBy === req.user.id;
    const isAdder = song.userId === req.user.id;

    if (!isHost && !isAdder) {
      return res.status(403).json({ error: "Only the host or the person who added this song can remove it" });
    }

    await prisma.song.delete({ where: { id: songId } });
    res.json({ success: true });
  } catch (err) {
    console.error("[Songs] Remove error:", err);
    res.status(500).json({ error: "Failed to remove song" });
  }
});

// Set a song as "now playing" (host only) — clears any previous now-playing in the room
router.post("/songs/:songId/play", requireAuth, async (req, res) => {
  try {
    const { songId } = req.params;

    const song = await prisma.song.findUnique({
      where: { id: songId },
      include: { room: { select: { createdBy: true } } },
    });

    if (!song) {
      return res.status(404).json({ error: "Song not found" });
    }
    if (song.room.createdBy !== req.user.id) {
      return res.status(403).json({ error: "Only the host can control playback" });
    }

    // Clear any current "now playing" in this room, then set the new one
    await prisma.$transaction([
      prisma.song.updateMany({
        where: { roomId: song.roomId, isPlaying: true },
        data: { isPlaying: false },
      }),
      prisma.song.update({
        where: { id: songId },
        data: { isPlaying: true },
      }),
    ]);

    const updated = await prisma.song.findUnique({
      where: { id: songId },
      include: { user: { select: { id: true, name: true } } },
    });

    res.json(updated);
  } catch (err) {
    console.error("[Songs] Play error:", err);
    res.status(500).json({ error: "Failed to play song" });
  }
});

// Skip current song — marks it as played and plays the next one (host only)
router.post("/:roomId/songs/skip", requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    if (room.createdBy !== req.user.id) {
      return res.status(403).json({ error: "Only the host can skip songs" });
    }

    // Mark current playing song as played
    await prisma.song.updateMany({
      where: { roomId, isPlaying: true },
      data: { isPlaying: false, played: true },
    });

    // Get the next song (highest upvotes, then oldest)
    const next = await prisma.song.findFirst({
      where: { roomId, played: false },
      orderBy: [{ upvotes: "desc" }, { createdAt: "asc" }],
    });

    if (next) {
      await prisma.song.update({
        where: { id: next.id },
        data: { isPlaying: true },
      });
    }

    // Return the full updated queue
    const songs = await prisma.song.findMany({
      where: { roomId, played: false },
      orderBy: [{ upvotes: "desc" }, { createdAt: "asc" }],
      include: { user: { select: { id: true, name: true } } },
    });

    res.json(songs);
  } catch (err) {
    console.error("[Songs] Skip error:", err);
    res.status(500).json({ error: "Failed to skip song" });
  }
});

module.exports = router;
