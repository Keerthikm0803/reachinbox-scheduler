import IORedis from "ioredis";

export const redisConnection = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
  }
);

redisConnection.on("connect", () => {
  console.log("Redis connected");
});

redisConnection.on("error", (error) => {
  console.error("Redis connection error:", error);
});