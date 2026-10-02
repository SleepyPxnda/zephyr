import type { Gait, Path, PathPoint, Pending, Section } from './schemas'
import { sectionOf, sectionRange } from './path'
import { curveRadii, isTooTight } from './turning'
import { dist } from './vec'

export interface TimelineContext {
  /** Global gait table (archived gaits included); the first one is the fallback. */
  gaits: readonly Gait[]
  /** Default saddle of the horse. */
  horseTack: boolean
}

export interface SectionTiming {
  /** ridden distance (m), jumps excluded */
  dist: number
  /** riding time (s) without the gap */
  time: number
  /** time the section starts moving (after its gap) */
  start: number
  /** smallest curvature radius on the section (m) */
  minR: number
  /** metres that are tighter than the gait's turning circle */
  tight: number
}

export interface Timeline {
  /** arrival time at each point */
  ts: number[]
  /** departure time towards each point (start of its segment, after a gap) */
  t0s: number[]
  /** end of the last section */
  total: number
  dist: number
  secs: SectionTiming[]
  /** speed on the incoming segment of each point */
  vs: number[]
  /** the incoming segment of each point is tighter than the turning circle */
  tight: boolean[]
}

export const effectiveTack = (section: Pick<Section, 'tack'>, horseTack: boolean): boolean =>
  section.tack ?? horseTack

export function gaitOf(gaits: readonly Gait[], id: string): Gait {
  const g = gaits.find((q) => q.id === id) ?? gaits[0]
  if (!g) throw new Error('no gaits defined')
  return g
}

/** Speed of a gait with or without saddle; never below 0.1 m/s. */
export const speedOf = (gait: Gait, tack: boolean): number =>
  Math.max(0.1, tack ? gait.speedTack : gait.speedBare)

/**
 * Time model (SPEC "Zeitmodell", prototype `timeline`): start at gap[0]; at the first point of
 * section k the gap is added, then each segment takes length / v(gait, saddle). Jumps take no
 * time and no distance. There is no slowing down in curves.
 */
export function timeline(path: Path, ctx: TimelineContext): Timeline {
  const pts = path.pts
  const n = pts.length
  if (!ctx.gaits.length) throw new Error('no gaits defined')
  const ts: number[] = []
  const t0s: number[] = []
  const secs: SectionTiming[] = path.sections.map(() => ({ dist: 0, time: 0, start: 0, minR: Infinity, tight: 0 }))
  const R = curveRadii(pts)
  const vs = new Array<number>(n).fill(0)
  const tight = new Array<boolean>(n).fill(false)
  let t = 0
  let d = 0
  let k = 0
  for (let i = 0; i < n; i++) {
    while (k + 1 < path.sections.length && (path.sections[k + 1] as Section).start <= i) k++
    const section = path.sections[k] as Section
    const sec = secs[k] as SectionTiming
    if (i === 0) {
      t = path.sections[0]?.gap || 0
      ts.push(t)
      t0s.push(t)
      if (secs[0]) secs[0].start = t
      continue
    }
    let tStart = t
    if (section.start === i) {
      tStart = t + (section.gap || 0)
      sec.start = tStart
    }
    const p = pts[i] as PathPoint
    const jump = !!p.jump
    const seg = jump ? 0 : dist(pts[i - 1] as PathPoint, p)
    d += seg
    let dt = 0
    if (!jump) {
      const gait = gaitOf(ctx.gaits, section.gaitId)
      const v = speedOf(gait, effectiveTack(section, ctx.horseTack))
      const r = Math.min(R[i - 1] as number, R[i] as number)
      dt = seg / v
      vs[i] = v
      if (Number.isFinite(r) && seg > 0) sec.minR = Math.min(sec.minR, r)
      if (isTooTight(r, gait.turnDiameter || 0)) {
        tight[i] = true
        sec.tight += seg
      }
    }
    t = tStart + dt
    sec.dist += seg
    sec.time += dt
    ts.push(t)
    t0s.push(tStart)
  }
  return { ts, t0s, total: t, dist: d, secs, vs, tight }
}

/** Start (after the gap) and end time of section k. */
export function sectionTimes(path: Path, tl: Timeline, k: number): { a: number; b: number } {
  const { e } = sectionRange(path, k)
  return { a: tl.secs[k]?.start ?? 0, b: tl.ts[e] ?? 0 }
}

export type PositionState = 'waiting' | 'moving' | 'halt' | 'pause' | 'done'

export interface Position {
  x: number
  y: number
  /** point index the position belongs to */
  i: number
  state: PositionState
  /** the horse is not shown (pause, or finished with a pause announced) */
  hidden: boolean
}

/**
 * Position at time t (prototype `posAt`): before the start at the first point ("wartet");
 * in a halt at the end of the previous section (visible); in a pause hidden; otherwise
 * linear between two points.
 */
export function posAt(path: Path, tl: Timeline, t: number, pending: Pending | null): Position | null {
  const pts = path.pts
  const first = pts[0]
  if (!first) return null
  if (t < (tl.ts[0] as number)) return { x: first.x, y: first.y, i: 0, state: 'waiting', hidden: false }
  if (pts.length === 1) return { x: first.x, y: first.y, i: 0, state: 'done', hidden: false }
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as PathPoint
    if (t < (tl.t0s[i] as number)) {
      const gapType = path.sections[sectionOf(path, i)]?.gapType ?? 'halt'
      return gapType === 'pause'
        ? { x: a.x, y: a.y, i: i - 1, state: 'pause', hidden: true }
        : { x: a.x, y: a.y, i: Math.max(0, i - 1), state: 'halt', hidden: false }
    }
    const ti = tl.ts[i] as number
    if (t <= ti) {
      const t0 = tl.t0s[i] as number
      const span = ti - t0
      const f = span > 0 ? (t - t0) / span : 1
      const b = pts[i] as PathPoint
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, i, state: 'moving', hidden: false }
    }
  }
  const last = pts[pts.length - 1] as PathPoint
  return { x: last.x, y: last.y, i: pts.length - 1, state: 'done', hidden: !!pending?.jump }
}

/** Direction of travel arriving at point i (rad), or null right after a jump / at the start. */
export function headingAt(pts: readonly PathPoint[], i: number): number | null {
  for (let k = i; k >= 1; k--) {
    const a = pts[k - 1] as PathPoint
    const b = pts[k] as PathPoint
    if (b.jump) return null
    if (dist(a, b) > 0.05) return Math.atan2(b.y - a.y, b.x - a.x)
  }
  return null
}
