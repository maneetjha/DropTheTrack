require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const prisma = require("./config/db");
const { initSockets } = require("./sockets");
const healthRouter = require("./routes/health");
const authRouter = require("./routes/auth");
const roomsRouter = require("./routes/rooms");
const songsRouter = require("./routes/songs");
const youtubeRouter = require("./routes/youtube");

const app = express();
const server = http.createServer(app);

// ---------- Middleware ----------
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

// ---------- Routes ----------
app.use("/api", healthRouter);          // GET /api/ping
app.use("/api/auth", authRouter);       // POST /api/auth/register, /login, GET /me
app.use("/api/rooms", roomsRouter);     // POST / GET /api/rooms
app.use("/api/rooms", songsRouter);     // POST / GET /api/rooms/:roomId/songs
app.use("/api", songsRouter);           // POST /api/songs/:songId/upvote
app.use("/api/youtube", youtubeRouter); // GET /api/youtube/search?q=...

// ---------- Socket.io ----------
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
  },
});
initSockets(io);

// ---------- Start ----------
const PORT = process.env.PORT || 4000;

async function start() {
  try {
    // Verify DB connection
    await prisma.$connect();
    console.log("[DB] Connected to PostgreSQL via Prisma");

    server.listen(PORT, () => {
      console.log(`\n🎵 DropTheTrack backend running on http://localhost:${PORT}`);
      console.log(`   Health check: http://localhost:${PORT}/api/ping`);
      console.log(`   Prisma Studio: npx prisma studio\n`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

start();
