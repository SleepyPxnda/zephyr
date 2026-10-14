import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { eq } from 'drizzle-orm'
import { createDb } from '../server/db/client'
import { arena, files } from '../server/db/schema'
import { seed } from '../server/db/seed'
import { authEnv, serverEnv } from '../server/lib/env'
import { createStore, localPath } from '../server/lib/storage'
import { loadRootEnv } from './env'

loadRootEnv()
const env = serverEnv()
const { SUPER_ADMIN_DISCORD_ID } = authEnv()
const hallPath =
  process.env.HALL_IMAGE_PATH ??
  fileURLToPath(new URL('../../../reference/halle.png', import.meta.url))
const hallImage = readFileSync(hallPath)
const store = createStore(env)

const { db, sql } = createDb(env.DATABASE_URL)
try {
  const result = await seed(db, {
    superAdminDiscordId: SUPER_ADMIN_DISCORD_ID,
    demoUsers: process.env.NODE_ENV !== 'production',
    hallImage,
    store,
  })
  console.log('seed done', result)
  // a fresh local folder lacks the hall image of an existing arena: put the default one back
  if (env.STORAGE === 'local') {
    const [hall] = await db
      .select({ key: files.storageKey, mime: files.mime })
      .from(arena)
      .innerJoin(files, eq(files.id, arena.imageId))
    if (hall && !existsSync(localPath(env.STORAGE_DIR, hall.key))) {
      await store.put(hall.key, hallImage, hall.mime)
      console.log('hall image restored in', env.STORAGE_DIR)
    }
  }
} finally {
  await sql.end()
}
