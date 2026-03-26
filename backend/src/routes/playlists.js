const { Router } = require("express");
const prisma = require("../config/db");
const { requireAuth } = require("../middleware/auth");

const router = Router();

function extractPlaylistId(input) {
  const s = String(input || "").trim();
  if (!s) return null;
  // Accept raw list id
  if (/^[a-zA-Z0-9_-]{10,}$/.test(s) && !s.includes("http")) return s;
  try {
    const u = new URL(s);
    const list = u.searchParams.get("list");
    if (list) return list;
  } catch {
    // ignore
  }
  const m = s.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

async function fetchPublicPlaylist(listId) {
  const { Innertube } = require("youtubei.js");
  const yt = await Innertube.create({ lang: "en", location: "US" });
  const pl = await yt.getPlaylist(listId);
  // Best-effort extraction (youtubei.js shapes vary by version)
  const title =
    pl?.info?.title ||
    pl?.title ||
    pl?.header?.title?.text ||
    "Imported playlist";

  const rawItems =
    pl?.videos ||
    pl?.items ||
    pl?.contents ||
    [];

  const items = (rawItems || [])
    .map((v) => {
      const videoId = v?.id || v?.video_id || v?.videoId;
      const url = videoId ? `https://www.youtube.com/watch?v=${videoId}` : v?.url;
      const t = v?.title?.text || v?.title || v?.name;
      const thumb =
        v?.thumbnails?.[0]?.url ||
        v?.thumbnail?.[0]?.url ||
        (videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : null);
      if (!t || !url) return null;
      return { title: String(t), url: String(url), thumbnail: thumb || null };
    })
    .filter(Boolean);

  return { title: String(title), items };
}

// GET /api/playlists — list user playlists
router.get("/", requireAuth, async (req, res) => {
  try {
    const playlists = await prisma.playlist.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { items: true } },
        items: {
          take: 4,
          orderBy: { createdAt: "asc" },
          select: { thumbnail: true, url: true },
        },
      },
    });
    res.json(
      playlists.map((p) => {
        const coverThumbnails = p.items.map((it) => {
          if (it.thumbnail) return it.thumbnail;
          const u = String(it.url || "");
          const fromV = u.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
          const fromBe = u.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
          const id = (fromV && fromV[1]) || (fromBe && fromBe[1]) || null;
          return id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : null;
        });
        return {
          id: p.id,
          name: p.name,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          itemCount: p._count.items,
          coverThumbnails,
        };
      })
    );
  } catch (err) {
    console.error("[Playlists] List error:", err);
    res.status(500).json({ error: "Failed to fetch playlists" });
  }
});

// POST /api/playlists — create
router.post("/", requireAuth, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "name is required" });
    const p = await prisma.playlist.create({
      data: { userId: req.user.id, name: name.slice(0, 120) },
    });
    res.status(201).json(p);
  } catch (err) {
    console.error("[Playlists] Create error:", err);
    res.status(500).json({ error: "Failed to create playlist" });
  }
});

// PATCH /api/playlists/:id — rename
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ error: "name is required" });

    const p = await prisma.playlist.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!p) return res.status(404).json({ error: "Not found" });
    if (p.userId !== req.user.id) return res.status(403).json({ error: "Forbidden" });

    const updated = await prisma.playlist.update({
      where: { id },
      data: { name: name.slice(0, 120) },
    });
    res.json(updated);
  } catch (err) {
    console.error("[Playlists] Rename error:", err);
    res.status(500).json({ error: "Failed to rename playlist" });
  }
});

// DELETE /api/playlists/:id — delete
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const p = await prisma.playlist.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!p) return res.status(404).json({ error: "Not found" });
    if (p.userId !== req.user.id) return res.status(403).json({ error: "Forbidden" });

    await prisma.playlist.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error("[Playlists] Delete error:", err);
    res.status(500).json({ error: "Failed to delete playlist" });
  }
});

// GET /api/playlists/:id/items — list items
router.get("/:id/items", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const p = await prisma.playlist.findUnique({ where: { id }, select: { id: true, userId: true, name: true } });
    if (!p) return res.status(404).json({ error: "Not found" });
    if (p.userId !== req.user.id) return res.status(403).json({ error: "Forbidden" });

    const items = await prisma.playlistItem.findMany({
      where: { playlistId: id },
      orderBy: { createdAt: "desc" },
    });
    res.json({ playlist: { id: p.id, name: p.name }, items });
  } catch (err) {
    console.error("[Playlists] Items error:", err);
    res.status(500).json({ error: "Failed to fetch playlist items" });
  }
});

// POST /api/playlists/:id/items — add a track to playlist
router.post("/:id/items", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, url, thumbnail } = req.body || {};
    if (!title || !url) return res.status(400).json({ error: "title and url are required" });

    const p = await prisma.playlist.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!p) return res.status(404).json({ error: "Not found" });
    if (p.userId !== req.user.id) return res.status(403).json({ error: "Forbidden" });

    const item = await prisma.playlistItem.upsert({
      where: { playlistId_url: { playlistId: id, url } },
      update: { title, thumbnail: thumbnail || null },
      create: {
        playlistId: id,
        title,
        url,
        thumbnail: thumbnail || null,
      },
    });

    await prisma.playlist.update({ where: { id }, data: {} }); // touch updatedAt
    res.status(201).json(item);
  } catch (err) {
    console.error("[Playlists] Add item error:", err);
    res.status(500).json({ error: "Failed to add item" });
  }
});

// DELETE /api/playlists/:id/items/:itemId — remove item
router.delete("/:id/items/:itemId", requireAuth, async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const p = await prisma.playlist.findUnique({ where: { id }, select: { id: true, userId: true } });
    if (!p) return res.status(404).json({ error: "Not found" });
    if (p.userId !== req.user.id) return res.status(403).json({ error: "Forbidden" });

    const it = await prisma.playlistItem.findUnique({ where: { id: itemId }, select: { id: true, playlistId: true } });
    if (!it || it.playlistId !== id) return res.status(404).json({ error: "Not found" });

    await prisma.playlistItem.delete({ where: { id: itemId } });
    await prisma.playlist.update({ where: { id }, data: {} }); // touch updatedAt
    res.json({ success: true });
  } catch (err) {
    console.error("[Playlists] Remove item error:", err);
    res.status(500).json({ error: "Failed to remove item" });
  }
});

// POST /api/playlists/import — import by public playlist link (creates new playlist)
router.post("/import", requireAuth, async (req, res) => {
  try {
    const url = String(req.body?.url || "").trim();
    const listId = extractPlaylistId(url);
    if (!listId) return res.status(400).json({ error: "Invalid playlist link" });

    const { title, items } = await fetchPublicPlaylist(listId);
    if (!items.length) return res.status(400).json({ error: "Playlist has no importable tracks" });

    const playlist = await prisma.playlist.create({
      data: {
        userId: req.user.id,
        name: String(title).slice(0, 120),
        items: {
          create: items.slice(0, 200).map((it) => ({
            title: String(it.title).slice(0, 300),
            url: it.url,
            thumbnail: it.thumbnail || null,
          })),
        },
      },
      include: { _count: { select: { items: true } } },
    });

    res.status(201).json({
      id: playlist.id,
      name: playlist.name,
      createdAt: playlist.createdAt,
      updatedAt: playlist.updatedAt,
      itemCount: playlist._count.items,
    });
  } catch (err) {
    console.error("[Playlists] Import error:", err);
    res.status(500).json({ error: "Failed to import playlist" });
  }
});

module.exports = router;

