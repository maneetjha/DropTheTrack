require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const prisma = require("./config/db");
const { initSockets } = require("./sockets");
const { startCleanupCron } = require("./cron/cleanup");
const healthRouter = require("./routes/health");
const authRouter = require("./routes/auth");
const roomsRouter = require("./routes/rooms");
const songsRouter = require("./routes/songs");
const youtubeRouter = require("./routes/youtube");
const messagesRouter = require("./routes/messages");
const libraryRouter = require("./routes/library");
const playlistsRouter = require("./routes/playlists");
const usersRouter = require("./routes/users");
const path = require("path");

const rateLimit = require("express-rate-limit");

const app = express();
const server = http.createServer(app);

// ---------- Middleware ----------
// Support comma-separated CORS origins (e.g. "https://a.vercel.app,https://b.vercel.app")
const corsOrigin = process.env.CORS_ORIGIN || "*";
const allowedOrigins = corsOrigin === "*" ? "*" : corsOrigin.split(",").map((o) => o.trim());
app.use(
  cors({
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
  })
);
app.use(express.json());

// --- Global rate limit: 500 requests per 15 min per IP ---
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
  })
);

// --- Auth routes limit (100 per 15 min) ---
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later." },
});

// --- YouTube search limit (30 per min) ---
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many search requests, slow down." },
});

// ---------- Routes ----------
app.use("/api", healthRouter);          // GET /api/ping
app.use("/api/auth", authLimiter, authRouter);       // POST /api/auth/register, /login, GET /me
app.use("/api/rooms", roomsRouter);     // POST / GET /api/rooms
app.use("/api/rooms", songsRouter);     // POST / GET /api/rooms/:roomId/songs
app.use("/api", songsRouter);           // POST /api/songs/:songId/upvote
app.use("/api/youtube", searchLimiter, youtubeRouter); // GET /api/youtube/search | /resolve
app.use("/api/rooms", messagesRouter);  // GET /api/rooms/:roomId/messages
app.use("/api/library", libraryRouter); // GET/POST/DELETE /api/library
app.use("/api/playlists", playlistsRouter); // Playlists-only library
app.use("/api/users", usersRouter); // Profile updates + avatar upload

// Serve uploaded assets
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// ---------- Socket.io ----------
const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    methods: ["GET", "POST"],
  },
});
initSockets(io);

// Make io accessible from routes via req.app.get("io")
app.set("io", io);

// ---------- 404 catch-all ----------
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ---------- Global error handler ----------
app.use((err, _req, res, _next) => {
  console.error("[Error]", err.stack || err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || "Internal server error",
  });
});

// ---------- Start ----------
const PORT = process.env.PORT || 4000;

async function start() {
  try {
    // Verify DB connection
    await prisma.$connect();
    console.log("[DB] Connected to PostgreSQL via Prisma");

    // Start scheduled jobs
    startCleanupCron();

    // listen() reports failures via 'error' event, not thrown — wrap so try/catch covers it
    await new Promise((resolve, reject) => {
      const onError = (err) => {
        server.off("listening", onListening);
        reject(err);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve();
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(PORT);
    });

    console.log(`\n🎵 DropTheTrack backend running on http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/api/ping`);
    console.log(`   Prisma Studio: npx prisma studio\n`);
  } catch (err) {
    const code = err && err.code;
    if (code === "EADDRINUSE") {
      console.error(
        `[Server] Port ${PORT} is already in use. Stop the other backend (e.g. kill the process using that port) or set PORT in .env.`
      );
    } else {
      console.error("[Server] Failed to start:", err.message || err);
    }
    try {
      await prisma.$disconnect();
    } catch {
      /* ignore */
    }
    process.exit(1);
  }
}

// ---------- Graceful shutdown & crash handlers ----------
process.on("SIGINT", async () => {
  console.log("\n[Shutdown] SIGINT received, cleaning up...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n[Shutdown] SIGTERM received, cleaning up...");
  await prisma.$disconnect();
  process.exit(0);
});

process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  console.error("[Fatal] Unhandled Promise Rejection:", msg);
  if (reason instanceof Error && reason.stack) console.error(reason.stack);
});

process.on("uncaughtException", (err) => {
  console.error("[Fatal] Uncaught Exception:", err.message || String(err));
  if (err.stack) console.error(err.stack);
  process.exit(1);
});

start();
