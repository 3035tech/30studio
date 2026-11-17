import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { API_ERROR_CODES, DATABASE_CONNECTION, DATABASE_LIMITS, HTTP_STATUS } from "@/lib/constants";
import * as schema from "@/lib/db/schema";
import { ApiError } from "@/lib/server/api-error";

function createDatabase() {
  const configuredUrl = process.env[DATABASE_CONNECTION.urlEnvironmentName];
  if (!configuredUrl) {
    throw new ApiError(API_ERROR_CODES.serviceUnavailable, HTTP_STATUS.unavailable);
  }

  const directHost = process.env[DATABASE_CONNECTION.directHostEnvironmentName];
  const sslRootCertificate = process.env[DATABASE_CONNECTION.sslRootCertificateEnvironmentName];
  if (Boolean(directHost) !== Boolean(sslRootCertificate)) {
    throw new Error("Direct PostgreSQL connections require both a host and a trusted CA certificate.");
  }

  let connectionString = configuredUrl;
  if (directHost && sslRootCertificate) {
    const directUrl = new URL(configuredUrl);
    directUrl.hostname = directHost;
    directUrl.port = DATABASE_CONNECTION.postgresPort;
    directUrl.searchParams.set("sslmode", DATABASE_CONNECTION.sslMode);
    directUrl.searchParams.set("sslrootcert", sslRootCertificate);
    connectionString = directUrl.toString();
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
