const { Router } = require("express");
const { requireAuth } = require("../middleware/auth");
const redis = require("../config/redis");

const router = Router();

const YT_SEARCH = "https://www.googleapis.com/youtube/v3/search";
const YT_VIDEOS = "https://www.googleapis.com/youtube/v3/videos";
const CACHE_TTL = 86400; // 24 hours

/** YouTube category id for "Music" — keeps search/resolve focused on songs, not random videos */
const MUSIC_CATEGORY_ID = "10";

function musicOnlyEnabled() {
  return process.env.YOUTUBE_MUSIC_ONLY !== "false";
}

function decodeEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Parse ISO 8601 duration (PT1H2M3S) to M:SS or H:MM:SS */
function formatDuration(iso) {
  if (!iso || typeof iso !== "string" || !iso.startsWith("PT")) return null;
  const h = iso.match(/(\d+)H/);
  const m = iso.match(/(\d+)M/);
  const sec = iso.match(/(\d+)S/);
  const hours = h ? parseInt(h[1], 10) : 0;
  const minutes = m ? parseInt(m[1], 10) : 0;
  const seconds = sec ? parseInt(sec[1], 10) : 0;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function extractVideoId(input) {
  const s = String(input).trim();
  if (!s) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  const m =
    s.match(/(?:youtube\.com\/watch\?[^#]*[&?]v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/) ||
    s.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

// Fallback: youtubei.js (InnerTube) — no API key, no quota
let ytClient = null;
async function fallbackSearch(query) {
  const { Innertube } = require("youtubei.js");
  if (!ytClient) ytClient = await Innertube.create({ lang: "en", location: "US" });
  const q = musicOnlyEnabled() ? `${query.trim()} music` : query.trim();
  const search = await ytClient.search(q, { type: "video" });
  return (search.results || [])
    .filter((v) => v.type === "Video")
    .slice(0, 15)
    .map((v) => {
      const id = v.id;
      let duration = null;
      try {
        const d = v.duration?.text || v.duration?.seconds;
        if (typeof d === "number" && d > 0) {
          const mm = Math.floor(d / 60);
          const ss = d % 60;
          duration = `${mm}:${String(ss).padStart(2, "0")}`;
        } else if (typeof d === "string") duration = d;
      } catch {
        /* noop */
      }
      return {
        videoId: id,
        title: decodeEntities(v.title?.text || v.title || ""),
        thumbnail: v.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
        channelTitle: v.author?.name || "",
        duration,
      };
    });
}

async function primarySearch(query) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("No API key");

  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    maxResults: "15",
    videoEmbeddable: "true",
    videoSyndicated: "true",
    key,
  });

  const response = await fetch(`${YT_SEARCH}?${params}`);
  if (!response.ok) throw new Error(`API ${response.status}`);

  const data = await response.json();
  const base = (data.items || []).map((item) => ({
    videoId: item.id.videoId,
    title: decodeEntities(item.snippet.title || ""),
    thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || null,
    channelTitle: item.snippet.channelTitle || "",
    duration: null,
  }));

  return enrichAndFilterMusic(base, key);
}

/**
 * Merge duration + category from videos.list; keep only Music category when musicOnlyEnabled().
 */
async function enrichAndFilterMusic(results, key) {
  if (!results.length || !key) return results;
  const ids = results.map((r) => r.videoId).filter(Boolean);
  if (!ids.length) return results;
  try {
    const params = new URLSearchParams({
      part: "snippet,contentDetails",
      id: ids.slice(0, 50).join(","),
      key,
    });
    const res = await fetch(`${YT_VIDEOS}?${params}`);
    if (!res.ok) return results;
    const data = await res.json();
    const metaMap = new Map();
    for (const item of data.items || []) {
      metaMap.set(item.id, {
        duration: formatDuration(item.contentDetails?.duration),
        categoryId: item.snippet?.categoryId,
      });
    }
    const merged = results.map((r) => {
      const meta = metaMap.get(r.videoId);
      return {
        ...r,
        duration: meta?.duration ?? r.duration,
      };
    });
    if (!musicOnlyEnabled()) return merged;
    return merged.filter((r) => metaMap.get(r.videoId)?.categoryId === MUSIC_CATEGORY_ID);
  } catch {
    return results;
  }
}

/** When InnerTube returned hits but we have an API key, drop non-music using one videos.list */
async function filterResultsByMusicCategory(results, key) {
  if (!musicOnlyEnabled() || !key || !results.length) return results;
  return enrichAndFilterMusic(results, key);
}

async function resolveViaApi(videoId) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("No API key");
  const params = new URLSearchParams({
    part: "snippet,contentDetails,status",
    id: videoId,
    key,
  });
  const res = await fetch(`${YT_VIDEOS}?${params}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  const item = (data.items || [])[0];
  if (!item) return null;
  if (item.status?.embeddable === false) {
    return { error: "This video cannot be embedded in apps. Try another link." };
  }
  if (musicOnlyEnabled() && item.snippet?.categoryId && item.snippet.categoryId !== MUSIC_CATEGORY_ID) {
    return {
      error:
        "DropTheTrack only adds music. This video isn’t in YouTube’s Music category — try a song, official audio, or music video link.",
    };
  }
  return {
    videoId: item.id,
    title: decodeEntities(item.snippet?.title || "Unknown"),
    thumbnail:
      item.snippet?.thumbnails?.high?.url ||
      item.snippet?.thumbnails?.medium?.url ||
      item.snippet?.thumbnails?.default?.url ||
      `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    channelTitle: item.snippet?.channelTitle || "",
    duration: formatDuration(item.contentDetails?.duration),
  };
}

async function resolveViaInnerTube(videoId) {
  const { Innertube } = require("youtubei.js");
  if (!ytClient) ytClient = await Innertube.create({ lang: "en", location: "US" });
  const info = await ytClient.getInfo(videoId);
  const basic = info.basic_info;
  if (!basic?.id) return null;
  if (musicOnlyEnabled() && basic.category && String(basic.category).toLowerCase() !== "music") {
    return {
      error:
        "DropTheTrack only adds music. This video isn’t categorized as music on YouTube — try a different link.",
    };
  }
  return {
    videoId: basic.id,
    title: decodeEntities(basic.title || "Unknown"),
    thumbnail: basic.thumbnail?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    channelTitle: basic.author || "",
    duration: basic.duration?.text || null,
  };
}

/** Public oEmbed — no API key; title + thumb only */
async function resolveViaOEmbed(videoId) {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const res = await fetch(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`,
  );
  if (!res.ok) return null;
  const j = await res.json();
  const base = {
    videoId,
    title: decodeEntities(j.title || "Unknown"),
    thumbnail: j.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    channelTitle: j.author_name || "",
    duration: null,
  };
  const key = process.env.YOUTUBE_API_KEY;
  if (musicOnlyEnabled() && key) {
    try {
      const vres = await fetch(
        `${YT_VIDEOS}?${new URLSearchParams({ part: "snippet", id: videoId, key })}`,
      );
      if (vres.ok) {
        const vd = await vres.json();
        const item = (vd.items || [])[0];
        if (item?.snippet?.categoryId && item.snippet.categoryId !== MUSIC_CATEGORY_ID) {
          return {
            error:
              "DropTheTrack only adds music. This link isn’t a music video on YouTube — try a song or official audio.",
          };
        }
      }
    } catch {
      /* allow oEmbed if check fails */
    }
  }
  return base;
}

// Search with Redis caching + automatic fallback
router.get("/search", requireAuth, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: "Search query is required" });
    }

    const query = q.trim();
    const cacheKey = `yt:search:music:${query.toLowerCase()}`;

    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          console.log(`[YouTube] CACHE HIT for "${query}"`);
          return res.json(JSON.parse(cached));
        }
      } catch {
        /* cache miss */
      }
    }

    let results;
    let source;
    try {
      results = await primarySearch(query);
      source = "API v3";
    } catch (err) {
      console.warn(`[YouTube] API v3 failed for "${query}":`, err.message);
      try {
        results = await fallbackSearch(query);
        results = await filterResultsByMusicCategory(results, process.env.YOUTUBE_API_KEY);
        source = "InnerTube (fallback)";
      } catch (err2) {
        console.error(`[YouTube] Fallback also failed for "${query}":`, err2.message);
        ytClient = null;
        return res.status(500).json({ error: "YouTube search failed" });
      }
    }

    console.log(`[YouTube] ${source} — "${query}" → ${results.length} results`);

    if (redis && results.length > 0) {
      try {
        await redis.set(cacheKey, JSON.stringify(results), "EX", CACHE_TTL);
      } catch {
        /* non-critical */
      }
    }

    res.json(results);
  } catch (err) {
    console.error("[YouTube] Search error:", err);
    res.status(500).json({ error: "Failed to search YouTube" });
  }
});

/** Resolve a pasted YouTube URL or 11-char video ID to metadata */
router.get("/resolve", requireAuth, async (req, res) => {
  try {
    const raw = String(req.query.q || req.query.url || "").trim();
    const videoId = extractVideoId(raw);
    if (!videoId) {
      return res.status(400).json({ error: "Paste a valid YouTube link or video ID" });
    }

    let payload = null;
    if (process.env.YOUTUBE_API_KEY) {
      try {
        payload = await resolveViaApi(videoId);
      } catch (e) {
        console.warn("[YouTube] resolve API failed:", e.message);
      }
    }
    if (payload?.error) {
      return res.status(400).json({ error: payload.error });
    }
    if (!payload) {
      try {
        payload = await resolveViaInnerTube(videoId);
      } catch (e) {
        console.warn("[YouTube] resolve InnerTube failed:", e.message);
        ytClient = null;
      }
    }
    if (payload?.error) {
      return res.status(400).json({ error: payload.error });
    }
    if (!payload) {
      try {
        payload = await resolveViaOEmbed(videoId);
      } catch (e) {
        console.warn("[YouTube] resolve oEmbed failed:", e.message);
      }
    }
    if (payload?.error) {
      return res.status(400).json({ error: payload.error });
    }
    if (!payload) {
      return res.status(404).json({ error: "Could not load this video. Check the link." });
    }

    res.json(payload);
  } catch (err) {
    console.error("[YouTube] Resolve error:", err);
    res.status(500).json({ error: "Failed to resolve video" });
  }
});

module.exports = router;
