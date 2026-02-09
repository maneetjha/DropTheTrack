const { Router } = require("express");
const crypto = require("crypto");
const prisma = require("../config/db");
const { requireAuth } = require("../middleware/auth");

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
    res.status(201).json(room);
  } catch (err) {
    console.error("[Rooms] Create error:", err);
    res.status(500).json({ error: "Failed to create room" });
  }
});

// List all rooms
router.get("/", async (_req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(rooms);
  } catch (err) {
    console.error("[Rooms] List error:", err);
    res.status(500).json({ error: "Failed to fetch rooms" });
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

module.exports = router;
