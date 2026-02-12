const { Router } = require("express");
const yts = require("yt-search");
const { requireAuth } = require("../middleware/auth");

const router = Router();

// Search YouTube videos via yt-search (no API key needed, no quota)
router.get("/search", requireAuth, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: "Search query is required" });
    }

    const data = await yts(q.trim());

    const results = (data.videos || []).slice(0, 8).map((v) => ({
      videoId: v.videoId,
      title: v.title,
      thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`,
      channelTitle: v.author?.name || "",
    }));

    res.json(results);
  } catch (err) {
    console.error("[YouTube] Search error:", err);
    res.status(500).json({ error: "Failed to search YouTube" });
  }
});

module.exports = router;
