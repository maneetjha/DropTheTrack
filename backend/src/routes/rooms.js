const { Router } = require("express");
const crypto = require("crypto");
const prisma = require("../config/db");
const { requireAuth, optionalAuth } = require("../middleware/auth");

const router = Router();

/** Generate a short 6-char alphanumeric code */
function generateCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase(); // e.g. "A3F1B2"
}

// Create a new room (protected)
router.post("/", requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: "Room name is required" });
    }

    // Cap at 5 rooms per user
    const count = await prisma.room.count({ where: { createdBy: req.user.id } });
    if (count >= 5) {
      return res.status(400).json({ error: "You can have at most 5 rooms. Delete one to create a new one." });
    }

    // Generate unique code (retry if collision)
    let code;
    let attempts = 0;
    do {
      code = generateCode();
      const existing = await prisma.room.findUnique({ where: { code } });
      if (!existing) break;
      attempts++;
    } while (attempts < 5);

    const room = await prisma.room.create({
      data: {
        name: name.trim(),
        code,
        createdBy: req.user.id,
      },
    });

    // Also add creator as a member
    await prisma.roomMember.upsert({
      where: { roomId_userId: { roomId: room.id, userId: req.user.id } },
      update: { joinedAt: new Date() },
      create: { roomId: room.id, userId: req.user.id },
    });

    res.status(201).json(room);
  } catch (err) {
    console.error("[Rooms] Create error:", err);
    res.status(500).json({ error: "Failed to create room" });
  }
});

// My rooms — rooms created by the current user (max 5)
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      where: { createdBy: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    res.json(rooms);
  } catch (err) {
    console.error("[Rooms] My rooms error:", err);
    res.status(500).json({ error: "Failed to fetch your rooms" });
  }
});

// Recently joined rooms — last 10 rooms the user joined (excludes rooms they created)
router.get("/recent", requireAuth, async (req, res) => {
  try {
    const memberships = await prisma.roomMember.findMany({
      where: {
        userId: req.user.id,
        room: { createdBy: { not: req.user.id } },
      },
      orderBy: { joinedAt: "desc" },
      take: 10,
      include: {
        room: true,
      },
    });
    res.json(memberships.map((m) => m.room));
  } catch (err) {
    console.error("[Rooms] Recent rooms error:", err);
    res.status(500).json({ error: "Failed to fetch recent rooms" });
  }
});

// Track a room join (called when user enters a room)
router.post("/:id/join", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    await prisma.roomMember.upsert({
      where: { roomId_userId: { roomId: id, userId: req.user.id } },
      update: { joinedAt: new Date() },
      create: { roomId: id, userId: req.user.id },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("[Rooms] Join track error:", err);
    res.status(500).json({ error: "Failed to track join" });
  }
});

// Join room by code
router.get("/join/:code", async (req, res) => {
  try {
    const { code } = req.params;
    const room = await prisma.room.findUnique({
      where: { code: code.toUpperCase().trim() },
    });
    if (!room) {
      return res.status(404).json({ error: "Room not found. Check the code and try again." });
    }
    res.json(room);
  } catch (err) {
    console.error("[Rooms] Join by code error:", err);
    res.status(500).json({ error: "Failed to join room" });
  }
});

// Get a single room by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    res.json(room);
  } catch (err) {
    console.error("[Rooms] Get error:", err);
    res.status(500).json({ error: "Failed to fetch room" });
  }
});

// Update room mode (host only)
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { mode } = req.body;

    if (!mode || !["open", "listen_only"].includes(mode)) {
      return res.status(400).json({ error: "mode must be 'open' or 'listen_only'" });
    }

    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    if (room.createdBy !== req.user.id) {
      return res.status(403).json({ error: "Only the room creator can change settings" });
    }

    const updated = await prisma.room.update({
      where: { id },
      data: { mode },
    });
    res.json(updated);
  } catch (err) {
    console.error("[Rooms] Update mode error:", err);
    res.status(500).json({ error: "Failed to update room" });
  }
});

// Delete a room (only the creator can delete)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const room = await prisma.room.findUnique({ where: { id } });

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    if (room.createdBy !== req.user.id) {
      return res.status(403).json({ error: "Only the room creator can delete this room" });
    }

    await prisma.room.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error("[Rooms] Delete error:", err);
    res.status(500).json({ error: "Failed to delete room" });
  }
});

module.exports = router;
