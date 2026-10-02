import { createPlan, loadPlan } from '../../../lib/plans'

/** Copy for the requesting person (needs read access). */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const { user } = await requirePlanRole(event, id, 'viewer')
  const db = useDb()
  const plan = await loadPlan(db, id)
  if (!plan) throw problem(404, 'not_found', 'Plan nicht gefunden.')
  const { id: _id, revision: _rev, ...content } = plan
  const copyId = await createPlan(db, user.id, {
    ...content,
    title: `${plan.title} (Kopie)`.slice(0, 200),
  })
  setResponseStatus(event, 201)
  return { id: copyId }
})
