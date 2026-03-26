const { Router } = require("express");
const prisma = require("../config/db");
const { requireAuth } = require("../middleware/auth");

const router = Router();

// GET /api/rooms/:roomId/messages — last 100 messages
router.get("/:roomId/messages", requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;

    const messages = await prisma.message.findMany({
      where: { roomId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        replyTo: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    // Return in chronological order (oldest first)
    const result = messages.reverse().map((m) => ({
      id: m.id,
      text: m.text,
      userId: m.user.id,
      userName: m.user.name,
      userAvatarUrl: m.user.avatarUrl,
      replyTo: m.replyTo
        ? {
            id: m.replyTo.id,
            userName: m.replyTo.user?.name || "Unknown",
            text: m.replyTo.text,
          }
        : null,
      meta: m.meta,
      createdAt: m.createdAt,
    }));

    res.json(result);
  } catch (err) {
    console.error("[Messages] Fetch error:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

module.exports = router;
