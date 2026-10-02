import { fromStrokes, normalizeStrokes, type Strokes } from './path'
import type { Gait, Geo, Hand, Horse, Part, PathPoint, Pending, PlanContent } from './schemas'

/**
 * Prototype JSON ↔ plan document (SPEC "Übernahme aus dem PoC"). The import coerces values
 * exactly like the prototype's `load`, migrates legacy halt/pause points (`migrateLegacy`)
 * and normalizes; gaits are matched by name to the global gait table.
 */

const DEFAULT_POC_GAITS = [
  { id: 'g1', name: 'Schritt', w: 1.6, o: 1.7, md: 2 },
  { id: 'g2', name: 'Trab', w: 3.6, o: 3.9, md: 6 },
  { id: 'g3', name: 'Galopp', w: 5.5, o: 6.0, md: 8 },
]
const POC_HORSE_COLOR = '#c0392b'
const PART_COLORS = ['#7c6fd6', '#d9822b', '#2f9e8f', '#c2477a', '#5a8fd8', '#a38b2e']
const HEX = /^#[0-9a-f]{6}$/i

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)
const rec = (v: unknown): Rec => (isRec(v) ? v : {})
/** JavaScript's unary plus, as the prototype uses it for coercion. */
const plus = (v: unknown): number => Number(v)
const str = (v: unknown): string => String(v ?? '')
/** The prototype's global `isFinite` (coerces, so null and '' count as 0). */
const finite = (v: unknown): boolean => typeof v !== 'symbol' && Number.isFinite(plus(v))

export class PocFormatError extends Error {}

interface PocGait {
  id: string
  name: string
}

/** A point as the prototype loads it, possibly carrying legacy halt (w) / pause (gap) marks. */
export type LegacyPoint = PathPoint & { w?: number; gap?: true; pend?: true }
export interface LegacyHorse extends Omit<Strokes, 'pts'> {
  pts: LegacyPoint[]
  pendJump: boolean
  pendGap: { w: number; t: 'halt' | 'pause' } | null
}

/**
 * Older plans stored halts and pauses as extra points; turn them into gaps and jumps
 * (prototype `migrateLegacy`). Mutates `h`, which must be a private copy.
 */
export function migrateLegacy(h: LegacyHorse, delay: number): void {
  h.gaps = h.strokes.map((_, k) => +(h.gaps[k] ?? NaN) || 0)
  h.gt = h.strokes.map((_, k) => h.gt[k] || null)
  if (h.gaps.length) h.gaps[0] = (h.gaps[0] ?? 0) + (delay || 0)
  const n = (a: number[], k: number) => a[k] as number
  for (let k = h.strokes.length - 1; k >= 0; k--) {
    const s0 = n(h.strokes, k)
    const e = (k + 1 < h.strokes.length ? n(h.strokes, k + 1) : h.pts.length) - 1
    const q = h.pts[s0]
    if (!(s0 === e && s0 > 0 && q && q.w)) continue
    const w = q.w
    if (q.gap) {
      const pend = q.pend
      delete q.w
      delete q.gap
      delete q.pend
      if (k + 1 < h.strokes.length) {
        q.jump = true
        h.strokes.splice(k + 1, 1)
        h.sg.splice(k, 1)
        h.tack.splice(k, 1)
        const g = h.gaps.splice(k + 1, 1)[0] || 0
        h.gaps[k] = (h.gaps[k] || 0) + w + g
        h.gt.splice(k + 1, 1)
        h.gt[k] = 'pause'
      } else {
        h.pts.splice(s0, 1)
        h.strokes.splice(k, 1)
        h.sg.splice(k, 1)
        h.gaps.splice(k, 1)
        h.gt.splice(k, 1)
        h.tack.splice(k, 1)
        if (pend) {
          h.pendJump = true
          h.pendGap = { w, t: 'pause' }
        }
      }
    } else {
      h.pts.splice(s0, 1)
      h.strokes.splice(k, 1)
      h.sg.splice(k, 1)
      h.tack.splice(k, 1)
      const g0 = h.gaps.splice(k, 1)[0] || 0
      h.gt.splice(k, 1)
      for (let j = k; j < h.strokes.length; j++) h.strokes[j] = n(h.strokes, j) - 1
      if (k < h.strokes.length) {
        h.gaps[k] = (h.gaps[k] || 0) + w + g0
        h.gt[k] = 'halt'
      } else h.pendGap = { w, t: 'halt' }
    }
  }
  h.pts.forEach((q) => {
    delete q.w
    delete q.gap
    delete q.pend
  })
}

