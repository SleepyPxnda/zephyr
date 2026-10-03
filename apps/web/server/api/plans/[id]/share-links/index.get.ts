import { asc, eq } from 'drizzle-orm'
import { shareLinks } from '../../../../db/schema'

/** The plan's read links (the owner sees the tokens to copy them again). */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  await requirePlanRole(event, id, 'owner')
  const rows = await useDb()
    .select({ id: shareLinks.id, token: shareLinks.token, createdAt: shareLinks.createdAt })
    .from(shareLinks)
    .where(eq(shareLinks.planId, id))
    .orderBy(asc(shareLinks.createdAt))
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
})
