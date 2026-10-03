import { and, eq } from 'drizzle-orm'
import { planMembers } from '../../../../db/schema'

/** Ends a share; deleting one that does not exist is fine. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const userId = getRouterParam(event, 'userId') ?? ''
  await requirePlanRole(event, id, 'owner')
  if (/^[0-9a-f-]{36}$/i.test(userId))
    await useDb()
      .delete(planMembers)
      .where(and(eq(planMembers.planId, id), eq(planMembers.userId, userId)))
  setResponseStatus(event, 204)
  return null
})
