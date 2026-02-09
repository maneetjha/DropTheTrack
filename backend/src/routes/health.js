const { Router } = require("express");
const prisma = require("../config/db");
const redis = require("../config/redis");

const router = Router();

router.get("/ping", async (_req, res) => {
  const status = { server: "ok", db: "ok", redis: "ok" };

  // Check Postgres via Prisma
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    status.db = "down";
  }

  // Check Redis
  try {
    await redis.ping();
  } catch {
    status.redis = "down";
  }

  const allOk = Object.values(status).every((v) => v === "ok");
  res.status(allOk ? 200 : 503).json(status);
});

module.exports = router;
