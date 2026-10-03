import { and, eq } from 'drizzle-orm'
import { shareLinks } from '../../../../db/schema'

/** Revokes a read link at once; revoking one that does not exist is fine. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const linkId = getRouterParam(event, 'linkId') ?? ''
  await requirePlanRole(event, id, 'owner')
  if (/^[0-9a-f-]{36}$/i.test(linkId))
    await useDb()
      .delete(shareLinks)
      .where(and(eq(shareLinks.id, linkId), eq(shareLinks.planId, id)))
  setResponseStatus(event, 204)
  return null
})
