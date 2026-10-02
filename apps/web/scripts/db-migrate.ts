import { createDb, runMigrations } from '../server/db/client'
import { serverEnv } from '../server/lib/env'
import { loadRootEnv } from './env'

loadRootEnv()
const { db, sql } = createDb(serverEnv().DATABASE_URL)
try {
  await runMigrations(db)
  console.log('migrations applied')
} finally {
  await sql.end()
}
