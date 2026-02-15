const { Router } = require("express");
const { requireAuth } = require("../middleware/auth");
const redis = require("../config/redis");

const router = Router();

const YT_API = "https://www.googleapis.com/youtube/v3/search";
const CACHE_TTL = 86400; // 24 hours

// Fallback: youtubei.js (InnerTube) — no API key, no quota
let ytClient = null;
async function fallbackSearch(query) {
  const { Innertube } = require("youtubei.js");
  if (!ytClient) ytClient = await Innertube.create({ lang: "en", location: "US" });
  const search = await ytClient.search(query, { type: "video" });
  return (search.results || [])
    .filter((v) => v.type === "Video")
    .slice(0, 10)
    .map((v) => ({
      videoId: v.id,
      title: v.title?.text || v.title || "",
      thumbnail: v.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`,
      channelTitle: v.author?.name || "",
    }));
}

// Primary: YouTube Data API v3 — fast and accurate
async function primarySearch(query) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("No API key");

  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: "10",
    key,
  });

  const response = await fetch(`${YT_API}?${params}`);
  if (!response.ok) throw new Error(`API ${response.status}`);

  const data = await response.json();
  return (data.items || []).map((item) => ({
    videoId: item.id.videoId,
    title: (item.snippet.title || "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"),
    thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || null,
    channelTitle: item.snippet.channelTitle || "",
  }));
}

// Search with Redis caching + automatic fallback
router.get("/search", requireAuth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: "Search query is required" });
    }

    const query = q.trim();
    const cacheKey = `yt:search:${query.toLowerCase()}`;

    // Check Redis cache first
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          console.log(`[YouTube] CACHE HIT for "${query}"`);
          return res.json(JSON.parse(cached));
        }
      } catch { /* cache miss */ }
    }

    let results;
    let source;
    try {
      // Try YouTube Data API v3 first (fast)
      results = await primarySearch(query);
      source = "API v3";
    } catch (err) {
      console.warn(`[YouTube] API v3 failed for "${query}":`, err.message);
      try {
        // Fallback to youtubei.js (slower but no quota)
        results = await fallbackSearch(query);
        source = "InnerTube (fallback)";
      } catch (err2) {
        console.error(`[YouTube] Fallback also failed for "${query}":`, err2.message);
        ytClient = null; // reset for next attempt
        return res.status(500).json({ error: "YouTube search failed" });
      }
    }

    console.log(`[YouTube] ${source} — "${query}" → ${results.length} results`);

    // Cache results in Redis
    if (redis && results.length > 0) {
      try {
        await redis.set(cacheKey, JSON.stringify(results), "EX", CACHE_TTL);
      } catch { /* non-critical */ }
    }

    res.json(results);
  } catch (err) {
    console.error("[YouTube] Search error:", err);
    res.status(500).json({ error: "Failed to search YouTube" });
  }
});

module.exports = router;
