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
//
// The default VERIFIES the server certificate against the system CA store.
// It used to return `rejectUnauthorized: false` — encrypted but unauthenticated,
// open to interception. That was masked, not fixed, by `sslmode=verify-full` in
// DATABASE_URL: pg assigns the parsed connection string OVER the explicit ssl
// option, and verify-full parses to `{}`, which means Node's default of
// rejectUnauthorized: true. So verification was on, but only because one
// dependency's merge order happened to favour it. Dropping sslmode from the URL —
// an edit anyone might make while rotating a password — would have silently
// disabled certificate checking with no error and no log line.
//
// DATABASE_CA remains for a provider using a private CA the system store doesn't
// carry. Neon's certificate chains to a public root, so it is not needed here.
function sslConfig() {
  if (process.env.DATABASE_SSL === "disable") return false;
  if (process.env.DATABASE_CA) {
    return { ca: process.env.DATABASE_CA, rejectUnauthorized: true };
  }
  return { rejectUnauthorized: true };
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
