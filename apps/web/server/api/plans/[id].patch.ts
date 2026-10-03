import { patchPlanSchema } from '@zephyr/core'
import { eq, sql } from 'drizzle-orm'
import { plans } from '../../db/schema'
import { refresh as refreshLive } from '../../lib/live'
import { checkContent, loadPlan } from '../../lib/plans'

/** Title, timing, music, settings; checked like a full save and counted as a new revision. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const { user } = await requirePlanRole(event, id, 'editor')
  const input = await parseBody(event, patchPlanSchema)
  const db = useDb()
  const current = await loadPlan(db, id)
  if (!current) throw problem(404, 'not_found', 'Plan nicht gefunden.')
  const { id: _id, revision: _rev, ...content } = current
  const check = await checkContent(
    db,
    { ...content, ...input },
    { userId: user.id, currentMusicId: current.timing.musicId },
  )
  if (!check.ok)
    throw problem(422, 'validation', 'Der Plan ist ungültig.', { errors: check.errors })
  const c = check.content
  const [row] = await db
    .update(plans)
    .set({
      title: c.title,
      bpm: c.timing.bpm,
      beat0S: c.timing.beat0,
      meter: c.timing.meter,
      musicId: c.timing.musicId,
      settings: c.settings,
      revision: sql`${plans.revision} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(plans.id, id))
    .returning({ revision: plans.revision })
  await refreshLive(id)
  setResponseHeader(event, 'ETag', `"${row?.revision}"`)
  return { revision: row?.revision }
})
