const { Router } = require("express");
const { requireAuth } = require("../middleware/auth");

const router = Router();

const YOUTUBE_API_URL = "https://www.googleapis.com/youtube/v3/search";

// Search YouTube videos (protected — only logged-in users)
router.get("/search", requireAuth, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: "Search query is required" });
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.error("[YouTube] YOUTUBE_API_KEY is not set");
      return res.status(500).json({ error: "YouTube search is not configured" });
    }

    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      maxResults: "8",
      q: q.trim(),
      key: apiKey,
    });

    const response = await fetch(`${YOUTUBE_API_URL}?${params}`);

    if (!response.ok) {
      const error = await response.json();
      console.error("[YouTube] API error:", error);
      return res.status(502).json({ error: "YouTube search failed" });
    }

    const data = await response.json();

    const results = (data.items || []).map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || null,
      channelTitle: item.snippet.channelTitle,
    }));

    res.json(results);
  } catch (err) {
    console.error("[YouTube] Search error:", err);
    res.status(500).json({ error: "Failed to search YouTube" });
  }
});

module.exports = router;
