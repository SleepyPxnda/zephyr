import { shareTokenSchema } from '@zephyr/core'
import { and, eq, gt, isNull, or } from 'drizzle-orm'
import { files, plans, shareLinks } from '../../../db/schema'
import { arenaInfo, fileInfo } from '../../../lib/info'
import { loadGaits, loadPlan } from '../../../lib/plans'

/**
 * Everything the read-only view needs in one answer: plan, gaits, hall and music. Open with a
 * valid read link (`?t=<token>`, no account needed) or with read access to the plan.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const db = useDb()
  const token = shareTokenSchema.safeParse(getQuery(event).t)
  const viaLink =
    token.success &&
    /^[0-9a-f-]{36}$/i.test(id) &&
    (
      await db
        .select({ id: shareLinks.id })
        .from(shareLinks)
        .innerJoin(plans, eq(plans.id, shareLinks.planId))
        .where(
          and(
            eq(shareLinks.token, token.data),
            eq(shareLinks.planId, id),
            isNull(plans.deletedAt),
            or(isNull(shareLinks.expiresAt), gt(shareLinks.expiresAt, new Date())),
          ),
        )
    ).length > 0
  if (!viaLink) {
    const { user } = await getUserSession(event)
    if (!user) throw problem(404, 'not_found', 'Der Link ist ungültig oder wurde widerrufen.')
    await requirePlanRole(event, id, 'viewer')
  }

  const plan = await loadPlan(db, id)
  if (!plan) throw problem(404, 'not_found', 'Plan nicht gefunden.')
  const [music] = plan.timing.musicId
    ? await db.select().from(files).where(eq(files.id, plan.timing.musicId))
    : []
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return {
    plan,
    gaits: await loadGaits(db),
    arena: await arenaInfo(db),
    music: music ? await fileInfo(music) : null,
  }
})
