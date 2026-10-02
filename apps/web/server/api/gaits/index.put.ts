import { gaitsInputSchema } from '@zephyr/core'
import { eq, inArray, sql } from 'drizzle-orm'
import { gaits } from '../../db/schema'
import { loadGaits } from '../../lib/plans'

/**
 * Saves the global gait table (admins). The order of the list is the order in the app; rows
 * without id are new. Gaits left out are deleted, or archived when a plan still uses them.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const input = await parseBody(event, gaitsInputSchema)
  const db = useDb()

  await db.transaction(async (tx) => {
    const existing = await tx.select().from(gaits)
    const known = new Set(existing.map((g) => g.id))
    const unknown = input.filter((g) => g.id && !known.has(g.id))
    if (unknown.length)
      throw problem(422, 'validation', 'Unbekannte Gangart.', {
        errors: unknown.map((g) => ({ path: `id`, message: `unknown ${g.id}` })),
      })
    const usedRows = await tx.execute<{ id: string }>(sql`
      select distinct s->>'gaitId' as id from horses h, jsonb_array_elements(h.path->'sections') s
      union select settings->>'drawGaitId' from plans where settings->>'drawGaitId' is not null`)
    const used = new Set(usedRows.map((r) => r.id))
    const now = new Date()

    for (const [position, g] of input.entries()) {
      const values = {
        position,
        name: g.name,
        color: g.color,
        speedTack: g.speedTack,
        speedBare: g.speedBare,
        turnDiameterM: g.turnDiameter,
      }
      if (g.id) {
        const before = existing.find((e) => e.id === g.id)
        await tx
          .update(gaits)
          .set({ ...values, archivedAt: g.archived ? (before?.archivedAt ?? now) : null })
          .where(eq(gaits.id, g.id))
      } else await tx.insert(gaits).values({ ...values, archivedAt: g.archived ? now : null })
    }
    const kept = new Set(input.flatMap((g) => (g.id ? [g.id] : [])))
    const dropped = existing.filter((g) => !kept.has(g.id))
    const archive = dropped.filter((g) => used.has(g.id)).map((g) => g.id)
    const remove = dropped.filter((g) => !used.has(g.id)).map((g) => g.id)
    if (archive.length)
      await tx.update(gaits).set({ archivedAt: now }).where(inArray(gaits.id, archive))
    if (remove.length) await tx.delete(gaits).where(inArray(gaits.id, remove))
  })
  return loadGaits(db)
})
