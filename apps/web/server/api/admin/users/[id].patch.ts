import { adminUserPatchSchema } from '@zephyr/core'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '../../../db/schema'
import { authEnv } from '../../../lib/env'
import { adminUserView } from '../../../lib/users'

/**
 * Approves, rejects or blocks an account, or changes its role. The super admin and the admin's
 * own account cannot be changed here, so nobody locks themselves or the owner out.
 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)
  const id = z.uuid().safeParse(getRouterParam(event, 'id'))
  if (!id.success) throw problem(404, 'not_found', 'Nutzer nicht gefunden.')
  const input = await parseBody(event, adminUserPatchSchema)
  const superAdminId = authEnv().SUPER_ADMIN_DISCORD_ID
  const db = useDb()

  const [target] = await db.select().from(users).where(eq(users.id, id.data))
  if (!target) throw problem(404, 'not_found', 'Nutzer nicht gefunden.')
  if (target.discordId === superAdminId)
    throw problem(403, 'forbidden', 'Der Super-Admin lässt sich nicht ändern.')
  if (target.id === admin.id)
    throw problem(403, 'forbidden', 'Das eigene Konto lässt sich hier nicht ändern.')

  const statusChanged = input.status !== undefined && input.status !== target.status
  const [updated] = await db
    .update(users)
    .set({ ...input, ...(statusChanged ? { decidedAt: new Date() } : {}) })
    .where(eq(users.id, target.id))
    .returning()
  if (!updated) throw problem(404, 'not_found', 'Nutzer nicht gefunden.')
  return adminUserView(updated, superAdminId)
})
