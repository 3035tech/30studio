import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL or DATABASE_MIGRATION_URL is required to apply migrations.");
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });

async function applyMigrations() {
  try {
    await migrate(drizzle(pool), {
      migrationsFolder: resolve(process.cwd(), "lib/db/migrations"),
    });
    console.info("Database migrations applied successfully.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown migration error.";
    const code = typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : undefined;

    console.error("Database migration failed.", { message, ...(code ? { code } : {}) });
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void applyMigrations();
