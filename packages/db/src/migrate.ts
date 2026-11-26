import { migrateDatabase } from "./migrations";

const url = process.env.DATABASE_URL;

if (url === undefined || url.length === 0) {
  throw new Error("DATABASE_URL is required to migrate the v2 database");
}

await migrateDatabase(url);

console.log("[db] migrations applied");
