let redis = null;

try {
  if (process.env.REDIS_URL) {
    const Redis = require("ioredis");

    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null; // Stop retrying after 3 attempts
        return Math.min(times * 200, 2000);
      },
    });

    redis.on("connect", () => {
      console.log("[Redis] Connected");
    });

    redis.on("error", (err) => {
      console.error("[Redis] Error:", err.message);
    });
  } else {
    console.log("[Redis] No REDIS_URL set — running without Redis");
  }
} catch {
  console.log("[Redis] Failed to connect — running without Redis");
  redis = null;
}

module.exports = redis;
