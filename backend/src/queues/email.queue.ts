import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

export const emailQueue = new Queue("email-queue", {
  connection: redisConnection,
});

emailQueue.on("error", (error) => {
  console.error("Email queue error:", error);
});