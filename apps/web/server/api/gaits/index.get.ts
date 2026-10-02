import { loadGaits } from '../../lib/plans'

/** The global gait table, archived gaits included (they stay valid for existing sections). */
export default defineEventHandler(async (event) => {
  await requireUser(event)
  return loadGaits(useDb())
})