function loadGeo(g: unknown): Geo | undefined {
  if (!isRec(g)) return undefined
  const kind = g.kind
  if (kind !== 'line' && kind !== 'arc' && kind !== 'circle' && kind !== 'arc3') return undefined
  const E = rec(g.E)
  const M = rec(g.M)
  if (!isRec(g.E) || !finite(E.x) || !finite(E.y)) return undefined
  if (kind === 'arc3' && (!isRec(g.M) || !finite(M.x))) return undefined
  // the prototype keeps any truthy hand; the document only knows these three
  const hand: Hand = g.hand === 'left' || g.hand === 'right' ? g.hand : 'auto'
  const geo: Geo = {
    kind,
    E: { x: plus(E.x), y: plus(E.y) },
    hand,
    half: !!g.half,
    round: g.round !== false,
  }
  if (kind === 'arc3') geo.M = { x: plus(M.x), y: plus(M.y) }
  return geo
}

function loadHorse(p: Rec): LegacyHorse {
  const pts: LegacyPoint[] = (Array.isArray(p.pts) ? p.pts : [])
    .map(rec)
    .filter((q) => finite(q.x) && finite(q.y))
    .map((q) => {
      const o: LegacyPoint = { x: plus(q.x), y: plus(q.y) }
      if (q.jump) o.jump = true
      const geo = loadGeo(q.geo)
      if (geo) o.geo = geo
      if (plus(q.w) > 0) {
        o.w = plus(q.w)
        if (q.gap) o.gap = true
        if (q.pend) o.pend = true
      }
      return o
    })
  const pendGap = rec(p.pendGap)
  const strokes = Array.isArray(p.strokes) ? p.strokes.map(plus) : [0]
  return {
    pts,
    strokes,
    sg: Array.isArray(p.gaits) ? p.gaits.map(String) : [],
    gaps: Array.isArray(p.gaps) ? p.gaps.map(plus) : [],
    gt: Array.isArray(p.gapTypes) ? p.gapTypes.map((t) => (t ? String(t) : null)) : [],
    tack: [],
    pendJump: !!p.pendJump,
    pendGap:
      isRec(p.pendGap) && plus(pendGap.w) > 0
        ? { w: plus(pendGap.w), t: pendGap.t === 'pause' ? 'pause' : 'halt' }
        : null,
  }
}

const nameKey = (s: string) => s.trim().toLocaleLowerCase('de')

export interface FromPocOptions {
  /** Global gait table. */
  gaits: readonly Gait[]
  /** Explicit mapping prototype gait name → global gait id (answers to `unknownGaits`). */
  gaitMap?: Readonly<Record<string, string>>
  newId: () => string
  title: string
}

export type FromPocResult =
  { ok: true; plan: PlanContent; musicName: string } | { ok: false; unknownGaits: string[] }

