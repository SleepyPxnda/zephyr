import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import * as schema from './schema'

export function createDb(url: string) {
  const sql = postgres(url, { max: 10, onnotice: () => {} })
  return { db: drizzle(sql, { schema }), sql }
}

export type Db = ReturnType<typeof createDb>['db']

/**
 * Applies all pending migrations (forward only). The default folder (next to this file in the
 * source tree) is resolved per call: in the bundled server the URL is meaningless on Windows and
 * must not break loading this module.
 */
export async function runMigrations(
  db: Db,
  folder = fileURLToPath(new URL('./migrations', import.meta.url)),
): Promise<void> {
  await migrate(db, { migrationsFolder: folder })
}
