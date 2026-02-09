const redis = require("../config/redis");

/**
 * Socket.io setup — handles real-time room events + user tracking.
 */
function initSockets(io) {
  io.on("connection", (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Join a room
    socket.on("join-room", async ({ roomId, userName }) => {
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.userName = userName || "Anonymous";
      console.log(`[Socket] ${socket.data.userName} (${socket.id}) joined room ${roomId}`);

      // Track in Redis
      if (redis) {
        await redis.hset(`room:${roomId}:users`, socket.id, socket.data.userName);
      }

      // Broadcast updated user list
      const users = await getRoomUsers(roomId);
      io.to(roomId).emit("users-updated", users);
    });

    // Leave a room
    socket.on("leave-room", async (roomId) => {
      socket.leave(roomId);
      console.log(`[Socket] ${socket.id} left room ${roomId}`);

      if (redis) {
        await redis.hdel(`room:${roomId}:users`, socket.id);
      }

      const users = await getRoomUsers(roomId);
      io.to(roomId).emit("users-updated", users);
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
      const roomId = socket.data.roomId;
      console.log(`[Socket] Client disconnected: ${socket.id}`);

      if (roomId && redis) {
        await redis.hdel(`room:${roomId}:users`, socket.id);
        const users = await getRoomUsers(roomId);
        io.to(roomId).emit("users-updated", users);
      }
    });
  });
}

/** Get list of users in a room from Redis */
async function getRoomUsers(roomId) {
  if (!redis) return [];
  const hash = await redis.hgetall(`room:${roomId}:users`);
  // hash = { socketId: userName, ... }
  return Object.entries(hash).map(([socketId, name]) => ({ socketId, name }));
}

module.exports = { initSockets };
