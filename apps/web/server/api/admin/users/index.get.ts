import { desc, ne } from 'drizzle-orm'
import { users } from '../../../db/schema'
import { adminUserView } from '../../../lib/users'

/** All accounts except the admin's own, newest first (open requests are filtered by the page). */
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const rows = await useDb()
    .select()
    .from(users)
    .where(ne(users.id, admin.id))
    .orderBy(desc(users.createdAt))
  return rows.map(adminUserView)
})
