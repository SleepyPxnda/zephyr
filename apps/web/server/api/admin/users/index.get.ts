import { desc } from 'drizzle-orm'
import { users } from '../../../db/schema'
import { authEnv } from '../../../lib/env'
import { adminUserView } from '../../../lib/users'

/** All accounts, newest first (open requests are filtered by the page). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const superAdminId = authEnv().SUPER_ADMIN_DISCORD_ID
  const rows = await useDb().select().from(users).orderBy(desc(users.createdAt))
  return rows.map((u) => adminUserView(u, superAdminId))
})
