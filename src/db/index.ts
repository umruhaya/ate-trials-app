import { createClient } from "@libsql/client/node";
import { drizzle } from "drizzle-orm/libsql";
import { env } from "~/config/env.server";
import * as schema from "./schema.ts";

// in production, use the file database
// in development, use the remote database using the tunnel
// const databaseUrl = process.env.NODE_ENV  === 'production' ? 'file:.db/main.db' : 'http://127.0.0.1:8900'

const client = createClient({
	url: env.DATABASE_URL,
});

export const db = drizzle(client, { schema });
export const table = schema;
