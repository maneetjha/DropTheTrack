const prisma = require("../config/db");
const redis = require("../config/redis");

/**
 * Socket.io setup — handles real-time room events + user tracking.
 *
 * User presence is determined by Socket.io's own room membership
 * (io.in(roomId).fetchSockets()) — this is always accurate and
 * self-healing. No more Redis connection counts that drift.
 *
 * Playback state (play/pause + position) is stored in Redis per room
 * and synced to all clients. Only the host can control playback.
 */
function initSockets(io) {
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
      const pbState = await getPlaybackState(roomId);
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

    // Song added — broadcast to room
    socket.on("song-added", ({ roomId, song }) => {
      socket.to(roomId).emit("queue-updated", { song, action: "added" });
    });

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
    });

    // Host play/pause — syncs playback state across all clients
    socket.on("host-playback", async ({ roomId, isPaused, currentTime }) => {
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

// ---- Playback state helpers (Redis) ----

async function getPlaybackState(roomId) {
  if (!redis) return null;
  try {
    const raw = await redis.get(`room:${roomId}:playback`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function setPlaybackState(roomId, state) {
  if (!redis) return;
  try {
    // TTL of 24 hours — auto-cleanup
    await redis.set(`room:${roomId}:playback`, JSON.stringify(state), "EX", 86400);
  } catch {
    // Redis write failure — non-critical
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
 * Broadcast the current user list to everyone in the room.
 */
async function broadcastRoomUsers(io, roomId) {
  const users = await getRoomUsers(io, roomId);
  io.to(roomId).emit("users-updated", users);
}

module.exports = { initSockets };
