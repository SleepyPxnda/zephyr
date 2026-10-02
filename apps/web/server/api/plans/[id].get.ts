import { loadPlan } from '../../lib/plans'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const { role } = await requirePlanRole(event, id, 'viewer')
  const plan = await loadPlan(useDb(), id)
  if (!plan) throw problem(404, 'not_found', 'Plan nicht gefunden.')
  setResponseHeader(event, 'ETag', `"${plan.revision}"`)
  return { ...plan, role }
})