/** Converts prototype JSON into a plan document. Throws PocFormatError on unusable input. */
export function fromPoc(data: unknown, o: FromPocOptions): FromPocResult {
  const d = rec(data)
  const horses = d.horses ?? d.players
  if (!Array.isArray(horses)) throw new PocFormatError('missing horses')

  const pocGaits: PocGait[] =
    Array.isArray(d.gaits) && d.gaits.length
      ? d.gaits.map((g, i) => {
          const r = rec(g)
          return { id: String(r.id || 'g' + (i + 1)), name: str(r.name) }
        })
      : DEFAULT_POC_GAITS.map(({ id, name }) => ({ id, name }))
  const pocIds = pocGaits.map((g) => g.id)
  const drawGait = pocIds.includes(str(d.drawGait))
    ? str(d.drawGait)
    : (pocGaits[Math.min(1, pocGaits.length - 1)] as PocGait).id

  const loaded = horses.map((raw) => {
    const p = rec(raw)
    const h = loadHorse(p)
    migrateLegacy(h, plus(p.delay) > 0 ? plus(p.delay) : 0)
    normalizeStrokes(h, { gaitIds: pocIds, drawGaitId: drawGait })
    return { p, h }
  })

  // match the gaits that are actually used by name; ask for the rest
  const globalByName = new Map<string, string>()
  for (const g of o.gaits)
    if (!globalByName.has(nameKey(g.name))) globalByName.set(nameKey(g.name), g.id)
  const globalIds = new Set(o.gaits.map((g) => g.id))
  const resolve = (pocId: string): string | null => {
    const name = pocGaits.find((g) => g.id === pocId)?.name ?? ''
    const mapped = o.gaitMap?.[name]
    if (mapped && globalIds.has(mapped)) return mapped
    return globalByName.get(nameKey(name)) ?? null
  }
  const used = new Set(loaded.flatMap(({ h }) => h.sg))
  const unknown = [...used]
    .filter((id) => !resolve(id))
    .map((id) => pocGaits.find((g) => g.id === id)?.name ?? id)
  if (unknown.length) return { ok: false, unknownGaits: [...new Set(unknown)] }

  const planHorses: Horse[] = loaded.map(({ p, h }, i) => {
    const path = fromStrokes({ ...h, sg: h.sg.map((id) => resolve(id) ?? '') })
    const pending: Pending | null =
      h.pendJump || h.pendGap
        ? { gap: h.pendGap?.w ?? 0, gapType: h.pendGap?.t ?? 'pause', jump: h.pendJump }
        : null
    return {
      id: o.newId(),
      number: Math.min(999, Math.max(1, Math.round(plus(p.num) || i + 1))),
      name: str(p.name).slice(0, 60),
      color: typeof p.color === 'string' && HEX.test(p.color) ? p.color : POC_HORSE_COLOR,
      tack: p.tack !== false,
      path,
      pending,
    }
  })

  const parts: Part[] = (Array.isArray(d.parts) ? d.parts : [])
    .map(rec)
    .filter((q) => finite(q.a) && finite(q.b) && plus(q.b) > plus(q.a))
    .map((q, i) => ({
      id: o.newId(),
      name: str(q.name).slice(0, 60),
      start: Math.max(0, plus(q.a)),
      end: plus(q.b),
      color:
        typeof q.c === 'string' && HEX.test(q.c)
          ? q.c
          : (PART_COLORS[i % PART_COLORS.length] as string),
    }))

  const bpm = plus(d.bpm) > 0 ? Math.min(260, Math.max(1, plus(d.bpm))) : null
  return {
    ok: true,
    musicName: str(d.musicName),
    plan: {
      title: o.title.slice(0, 200) || 'Plan',
      timing: {
        bpm,
        beat0: plus(d.beat0) >= 0 ? plus(d.beat0) : 0,
        meter: plus(d.meter) === 3 ? 3 : 4,
        musicId: null,
      },
      settings: {
        timelineZoom: Math.min(90, Math.max(6, plus(d.zoom) || 24)),
        drawGaitId: resolve(drawGait),
        roundCorners: true,
      },
      horses: planHorses,
      parts,
    },
  }
}

/**
 * Writes a plan in the prototype's format (`serialize`), so plans stay exchangeable.
 * Per-section saddle overrides have no equivalent in the prototype and are dropped.
 */
export function toPoc(plan: PlanContent, gaits: readonly Gait[]): Rec {
  const usedIds = new Set(plan.horses.flatMap((h) => h.path.sections.map((s) => s.gaitId)))
  const drawGait = plan.settings.drawGaitId ?? gaits.find((g) => !g.archivedAt)?.id ?? ''
  return {
    app: 'reitwege',
    version: 2,
    field: 'blank',
    drawGait,
    bpm: plan.timing.bpm ?? 0,
    beat0: plan.timing.beat0,
    meter: plan.timing.meter,
    zoom: plan.settings.timelineZoom,
    musicName: '',
    parts: plan.parts.map((q, i) => ({
      id: i + 1,
      name: q.name,
      a: q.start,
      b: q.end,
      c: q.color,
    })),
    gaits: gaits
      .filter((g) => !g.archivedAt || usedIds.has(g.id) || g.id === drawGait)
      .map((g) => ({
        id: g.id,
        name: g.name,
        w: g.speedTack,
        o: g.speedBare,
        md: g.turnDiameter,
        c: g.color,
      })),
    horses: plan.horses.map((h) => ({
      name: h.name,
      num: h.number,
      color: h.color,
      tack: h.tack,
      strokes: h.path.sections.map((s) => s.start),
      gaits: h.path.sections.map((s) => s.gaitId),
      gaps: h.path.sections.map((s) => s.gap),
      gapTypes: h.path.sections.map((s) => s.gapType),
      pendJump: !!h.pending?.jump,
      pendGap: h.pending && h.pending.gap > 0 ? { w: h.pending.gap, t: h.pending.gapType } : null,
      pts: h.path.pts.map((q) => {
        const p: Rec = { x: +q.x.toFixed(2), y: +q.y.toFixed(2) }
        if (q.jump) p.jump = 1
        if (q.geo) p.geo = q.geo
        return p
      }),
    })),
  }
}
