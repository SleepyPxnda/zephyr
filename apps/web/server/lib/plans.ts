import { randomUUID } from 'node:crypto'
import {
  normalize,
  planContentSchema,
  type Gait,
  type Horse,
  type Part,
  type Plan,
  type PlanContent,
} from '@zephyr/core'
import { asc, eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { files, gaits, horses, parts, plans } from '../db/schema'

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
type DbOrTx = Db | Tx

export async function loadGaits(db: DbOrTx): Promise<Gait[]> {
  const rows = await db.select().from(gaits).orderBy(asc(gaits.position))
  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    color: g.color,
    speedTack: g.speedTack,
    speedBare: g.speedBare,
    turnDiameter: g.turnDiameterM,
    archivedAt: g.archivedAt ? g.archivedAt.toISOString() : null,
  }))
}

/** The full plan document (SPEC "Plan-Dokument"), or null when missing or deleted. */
export async function loadPlan(db: DbOrTx, planId: string): Promise<Plan | null> {
  const [p] = await db.select().from(plans).where(eq(plans.id, planId))
  if (!p || p.deletedAt) return null
  const hs = await db
    .select()
    .from(horses)
    .where(eq(horses.planId, planId))
    .orderBy(asc(horses.position))
  const ps = await db
    .select()
    .from(parts)
    .where(eq(parts.planId, planId))
    .orderBy(asc(parts.position))
  return {
    id: p.id,
    revision: p.revision,
    title: p.title,
    timing: { bpm: p.bpm, beat0: p.beat0S, meter: p.meter === 3 ? 3 : 4, musicId: p.musicId },
    settings: p.settings,
    horses: hs.map((h): Horse => ({
      id: h.id,
      number: h.number,
      name: h.name,
      color: h.color,
      tack: h.tack,
      path: h.path,
      pending: h.pending,
    })),
    parts: ps.map((q): Part => ({
      id: q.id,
      name: q.name,
      start: q.startS,
      end: q.endS,
      color: q.color,
    })),
  }
}

export type ContentCheck =
  { ok: true; content: PlanContent } | { ok: false; errors: { path: string; message: string }[] }

/**
 * Validates a plan document against the schema and the path rules, checks references to gaits
 * and music, and normalizes every path with `@zephyr/core` (the server never trusts the client).
 */
export async function checkContent(
  db: DbOrTx,
  input: unknown,
  ctx: { userId: string; currentMusicId: string | null },
): Promise<ContentCheck> {
  const parsed = planContentSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    }
  }
  const content = parsed.data
  const errors: { path: string; message: string }[] = []
  const gaitIds = new Set((await loadGaits(db)).map((g) => g.id))
  content.horses.forEach((h, hi) =>
    h.path.sections.forEach((s, k) => {
      if (!gaitIds.has(s.gaitId))
        errors.push({ path: `horses.${hi}.path.sections.${k}.gaitId`, message: 'unknown gait' })
    }),
  )
  if (content.settings.drawGaitId && !gaitIds.has(content.settings.drawGaitId))
    errors.push({ path: 'settings.drawGaitId', message: 'unknown gait' })
  const dup = (ids: string[]) => ids.length !== new Set(ids).size
  if (dup(content.horses.map((h) => h.id))) errors.push({ path: 'horses', message: 'duplicate id' })
  if (dup(content.parts.map((q) => q.id))) errors.push({ path: 'parts', message: 'duplicate id' })
  const musicId = content.timing.musicId
  if (musicId && musicId !== ctx.currentMusicId) {
    const [f] = await db.select().from(files).where(eq(files.id, musicId))
    if (!f || f.kind !== 'audio' || f.ownerId !== ctx.userId)
      errors.push({ path: 'timing.musicId', message: 'unknown music file' })
  }
  if (errors.length) return { ok: false, errors }
  const ids = [...gaitIds]
  return {
    ok: true,
    content: {
      ...content,
      horses: content.horses.map((h) => ({ ...h, path: normalize(h.path, { gaitIds: ids }) })),
    },
  }
}

/** Replaces horses and parts and updates the plan row; the caller handles revision checks. */
export async function writeContent(
  tx: Tx,
  planId: string,
  c: PlanContent,
  revision: number,
): Promise<void> {
  await tx
    .update(plans)
    .set({
      title: c.title,
      bpm: c.timing.bpm,
      beat0S: c.timing.beat0,
      meter: c.timing.meter,
      musicId: c.timing.musicId,
      settings: c.settings,
      revision,
      updatedAt: new Date(),
    })
    .where(eq(plans.id, planId))
  await tx.delete(horses).where(eq(horses.planId, planId))
  await tx.delete(parts).where(eq(parts.planId, planId))
  if (c.horses.length)
    await tx.insert(horses).values(
      c.horses.map((h, position) => ({
        id: h.id,
        planId,
        position,
        number: h.number,
        name: h.name,
        color: h.color,
        tack: h.tack,
        path: h.path,
        pending: h.pending,
      })),
    )
  if (c.parts.length)
    await tx.insert(parts).values(
      c.parts.map((q, position) => ({
        id: q.id,
        planId,
        position,
        name: q.name,
        startS: q.start,
        endS: q.end,
        color: q.color,
      })),
    )
}

/** Creates a plan owned by `ownerId` with the given content (fresh ids). Returns its id. */
export async function createPlan(db: Db, ownerId: string, c: PlanContent): Promise<string> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(plans)
      .values({ ownerId, title: c.title, settings: c.settings, revision: 0 })
      .returning({ id: plans.id })
    if (!row) throw new Error('plan not created')
    const fresh: PlanContent = {
      ...c,
      horses: c.horses.map((h) => ({ ...h, id: randomUUID() })),
      parts: c.parts.map((q) => ({ ...q, id: randomUUID() })),
    }
    await writeContent(tx, row.id, fresh, 1)
    return row.id
  })
}

/** Default content of a new, empty plan. */
export function emptyContent(title: string, gaitList: readonly Gait[]): PlanContent {
  const active = gaitList.filter((g) => !g.archivedAt)
  // like the prototype: draw in the second gait (Trab) when there is one
  const drawGait = active[Math.min(1, active.length - 1)]
  return {
    title,
    timing: { bpm: null, beat0: 0, meter: 4, musicId: null },
    settings: { timelineZoom: 24, drawGaitId: drawGait?.id ?? null, roundCorners: true },
    horses: [],
    parts: [],
  }
}
