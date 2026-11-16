import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { DATABASE_LIMITS } from "@/lib/constants";
import * as schema from "@/lib/db/schema";
import { ApiError } from "@/lib/server/api-error";
import { API_ERROR_CODES, HTTP_STATUS } from "@/lib/constants";

function createDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new ApiError(API_ERROR_CODES.serviceUnavailable, HTTP_STATUS.unavailable);
  }

  const pool = new Pool({
    connectionString,
    max: DATABASE_LIMITS.poolConnections,
    connectionTimeoutMillis: DATABASE_LIMITS.connectionTimeoutMilliseconds,
    idleTimeoutMillis: DATABASE_LIMITS.idleTimeoutMilliseconds,
  });
  pool.on("connect", () => console.info("Connected to PostgreSQL."));
  pool.on("error", (error: Error) => {
    console.error("PostgreSQL connection error.", { errorName: error.name });
  });

  return { pool, db: drizzle(pool, { schema }) };
}

type DatabaseState = ReturnType<typeof createDatabase>;
const globalDatabase = globalThis as typeof globalThis & { studioDatabase?: DatabaseState };

export function getDatabase() {
  globalDatabase.studioDatabase ??= createDatabase();
  return globalDatabase.studioDatabase.db;
}

export async function closeDatabase() {
  const databaseState = globalDatabase.studioDatabase;
  if (!databaseState) return;

  await databaseState.pool.end();
  delete globalDatabase.studioDatabase;
}
