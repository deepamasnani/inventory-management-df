import * as schema from "./schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/devfootwear";

const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

const client = postgres(connectionString, {
  ssl: isLocal ? false : "require",
  max: process.env.VERCEL ? 1 : 10,
  prepare: false,
});

export const db = drizzle(client, { schema });
