const prisma = require("../config/db");
const redis = require("../config/redis");

/** In-process playback mirror + fallback when Redis is not configured */
const memoryPlaybackByRoom = new Map();
/** roomId -> whether host has unlocked continuous autoplay */
const memoryAutoplayUnlockedByRoom = new Map();
/** roomId -> epoch ms when skip lock expires (dedupe song-ended without Redis) */
const memorySkipLockUntil = new Map();

/** Set in initSockets — used to broadcast queue updates from HTTP routes */
let ioRef = null;

/** True if this socket belongs to the room creator (not anonymous). */
async function assertRoomHost(socket, roomId) {
  const uid = socket.data?.userId;
  if (!uid || String(uid).startsWith("anon-")) return false;
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { createdBy: true },
    });
    return room?.createdBy === uid;
  } catch {
    return false;
  }
}

/**
 * Socket.io setup — handles real-time room events + user tracking.
 *
 * User presence is determined by Socket.io's own room membership
 * (io.in(roomId).fetchSockets()) — this is always accurate and
 * self-healing. No more Redis connection counts that drift.
 *
 * Playback state (play/pause + position) is stored in Redis when available,
 * always mirrored in memory for resilience and for dev without Redis.
 * Only the host can control playback.
 */
function initSockets(io) {
  ioRef = io;
  io.on("connection", (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Join a room
    socket.on("join-room", async ({ roomId, userId, userName }) => {
      const newUserId = userId || socket.id;
      const newUserName = userName || "Anonymous";

      // If previously in a different room, leave it first
      if (socket.data.roomId && socket.data.roomId !== roomId) {
        socket.leave(socket.data.roomId);
        await broadcastRoomUsers(io, socket.data.roomId);
      }

      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.userId = newUserId;
      socket.data.userName = newUserName;

      console.log(`[Socket] ${newUserName} (${newUserId}) joined room ${roomId}`);

      await broadcastRoomUsers(io, roomId);

      // Send current playback state to the new joiner so they sync up
      let pbState = await getPlaybackState(roomId);
      if (!pbState) {
        try {
          const playing = await prisma.song.findFirst({
            where: { roomId, isPlaying: true },
            select: { id: true },
          });
          if (playing) {
            pbState = {
              isPaused: false,
              currentTime: 0,
              updatedAt: Date.now(),
            };
            await setPlaybackState(roomId, pbState);
          }
        } catch {
          /* non-critical */
        }
      }
      if (pbState) {
        socket.emit("playback-sync", pbState);
      }
    });

    // Leave a room
    socket.on("leave-room", async (roomId) => {
      socket.leave(roomId);
      socket.data.roomId = null;
      socket.data.userId = null;
      socket.data.userName = null;

      await broadcastRoomUsers(io, roomId);
    });

    // Room settings updated by host — broadcast to everyone in the room
    socket.on("room-updated", (data) => {
      const { roomId } = data;
      if (roomId) {
        io.to(roomId).emit("room-updated", data);
      }
    });

    // Song add + idle auto-start runs in POST /rooms/:roomId/songs (avoids race with "Start playing")

    // Upvote — broadcast to room
    socket.on("song-upvoted", ({ roomId, songId, upvotes }) => {
      socket.to(roomId).emit("queue-updated", {
        songId,
        upvotes,
        action: "upvoted",
      });
    });

    // Song removed — broadcast to room
    socket.on("song-removed", ({ roomId, songId }) => {
      socket.to(roomId).emit("queue-updated", { songId, action: "removed" });
    });

    // Playback changed (play a song / skip) — broadcast to room + reset playback state
    socket.on("playback-changed", async ({ roomId }) => {
      if (!roomId) return;
      const hostOk = await assertRoomHost(socket, roomId);
      if (!hostOk) {
        console.warn(`[Socket] playback-changed ignored: not host (room ${roomId})`);
        return;
      }
      // Once host starts playback, keep queue auto-playing until explicitly paused
      await setAutoplayUnlocked(roomId, true);
      // When a new song starts or is skipped, reset playback state to playing
      await setPlaybackState(roomId, {
        isPaused: false,
        currentTime: 0,
        updatedAt: Date.now(),
      });
      io.to(roomId).emit("queue-updated", { action: "playback" });
      io.to(roomId).emit("playback-sync", {
        isPaused: false,
        currentTime: 0,
        updatedAt: Date.now(),
      });

      // Notify dashboard watchers with updated song info
      try {
        const playing = await prisma.song.findFirst({
          where: { roomId, isPlaying: true },
          select: { title: true, thumbnail: true },
        });
        io.to(`dash:${roomId}`).emit("room-song-updated", {
          roomId,
          currentSong: playing || null,
        });
      } catch { /* non-critical */ }
    });

    // Song ended — any client can emit this to auto-advance the queue
    // Uses a Redis lock to prevent duplicate skips from multiple clients
    socket.on("song-ended", async ({ roomId }) => {
      if (!roomId) return;
      const lockKey = `room:${roomId}:skip-lock`;
      try {
        let acquired;
        if (redis) {
          acquired = await redis.set(lockKey, "1", "EX", 2, "NX");
        } else {
          const now = Date.now();
          const until = memorySkipLockUntil.get(roomId) || 0;
          if (until > now) {
            acquired = null;
          } else {
            memorySkipLockUntil.set(roomId, now + 2000);
            acquired = "OK";
          }
        }
        if (!acquired) return; // Another client already triggered the skip

        // Mark current playing song as played
        await prisma.song.updateMany({
          where: { roomId, isPlaying: true },
          data: { isPlaying: false, played: true },
        });

        // Find next unplayed song (highest upvotes first, then oldest)
        const next = await prisma.song.findFirst({
          where: { roomId, played: false },
          orderBy: [{ upvotes: "desc" }, { createdAt: "asc" }],
        });

        if (next) {
          await prisma.song.update({
            where: { id: next.id },
            data: { isPlaying: true },
          });
        }

        // Reset playback state
        await setPlaybackState(roomId, {
          isPaused: false,
          currentTime: 0,
          updatedAt: Date.now(),
        });

        // Broadcast to all clients in the room
        io.to(roomId).emit("queue-updated", { action: "playback" });
        io.to(roomId).emit("playback-sync", {
          isPaused: false,
          currentTime: 0,
          updatedAt: Date.now(),
        });

        // Notify dashboard watchers
        try {
          const playing = await prisma.song.findFirst({
            where: { roomId, isPlaying: true },
            select: { title: true, thumbnail: true },
          });
          io.to(`dash:${roomId}`).emit("room-song-updated", {
            roomId,
            currentSong: playing || null,
          });
        } catch { /* non-critical */ }
      } catch (err) {
        console.error("[Socket] song-ended auto-advance error:", err);
      }
    });

    // Host play/pause — syncs playback state across all clients
    socket.on("host-playback", async ({ roomId, isPaused, currentTime }) => {
      if (!roomId) return;
      const hostOk = await assertRoomHost(socket, roomId);
      if (!hostOk) {
        console.warn(`[Socket] host-playback ignored: not host (room ${roomId})`);
        return;
      }
      // Host "play/resume" unlocks continuous autoplay for this room session
      if (!isPaused) {
        await setAutoplayUnlocked(roomId, true);
      }
      const state = {
        isPaused: !!isPaused,
        currentTime: currentTime || 0,
        updatedAt: Date.now(),
      };
      await setPlaybackState(roomId, state);
      // Broadcast to ALL clients in the room (including the sender, for consistency)
      io.to(roomId).emit("playback-sync", state);
      console.log(`[Socket] Host ${isPaused ? "paused" : "resumed"} in room ${roomId} at ${currentTime.toFixed(1)}s`);
    });

    // Chat message — persist to DB and broadcast to room
    socket.on("chat-message", async ({ roomId, text, replyToId }) => {
      const userId = socket.data.userId;

      if (!roomId || !text || !text.trim() || !userId || userId.startsWith("anon-")) return;

      const trimmed = text.trim().slice(0, 500);

      try {
        const message = await prisma.message.create({
          data: {
            roomId,
            userId,
            text: trimmed,
            replyToId: replyToId || null,
          },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
            replyTo: { include: { user: { select: { id: true, name: true } } } },
          },
        });

        io.to(roomId).emit("new-message", {
          id: message.id,
          text: message.text,
          userId: message.user.id,
          userName: message.user.name || "Unknown",
          userAvatarUrl: message.user.avatarUrl,
          replyTo: message.replyTo
            ? {
                id: message.replyTo.id,
                userName: message.replyTo.user?.name || "Unknown",
                text: message.replyTo.text,
              }
            : null,
          createdAt: message.createdAt,
        });
      } catch (err) {
        console.error("[Socket] Chat message save failed:", err);
      }
    });

    // Dashboard: subscribe to live listener counts for multiple rooms
    // Joins `dash:<roomId>` rooms so the socket is NOT counted as a room participant.
    socket.on("subscribe-dashboard", ({ roomIds }) => {
      if (!Array.isArray(roomIds)) return;
      // Leave any previous dashboard subscriptions
      for (const room of socket.rooms) {
        if (typeof room === "string" && room.startsWith("dash:")) {
          socket.leave(room);
        }
      }
      // Join dashboard channels
      for (const id of roomIds) {
        socket.join(`dash:${id}`);
      }
    });

    // Disconnect — clean up
    socket.on("disconnect", async () => {
      const { roomId } = socket.data;
      console.log(`[Socket] Client disconnected: ${socket.id}`);

      if (roomId) {
        await broadcastRoomUsers(io, roomId);
      }
    });
  });
}

