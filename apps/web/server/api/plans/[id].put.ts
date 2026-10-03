import { eq } from 'drizzle-orm'
import { plans } from '../../db/schema'
import { refresh as refreshLive } from '../../lib/live'
import { checkContent, loadPlan, writeContent } from '../../lib/plans'

/**
 * Saves the whole document (SPEC "Speichern und Konflikte"): `If-Match: <revision>` is
 * required; validated, normalized and written in one transaction; revision + 1. A stale
 * revision answers 412 with the current document.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const { user } = await requirePlanRole(event, id, 'editor')
  const ifMatch = getRequestHeader(event, 'if-match')
    ?.replace(/^W\//, '')
    .replaceAll('"', '')
    .trim()
  if (!ifMatch || !/^\d+$/.test(ifMatch))
    throw problem(428, 'validation', 'If-Match mit der Revision fehlt.')
  const body: unknown = await readBody(event).catch(() => undefined)
  const db = useDb()

  const result = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(plans).where(eq(plans.id, id)).for('update')
    if (!row || row.deletedAt) throw problem(404, 'not_found', 'Plan nicht gefunden.')
    if (row.revision !== Number(ifMatch)) return { conflict: true as const }
    const check = await checkContent(tx, body, { userId: user.id, currentMusicId: row.musicId })
    if (!check.ok)
      throw problem(422, 'validation', 'Der Plan ist ungültig.', { errors: check.errors })
    try {
      await writeContent(tx, id, check.content, row.revision + 1)
    } catch (e) {
      // e.g. a horse id that already belongs to another plan
      if (
        (e as { cause?: { code?: string } }).cause?.code === '23505' ||
        (e as { code?: string }).code === '23505'
      )
        throw problem(422, 'validation', 'Doppelte Kennung.', {
          errors: [{ path: 'horses', message: 'id in use' }],
        })
      throw e
    }
    return { conflict: false as const, revision: row.revision + 1 }
  })

  if (result.conflict) {
    const current = await loadPlan(db, id)
    throw problem(412, 'revision_conflict', 'Der Plan wurde inzwischen geändert.', { current })
  }
  await refreshLive(id)
  const plan = await loadPlan(db, id)
  setResponseHeader(event, 'ETag', `"${result.revision}"`)
  return plan
})
