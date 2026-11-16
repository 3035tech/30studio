import "server-only";
import Redis from "ioredis";
import { AUTH_STORAGE } from "@/lib/constants";

function createRedisClient() {
  const redisUrl = process.env[AUTH_STORAGE.redisUrlEnvironmentName]?.trim();
  if (!redisUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Redis is required for production authentication storage.");
    }
    return undefined;
  }

  const client = new Redis(redisUrl, {
    connectTimeout: AUTH_STORAGE.redisConnectTimeoutMilliseconds,
    maxRetriesPerRequest: AUTH_STORAGE.redisMaxRetriesPerRequest,
  });
  client.on("ready", () => console.info("Connected to Redis for authentication storage."));
  client.on("error", (error: Error) => {
    console.error("Redis authentication storage connection error.", { errorName: error.name });
  });
  return client;
}

type RedisClient = ReturnType<typeof createRedisClient>;
const globalRedis = globalThis as typeof globalThis & { studioRedis?: RedisClient };

export function getRedisClient() {
  globalRedis.studioRedis ??= createRedisClient();
  return globalRedis.studioRedis;
}