// ---- Playback state helpers (Redis + in-memory) ----

async function getPlaybackState(roomId) {
  if (redis) {
    try {
      const raw = await redis.get(`room:${roomId}:playback`);
      if (raw) return JSON.parse(raw);
    } catch {
      /* fall through to memory */
    }
  }
  return memoryPlaybackByRoom.get(roomId) || null;
}

async function setPlaybackState(roomId, state) {
  memoryPlaybackByRoom.set(roomId, state);
  if (!redis) return;
  try {
    await redis.set(`room:${roomId}:playback`, JSON.stringify(state), "EX", 86400);
  } catch {
    /* Redis write failure — memory still holds state */
  }
}

/**
 * Get the deduplicated list of users in a room by querying
 * Socket.io's actual room membership — always accurate.
 * Includes isHost flag and always keeps the host in the list (at the top).
 */
async function getRoomUsers(io, roomId) {
  const sockets = await io.in(roomId).fetchSockets();
  const userMap = new Map();

  for (const s of sockets) {
    const uid = s.data.userId;
    if (uid) {
      userMap.set(uid, s.data.userName || "Anonymous");
    }
  }

  // Look up the room creator
  let hostId = null;
  let hostName = null;
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { createdBy: true },
    });
    if (room && room.createdBy) {
      hostId = room.createdBy;
      if (userMap.has(hostId)) {
        hostName = userMap.get(hostId);
      } else {
        const hostUser = await prisma.user.findUnique({
          where: { id: hostId },
          select: { name: true },
        });
        hostName = hostUser?.name || "Host";
      }
    }
  } catch {
    // DB lookup failed — still return the connected users
  }

  const users = Array.from(userMap.entries()).map(([id, name]) => ({
    id,
    name,
    isHost: id === hostId,
  }));

  users.sort((a, b) => {
    if (a.isHost && !b.isHost) return -1;
    if (!a.isHost && b.isHost) return 1;
    return a.name.localeCompare(b.name);
  });

  if (hostId && !userMap.has(hostId)) {
    users.unshift({ id: hostId, name: hostName || "Host", isHost: true, isOffline: true });
  }

  return users;
}

