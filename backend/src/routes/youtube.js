const { Router } = require("express");
const { Innertube } = require("youtubei.js");
const { requireAuth } = require("../middleware/auth");

const router = Router();

// Cache the Innertube instance so we don't re-create it every request
let ytClient = null;
async function getYT() {
  if (!ytClient) {
    ytClient = await Innertube.create({ lang: "en", location: "US" });
  }
  return ytClient;
}

// Search YouTube videos via youtubei.js (InnerTube API — fast, no quota)
router.get("/search", requireAuth, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: "Search query is required" });
    }

    const yt = await getYT();
    const search = await yt.search(q.trim(), { type: "video" });

    const results = (search.results || [])
      .filter((v) => v.type === "Video")
      .slice(0, 10)
      .map((v) => ({
        videoId: v.id,
        title: v.title?.text || v.title || "",
        thumbnail:
          v.thumbnails?.[0]?.url ||
          `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`,
        channelTitle: v.author?.name || "",
      }));

    res.json(results);
  } catch (err) {
    console.error("[YouTube] Search error:", err);
    // If the client broke, reset it for next request
    ytClient = null;
    res.status(500).json({ error: "Failed to search YouTube" });
  }
});

module.exports = router;
