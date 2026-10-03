import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createDb } from '../server/db/client'
import { seed } from '../server/db/seed'
import { authEnv, serverEnv } from '../server/lib/env'
import { createS3 } from '../server/lib/storage'
import { loadRootEnv } from './env'

loadRootEnv()
const env = serverEnv()
const { SUPER_ADMIN_DISCORD_ID } = authEnv()
const hallPath =
  process.env.HALL_IMAGE_PATH ??
  fileURLToPath(new URL('../../../reference/halle.png', import.meta.url))

const { db, sql } = createDb(env.DATABASE_URL)
try {
  const result = await seed(db, {
    superAdminDiscordId: SUPER_ADMIN_DISCORD_ID,
    demoUsers: process.env.NODE_ENV !== 'production',
    hallImage: readFileSync(hallPath),
    s3: createS3(env),
    bucket: env.S3_BUCKET,
  })
  console.log('seed done', result)
} finally {
  await sql.end()
}