/**
 * Broadcast the current user list to everyone in the room,
 * and notify dashboard watchers with just the count.
 * Auto-pauses playback when the room becomes empty.
 */
async function broadcastRoomUsers(io, roomId) {
  const users = await getRoomUsers(io, roomId);
  io.to(roomId).emit("users-updated", users);

  // Notify dashboard watchers (dash:<roomId>) with just the count
  const onlineCount = users.filter((u) => !u.isOffline).length;
  io.to(`dash:${roomId}`).emit("room-count-updated", {
    roomId,
    count: onlineCount,
  });

  // Auto-pause when room is empty (no online users)
  if (onlineCount === 0) {
    try {
      // When everyone leaves, require host to start again.
      await setAutoplayUnlocked(roomId, false);
      const pbState = await getPlaybackState(roomId);
      if (pbState && !pbState.isPaused) {
        await setPlaybackState(roomId, {
          isPaused: true,
          currentTime: pbState.currentTime,
          updatedAt: Date.now(),
        });
      }
    } catch { /* non-critical */ }
  }
}

async function getAutoplayUnlocked(roomId) {
  if (redis) {
    try {
      const raw = await redis.get(`room:${roomId}:autoplay-unlocked`);
      if (raw != null) return raw === "1";
    } catch {
      /* fall through to memory */
    }
  }
  return memoryAutoplayUnlockedByRoom.get(roomId) || false;
}

