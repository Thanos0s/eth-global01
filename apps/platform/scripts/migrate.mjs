import { getPostgresPool, migratePostgres } from "../src/lib/db/postgres.ts";

async function main() {
  console.log("=== Running PostgreSQL Schema Migrations ===");
  const pool = getPostgresPool();
  if (!pool) {
    console.error("Error: DATABASE_URL or POSTGRES_URL environment variable is not configured.");
    process.exit(1);
  }

  try {
    console.log("Connecting to PostgreSQL pool...");
    await migratePostgres(pool);
    console.log("✓ PostgreSQL migrations executed successfully within transaction!");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

main();
