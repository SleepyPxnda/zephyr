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

/** Default location of the generated migrations (next to this file in the source tree). */
export const migrationsFolder = fileURLToPath(new URL('./migrations', import.meta.url))

/** Applies all pending migrations (forward only). */
export async function runMigrations(db: Db, folder = migrationsFolder): Promise<void> {
  await migrate(db, { migrationsFolder: folder })
}
