import * as schema from "./schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = process.env.POSTGRES_URL || "postgresql://postgres:postgres@localhost:5432/devfootwear";

const client = postgres(connectionString);
export const db = drizzle(client, { schema });
