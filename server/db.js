import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema.js";

const { Pool } = pg;

// Standard node-postgres rather than @neondatabase/serverless.
// The Neon driver only talks to Neon over WebSockets; `pg` speaks the ordinary
// Postgres wire protocol, so it works with Neon AND with any other host — which
// is what makes moving the database a connection-string change rather than a
// rewrite. Nothing else in the app imports the driver; everything uses `db`.
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const redactedUrl = process.env.DATABASE_URL?.replace(
  /:\/\/([^:]+):([^@]+)@/,
  "://***:***@",
);
console.log(`Database connection established: ${redactedUrl}`);

// TLS. Managed providers (Neon, RDS, Azure) require it; a Postgres on the same
// host as the app doesn't. Set DATABASE_SSL=disable for the latter.
// If DATABASE_CA holds the provider's CA certificate the server identity is
// verified properly; without it the connection is still encrypted but the
// certificate isn't checked, which leaves it open to an interception attack in
// theory. Supply the CA for anything holding real data.
function sslConfig() {
  if (process.env.DATABASE_SSL === "disable") return false;
  if (process.env.DATABASE_CA) {
    return { ca: process.env.DATABASE_CA, rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: sslConfig(),
});

pool.on("error", (err) => {
  console.error("Unexpected database pool error:", err.message);
});

export const db = drizzle({ client: pool, schema });
