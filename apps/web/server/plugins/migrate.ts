import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { runMigrations } from '../db/client'
import { seed } from '../db/seed'
import { authEnv } from '../lib/env'
import { log } from '../lib/log'

/**
 * Production start: applies pending migrations and the idempotent seed (admin, gaits, hall; no demo
 * accounts) before the first request is answered. Paths default to the source tree for
 * `nuxt preview`; the Docker image sets MIGRATIONS_DIR and HALL_IMAGE_PATH. A failure stops the
 * process so that the container restarts instead of serving a half-migrated database.
 * In development, `pnpm db:migrate && pnpm db:seed` do this by hand.
 */
export default defineNitroPlugin((nitroApp) => {
  if (import.meta.dev) return
  const ready = (async () => {
    const db = useDb()
    await runMigrations(db, process.env.MIGRATIONS_DIR || resolve('server/db/migrations'))
    const { s3, bucket } = useS3()
    const result = await seed(db, {
      superAdminDiscordId: authEnv().SUPER_ADMIN_DISCORD_ID,
      demoUsers: false,
      hallImage: await readFile(
        process.env.HALL_IMAGE_PATH || resolve('../../reference/halle.png'),
      ),
      s3,
      bucket,
    })
    log.info('database ready', { ...result })
  })().catch((e: unknown) => {
    log.error('startup failed', { err: e })
    process.exit(1)
  })
  nitroApp.hooks.hook('request', () => ready)
})
