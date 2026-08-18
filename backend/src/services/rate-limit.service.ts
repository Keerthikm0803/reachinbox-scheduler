import { redisConnection } from "../config/redis";

const MIN_EMAIL_DELAY_MS = Number(
  process.env.MIN_EMAIL_DELAY_MS || 2000
);

const MAX_EMAILS_PER_HOUR = Number(
  process.env.MAX_EMAILS_PER_HOUR || 200
);

export async function acquireEmailSlot(senderId: string) {
  const now = Date.now();

  const hourWindow = Math.floor(
    now / (60 * 60 * 1000)
  );

  const rateKey = `email-rate:${senderId}:${hourWindow}`;
  const delayKey = `email-delay:${senderId}`;

  const luaScript = `
    local rateKey = KEYS[1]
    local delayKey = KEYS[2]

    local now = tonumber(ARGV[1])
    local minDelay = tonumber(ARGV[2])
    local maxEmails = tonumber(ARGV[3])
    local hourWindow = tonumber(ARGV[4])

    local currentCount = tonumber(redis.call("GET", rateKey) or "0")

    -- Hourly limit
    if currentCount >= maxEmails then
      local nextHour = (hourWindow + 1) * 60 * 60 * 1000
      return {0, nextHour - now}
    end

    -- Minimum delay between individual emails
    local lastSent = tonumber(redis.call("GET", delayKey) or "0")
    local nextAllowed = lastSent + minDelay

    if now < nextAllowed then
      return {0, nextAllowed - now}
    end

    -- Reserve the slot atomically
    redis.call("INCR", rateKey)
    redis.call("EXPIRE", rateKey, 3600)

    redis.call(
      "SET",
      delayKey,
      tostring(now),
      "PX",
      minDelay
    )

    return {1, 0}
  `;

  const result = (await redisConnection.eval(
    luaScript,
    2,
    rateKey,
    delayKey,
    String(now),
    String(MIN_EMAIL_DELAY_MS),
    String(MAX_EMAILS_PER_HOUR),
    String(hourWindow)
  )) as [number, number];

  return {
    allowed: Number(result[0]) === 1,
    delay: Number(result[1]),
  };
}