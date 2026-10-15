import { desc, notInArray } from 'drizzle-orm'
import { users } from '../../../db/schema'
import { authEnv } from '../../../lib/env'
import { adminUserView } from '../../../lib/users'

/** All accounts except the admins, newest first (open requests are filtered by the page). */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const rows = await useDb()
    .select()
    .from(users)
    .where(notInArray(users.discordId, authEnv().SUPER_ADMIN_DISCORD_ID))
    .orderBy(desc(users.createdAt))
  return rows.map(adminUserView)
})
