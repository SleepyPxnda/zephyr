import { toPoc } from '@zephyr/core'
import { loadGaits, loadPlan } from '../../../lib/plans'

/** Prototype-compatible JSON for download (SPEC "Übernahme aus dem PoC"). */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  await requirePlanRole(event, id, 'viewer')
  const db = useDb()
  const plan = await loadPlan(db, id)
  if (!plan) throw problem(404, 'not_found', 'Plan nicht gefunden.')
  const name =
    plan.title
      .replace(/[^\p{L}\p{N} _-]+/gu, '')
      .trim()
      .slice(0, 80) || 'plan'
  setResponseHeader(
    event,
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(name)}.json`,
  )
  return toPoc(plan, await loadGaits(db))
})
