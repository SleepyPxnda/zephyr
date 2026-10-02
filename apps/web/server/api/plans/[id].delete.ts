import { eq } from 'drizzle-orm'
import { plans } from '../../db/schema'

/** Soft delete (owner only); purged for good after 30 days by the `plans:purge` task. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  await requirePlanRole(event, id, 'owner')
  await useDb().update(plans).set({ deletedAt: new Date() }).where(eq(plans.id, id))
  setResponseStatus(event, 204)
  return null
})
