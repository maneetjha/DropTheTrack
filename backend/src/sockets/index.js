const redis = require("../config/redis");

/**
 * Socket.io setup — handles real-time room events + user tracking.
 *
 * Tracks users by userId (not socketId) so that the same user
 * on multiple tabs only counts once. We keep a connection count
 * per user so we only remove them when ALL tabs disconnect.
 *
 * Auto-cleanup: when a room hits 0 users, a Redis key is set
 * with a 5-minute TTL. While that key exists, the room is hidden
 * from the active rooms list. If someone joins before it expires,
 * the key is deleted and the room is visible again.
 */
function initSockets(io) {
  io.on("connection", (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Join a room
    socket.on("join-room", async ({ roomId, userId, userName }) => {
      const newUserId = userId || socket.id;
      const newUserName = userName || "Anonymous";
      const oldUserId = socket.data.userId;
      const oldRoomId = socket.data.roomId;

      // If this socket previously joined with a different identity, clean up the old one
      if (redis && oldUserId && oldUserId !== newUserId && oldRoomId) {
        await removeUserConnection(oldRoomId, oldUserId, io);
      }

      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.userId = newUserId;
      socket.data.userName = newUserName;

      console.log(`[Socket] ${newUserName} (${newUserId}) joined room ${roomId}`);

      if (redis) {
        // Room is active again — clear any empty-since marker
        await redis.del(`room:${roomId}:empty_since`);

        // Store user info: room:{roomId}:users hash — key=userId, value=userName
        await redis.hset(`room:${roomId}:users`, newUserId, newUserName);
        // Track connection count: room:{roomId}:conns:{userId}
        await redis.incr(`room:${roomId}:conns:${newUserId}`);
      }

      const users = await getRoomUsers(roomId);
      io.to(roomId).emit("users-updated", users);
    });

    // Leave a room
    socket.on("leave-room", async (roomId) => {
      socket.leave(roomId);
      await removeUserConnection(roomId, socket.data.userId, io);
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

    // Disconnect — clean up
    socket.on("disconnect", async () => {
      const { roomId, userId } = socket.data;
      console.log(`[Socket] Client disconnected: ${socket.id}`);

      if (roomId) {
        await removeUserConnection(roomId, userId, io);
      }
    });
  });
}

/**
 * Decrement connection count for a user. If it hits 0,
 * remove them from the room's user list entirely.
 * If the room becomes empty, set the empty_since marker with 5-min TTL.
 */
async function removeUserConnection(roomId, userId, io) {
  if (!redis || !userId) return;

  const key = `room:${roomId}:conns:${userId}`;
  const count = await redis.decr(key);

  if (count <= 0) {
    // Last tab closed — remove user from room
    await redis.del(key);
    await redis.hdel(`room:${roomId}:users`, userId);
  }

  const users = await getRoomUsers(roomId);
  io.to(roomId).emit("users-updated", users);

  // If room is now empty, mark it for auto-hide after 5 minutes
  if (users.length === 0) {
    await redis.set(`room:${roomId}:empty_since`, Date.now().toString(), "EX", 300);
    console.log(`[Socket] Room ${roomId} is empty — will hide from list in 5 minutes`);
  }
}

/** Get list of unique users in a room from Redis */
async function getRoomUsers(roomId) {
  if (!redis) return [];
  const hash = await redis.hgetall(`room:${roomId}:users`);
  // hash = { userId: userName, ... }
  return Object.entries(hash).map(([id, name]) => ({ id, name }));
}

module.exports = { initSockets };
