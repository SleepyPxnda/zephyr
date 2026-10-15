import { adminUserPatchSchema } from '@zephyr/core'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '../../../db/schema'
import { dropUser } from '../../../lib/live'
import { adminUserView } from '../../../lib/users'

/** Approves, rejects or blocks an account. Admin accounts cannot be changed here. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = z.uuid().safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw problem(404, 'not_found', 'Nutzer nicht gefunden.')
  const { status } = await parseBody(event, adminUserPatchSchema)

  const db = useDb()
  const [target] = await db.select().from(users).where(eq(users.id, id.data))
  if (!target) throw problem(404, 'not_found', 'Nutzer nicht gefunden.')
  if (isAdmin(target)) throw problem(403, 'forbidden', 'Admin-Konten lassen sich nicht ändern.')
  // an empty set() throws in drizzle
  if (status === target.status) return adminUserView(target)
  const [updated] = await db
    .update(users)
    .set({ status, decidedAt: new Date() })
    .where(eq(users.id, target.id))
    .returning()
  if (!updated) throw problem(404, 'not_found', 'Nutzer nicht gefunden.')
  if (status === 'rejected') dropUser(updated.id)
  return adminUserView(updated)
})
