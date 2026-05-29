// @ollive/db — Drizzle schema + lazy client.
export const DB_VERSION = '0.1.0';

export * as schema from './schema.js';
export * from './schema.js';
export { getDb, closeDb, type Db } from './client.js';
