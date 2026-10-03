import { randomBytes } from 'node:crypto'
import { shareLinks } from '../../../../db/schema'

/** New read link: 32 random bytes, valid until revoked (decision of the user, M10). */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  await requirePlanRole(event, id, 'owner')
  const [row] = await useDb()
    .insert(shareLinks)
    .values({ planId: id, token: randomBytes(32).toString('base64url'), role: 'viewer' })
    .returning({ id: shareLinks.id, token: shareLinks.token, createdAt: shareLinks.createdAt })
  if (!row) throw createError({ statusCode: 500 })
  setResponseStatus(event, 201)
  return { ...row, createdAt: row.createdAt.toISOString() }
})