async function setAutoplayUnlocked(roomId, unlocked) {
  memoryAutoplayUnlockedByRoom.set(roomId, !!unlocked);
  if (!redis) return;
  try {
    await redis.set(`room:${roomId}:autoplay-unlocked`, unlocked ? "1" : "0", "EX", 86400);
  } catch {
    /* Redis write failure — memory still holds state */
  }
}

/**
 * If the room is idle and autoplay is unlocked, mark songId as now playing (same rules as former socket auto-start).
 * Does not emit — use finalizeSongAddBroadcast from the HTTP handler.
 */
async function tryAutostartAfterSongAdded(roomId, songId) {
  if (!roomId || !songId) return { started: false };
  try {
    const [pbState, autoplayUnlocked, currentlyPlaying] = await Promise.all([
      getPlaybackState(roomId),
      getAutoplayUnlocked(roomId),
      prisma.song.findFirst({
        where: { roomId, isPlaying: true },
        select: { id: true },
      }),
    ]);

    if (!autoplayUnlocked || pbState?.isPaused || currentlyPlaying) {
      return { started: false };
    }

    await prisma.$transaction([
      prisma.song.updateMany({
        where: { roomId, isPlaying: true },
        data: { isPlaying: false },
      }),
      prisma.song.update({
        where: { id: songId },
        data: { isPlaying: true },
      }),
    ]);

    const syncState = {
      isPaused: false,
      currentTime: 0,
      updatedAt: Date.now(),
    };
    await setPlaybackState(roomId, syncState);

    return { started: true, syncState };
  } catch (err) {
    console.error("[Playback] tryAutostartAfterSongAdded error:", err);
    return { started: false };
  }
}

/** After POST add-song: sync DB, then notify room (and dashboard if playback started). */
async function finalizeSongAddBroadcast(roomId, songId) {
  const result = await tryAutostartAfterSongAdded(roomId, songId);
  if (!ioRef) return result;

  // Persist + broadcast a chat system message for "song added"
  try {
    const s = await prisma.song.findUnique({
      where: { id: songId },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
    if (s) {
      const sysText = `${s.title} added to queue by ${s.user?.name || "someone"}`;
      const m = await prisma.message.create({
        data: {
          roomId,
          userId: s.userId,
          text: sysText.slice(0, 500),
          meta: {
            kind: "song_added",
            songId: s.id,
            title: s.title,
            thumbnail: s.thumbnail,
            addedBy: { id: s.user?.id, name: s.user?.name, avatarUrl: s.user?.avatarUrl },
          },
        },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      });
      ioRef.to(roomId).emit("new-message", {
        id: m.id,
        text: m.text,
        userId: m.user.id,
        userName: m.user.name || "Unknown",
        userAvatarUrl: m.user.avatarUrl,
        replyTo: null,
        meta: m.meta,
        createdAt: m.createdAt,
      });
    }
  } catch (e) {
    console.error("[Socket] system message (song_added) failed:", e);
  }

  if (result.started && result.syncState) {
    ioRef.to(roomId).emit("queue-updated", { action: "playback" });
    ioRef.to(roomId).emit("playback-sync", result.syncState);
    try {
      const playing = await prisma.song.findFirst({
        where: { roomId, isPlaying: true },
        select: { title: true, thumbnail: true },
      });
      ioRef.to(`dash:${roomId}`).emit("room-song-updated", {
        roomId,
        currentSong: playing || null,
      });
    } catch {
      /* non-critical */
    }
  } else {
    ioRef.to(roomId).emit("queue-updated", { action: "added" });
  }
  return result;
}

module.exports = { initSockets, finalizeSongAddBroadcast };
