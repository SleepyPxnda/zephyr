import { createDb, type Db } from '../db/client'
import { serverEnv } from '../lib/env'

let db: Db | undefined

/** Shared database connection of the server process. */
export function useDb(): Db {
  db ??= createDb(serverEnv().DATABASE_URL).db
  return db
}
