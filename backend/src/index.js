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
app.use("/api/youtube", searchLimiter, youtubeRouter); // GET /api/youtube/search?q=...
app.use("/api/rooms", messagesRouter);  // GET /api/rooms/:roomId/messages

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
  console.error("[Fatal] Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[Fatal] Uncaught Exception:", err);
  process.exit(1);
});

start();
