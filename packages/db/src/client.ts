import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export type Db = PostgresJsDatabase<typeof schema>;

let _db: Db | undefined;
let _sql: ReturnType<typeof postgres> | undefined;

/**
 * Lazily-initialised drizzle client. Lazy so importing this module never connects (or throws
 * on a missing DATABASE_URL) at build time — only the first query opens a connection.
 */
export function getDb(): Db {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    _sql = postgres(url, { max: 10 });
    _db = drizzle(_sql, { schema });
  }
  return _db;
}

/** Close the pool (tests, graceful shutdown). */
export async function closeDb(): Promise<void> {
  await _sql?.end();
  _sql = undefined;
  _db = undefined;
}
