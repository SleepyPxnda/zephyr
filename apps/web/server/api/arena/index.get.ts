import { arenaInfo } from '../../lib/info'

/** The one hall: image (signed address, 5 min) and size in metres. */
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const info = await arenaInfo(useDb())
  if (!info) throw problem(404, 'not_found', 'Die Halle ist noch nicht eingerichtet.')
  return info
})
