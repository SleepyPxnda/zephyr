import { memberUpdateSchema } from '@zephyr/core'
import { and, eq } from 'drizzle-orm'
import { planMembers } from '../../../../db/schema'

/** Changes the role of an existing share. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const userId = getRouterParam(event, 'userId') ?? ''
  await requirePlanRole(event, id, 'owner')
  const { role } = await parseBody(event, memberUpdateSchema)
  const rows = /^[0-9a-f-]{36}$/i.test(userId)
    ? await useDb()
        .update(planMembers)
        .set({ role })
        .where(and(eq(planMembers.planId, id), eq(planMembers.userId, userId)))
        .returning({ userId: planMembers.userId })
    : []
  if (!rows.length) throw problem(404, 'not_found', 'Freigabe nicht gefunden.')
  return { userId, role }
})
