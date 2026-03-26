const { Router } = require("express");
const prisma = require("../config/db");
const { requireAuth } = require("../middleware/auth");

const router = Router();

// GET /api/library — list saved items for current user
router.get("/", requireAuth, async (req, res) => {
  try {
    const items = await prisma.libraryItem.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    res.json(items);
  } catch (err) {
    console.error("[Library] Fetch error:", err);
    res.status(500).json({ error: "Failed to fetch library" });
  }
});

// POST /api/library — save a track
router.post("/", requireAuth, async (req, res) => {
  try {
    const { title, url, thumbnail } = req.body || {};
    if (!title || !url) {
      return res.status(400).json({ error: "title and url are required" });
    }

    const item = await prisma.libraryItem.upsert({
      where: { userId_url: { userId: req.user.id, url } },
      update: { title, thumbnail: thumbnail || null },
      create: {
        userId: req.user.id,
        title,
        url,
        thumbnail: thumbnail || null,
      },
    });

    res.status(201).json(item);
  } catch (err) {
    console.error("[Library] Save error:", err);
    res.status(500).json({ error: "Failed to save to library" });
  }
});

// DELETE /api/library/:id — remove a saved item
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const item = await prisma.libraryItem.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!item) return res.status(404).json({ error: "Not found" });
    if (item.userId !== req.user.id) return res.status(403).json({ error: "Forbidden" });

    await prisma.libraryItem.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error("[Library] Delete error:", err);
    res.status(500).json({ error: "Failed to remove from library" });
  }
});

module.exports = router;

