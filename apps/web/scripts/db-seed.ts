import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createDb } from '../server/db/client'
import { seed } from '../server/db/seed'
import { serverEnv } from '../server/lib/env'
import { createS3 } from '../server/lib/storage'
import { loadRootEnv } from './env'

loadRootEnv()
const env = serverEnv()
const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set')
const hallPath =
  process.env.HALL_IMAGE_PATH ??
  fileURLToPath(new URL('../../../reference/halle.png', import.meta.url))

const { db, sql } = createDb(env.DATABASE_URL)
try {
  const result = await seed(db, {
    adminEmail: ADMIN_EMAIL,
    adminPassword: ADMIN_PASSWORD,
    hallImage: readFileSync(hallPath),
    s3: createS3(env),
    bucket: env.S3_BUCKET,
  })
  console.log('seed done', result)
} finally {
  await sql.end()
}
