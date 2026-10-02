import { createPlanSchema, fromPoc, PocFormatError } from '@zephyr/core'
import { randomUUID } from 'node:crypto'
import { gaits } from '../../db/schema'
import { createPlan, emptyContent, loadGaits } from '../../lib/plans'
import { pocGaitValues } from '../../lib/poc'

/**
 * New plan: empty, or imported from prototype JSON. Gaits are matched by name; unknown names
 * answer 409 `unknown_gaits` so the client can map them (`gaitMap`) or, for admins, create
 * them globally (`createGaits`).
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const input = await parseBody(event, createPlanSchema)
  const db = useDb()
  let gaitList = await loadGaits(db)

  if (input.poc === undefined) {
    const id = await createPlan(db, user.id, emptyContent(input.title ?? 'Neuer Plan', gaitList))
    setResponseStatus(event, 201)
    return { id }
  }

  const importOnce = () =>
    fromPoc(input.poc, {
      gaits: gaitList,
      gaitMap: input.gaitMap,
      newId: randomUUID,
      title: input.title ?? 'Import',
    })
  let res
  try {
    res = importOnce()
    if (!res.ok && input.createGaits) {
      if (user.role !== 'admin')
        throw problem(403, 'forbidden', 'Nur Administratoren können Gangarten anlegen.')
      const values = pocGaitValues(input.poc, res.unknownGaits)
      const start = gaitList.length
      await db.insert(gaits).values(values.map((g, i) => ({ ...g, position: start + i })))
      gaitList = await loadGaits(db)
      res = importOnce()
    }
  } catch (e) {
    if (e instanceof PocFormatError)
      throw problem(422, 'validation', 'Kein gültiger Plan aus dem Prototyp.')
    throw e
  }
  if (!res.ok) {
    throw problem(409, 'unknown_gaits', 'Einige Gangarten sind unbekannt.', {
      unknownGaits: res.unknownGaits,
      canCreate: user.role === 'admin',
    })
  }
  const id = await createPlan(db, user.id, res.plan)
  setResponseStatus(event, 201)
  return { id, musicName: res.musicName }
})
