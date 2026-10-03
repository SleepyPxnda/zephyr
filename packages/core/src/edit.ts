import { figure } from './geometry'
import { arc3Points } from './geometry'
import {
  fromStrokes,
  mergeSections,
  normalize,
  normalizeStrokes,
  sectionGeom,
  sectionRange,
  toStrokes,
  type SectionGeom,
} from './path'
import type { Arena, Gait, Horse, Path, PathPoint, Point } from './schemas'
import { gaitOf, headingAt, timeline, type TimelineContext } from './timeline'
import { dist, r2 } from './vec'

// ---------- selection ----------

/** Selection entries are `horseId:sectionIndex` (SPEC "Zustand"). */
export const selKey = (horseId: string, k: number): string => `${horseId}:${k}`

export function parseSelKey(key: string): { horseId: string; k: number } {
  const at = key.lastIndexOf(':')
  return { horseId: key.slice(0, at), k: Number(key.slice(at + 1)) }
}

export interface SelGroup {
  horse: Horse
  /** valid section indices, ascending */
  ks: number[]
}

/** Selected sections grouped by horse, in the order the horses were first selected. */
export function selectionGroups(horses: readonly Horse[], keys: Iterable<string>): SelGroup[] {
  const out: SelGroup[] = []
  for (const key of keys) {
    const { horseId, k } = parseSelKey(key)
    const horse = horses.find((h) => h.id === horseId)
    if (!horse || !Number.isInteger(k) || horse.path.sections[k] === undefined) continue
    let g = out.find((q) => q.horse === horse)
    if (!g) out.push((g = { horse, ks: [] }))
    if (!g.ks.includes(k)) g.ks.push(k)
  }
  out.forEach((g) => g.ks.sort((a, b) => a - b))
  return out
}

/** Keys for every section of the given horses ("Ganzer Weg"). */
export const wholePathKeys = (horses: readonly Horse[]): string[] =>
  horses.flatMap((h) => h.path.sections.map((_, k) => selKey(h.id, k)))

// ---------- point transforms ----------

export type PointFn = (q: Point) => Point

export const rotFn = (P0: Point, a: number): PointFn => {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return (q) => ({
    x: P0.x + (q.x - P0.x) * c - (q.y - P0.y) * s,
    y: P0.y + (q.x - P0.x) * s + (q.y - P0.y) * c,
  })
}

/** Reflection at the line through P0 with unit direction u. */
export const mirFn =
  (P0: Point, u: Point): PointFn =>
  (q) => {
    const vx = q.x - P0.x
    const vy = q.y - P0.y
    const d = vx * u.x + vy * u.y
    return { x: P0.x + 2 * d * u.x - vx, y: P0.y + 2 * d * u.y - vy }
  }

/** Applies fn to points [from, to] of a private point list, including remembered figure points. */
function transformPts(pts: PathPoint[], from: number, to: number, fn: PointFn): void {
  for (let i = from; i <= to && i < pts.length; i++) {
    const q = pts[i] as PathPoint
    const r = fn(q)
    q.x = r.x
    q.y = r.y
    if (q.geo) {
      q.geo.E = fn(q.geo.E)
      if (q.geo.M) q.geo.M = fn(q.geo.M)
    }
  }
}

// ---------- group edits ----------

export interface Affected {
  horse: Horse
  ks: number[]
  g0: SectionGeom
  /** point ranges [from, to] the edit touches */
  ranges: [number, number][]
}

/**
 * Points a group edit touches: the selected sections, or with "Folgende hängen dran" everything
 * from the first selected section on (prototype `affected`).
 */
export function affected(groups: readonly SelGroup[], follow: boolean): Affected[] {
  return groups.map(({ horse, ks }) => {
    const p = horse.path
    const g0 = sectionGeom(p, ks[0] as number)
    const ranges: [number, number][] = follow
      ? [[g0.s0, p.pts.length - 1]]
      : ks.map((k) => {
          const g = sectionGeom(p, k)
          return [g.s0, g.e]
        })
    return { horse, ks, g0, ranges }
  })
}

/** Pivot: start of the first selected section (one horse) or centre of the bounding box. */
export function groupPivot(aff: readonly Affected[]): Point {
  const only = aff.length === 1 ? aff[0] : undefined
  if (only) {
    const q = only.horse.path.pts[only.g0.si] as PathPoint
    return { x: q.x, y: q.y }
  }
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  aff.forEach((a) =>
    a.ranges.forEach(([f, t]) => {
      for (let i = f; i <= t; i++) {
        const q = a.horse.path.pts[i] as PathPoint
        x0 = Math.min(x0, q.x)
        y0 = Math.min(y0, q.y)
        x1 = Math.max(x1, q.x)
        y1 = Math.max(y1, q.y)
      }
    }),
  )
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }
}

/** Replaces the horses in `changed` (by id) and keeps all others unchanged. */
const replace = (horses: readonly Horse[], changed: ReadonlyMap<string, Path>): Horse[] =>
  horses.map((h) => {
    const path = changed.get(h.id)
    return path ? { ...h, path } : h
  })

function applyToAffected(
  horses: readonly Horse[],
  aff: readonly Affected[],
  edit: (pts: PathPoint[], a: Affected) => void,
): Horse[] {
  const changed = new Map<string, Path>()
  for (const a of aff) {
    const s = toStrokes(a.horse.path)
    edit(s.pts, a)
    a.ks.forEach((k) => (s.link[k] = false))
    changed.set(a.horse.id, normalize(fromStrokes(s)))
  }
  return replace(horses, changed)
}

/** Rotate the selection by `angle` (rad) around the group pivot (buttons ±15°, ⟳ handle). */
export function rotateSelection(
  horses: readonly Horse[],
  keys: Iterable<string>,
  angle: number,
  follow: boolean,
): Horse[] {
  const groups = selectionGroups(horses, keys)
  if (!groups.length) return [...horses]
  const fn = rotFn(groupPivot(affected(groups, false)), angle)
  return applyToAffected(horses, affected(groups, follow), (pts, a) =>
    a.ranges.forEach(([f, t]) => transformPts(pts, f, t, fn)),
  )
}

/** Move the selection by (dx, dy) metres (dragging on the arena). */
export function moveSelection(
  horses: readonly Horse[],
  keys: Iterable<string>,
  dx: number,
  dy: number,
  follow: boolean,
): Horse[] {
  const fn: PointFn = (q) => ({ x: q.x + dx, y: q.y + dy })
  return applyToAffected(horses, affected(selectionGroups(horses, keys), follow), (pts, a) =>
    a.ranges.forEach(([f, t]) => transformPts(pts, f, t, fn)),
  )
}

export type MirrorMode = 'hand' | 'ac' | 'eb'

const flipHands = (pts: PathPoint[], f: number, t: number) => {
  for (let i = f; i <= t; i++) {
    const m = pts[i]?.geo
    if (m && m.hand !== 'auto') m.hand = m.hand === 'left' ? 'right' : 'left'
  }
}

/** Mirror axis through the start of section k in the direction it sets off (> 0.8 m away). */
function ownAxis(path: Path, k: number): PointFn | null {
  const g = sectionGeom(path, k)
  const P0 = { ...(path.pts[g.si] as PathPoint) }
  for (let i = g.si + 1; i <= g.e; i++) {
    const q = path.pts[i] as PathPoint
    if (dist(P0, q) > 0.8) {
      const l = dist(P0, q)
      return mirFn(P0, { x: (q.x - P0.x) / l, y: (q.y - P0.y) / l })
    }
  }
  return null
}

/**
 * Mirror the selection (prototype `mirrorSel`): "hand" flips each run of adjacent sections at
 * its own start direction; "ac" at the long axis (y = width / 2), "eb" at the cross axis
 * (x = length / 2). Remembered hands left/right are swapped.
 */
export function mirrorSelection(
  horses: readonly Horse[],
  keys: Iterable<string>,
  mode: MirrorMode,
  follow: boolean,
  arena: Pick<Arena, 'lengthM' | 'widthM'>,
): Horse[] {
  const aff = affected(selectionGroups(horses, keys), follow)
  return applyToAffected(horses, aff, (pts, x) => {
    if (mode === 'ac' || mode === 'eb') {
      const fn =
        mode === 'ac'
          ? mirFn({ x: 0, y: arena.widthM / 2 }, { x: 1, y: 0 })
          : mirFn({ x: arena.lengthM / 2, y: 0 }, { x: 0, y: 1 })
      x.ranges.forEach(([f, t]) => {
        transformPts(pts, f, t, fn)
        flipHands(pts, f, t)
      })
      return
    }
    if (follow) {
      const fn = ownAxis(x.horse.path, x.ks[0] as number)
      if (!fn) return
      x.ranges.forEach(([f, t]) => {
        transformPts(pts, f, t, fn)
        flipHands(pts, f, t)
      })
      return
    }
    // without "follow": every run of adjacent selected sections flips around its own start direction
    const runs: number[][] = []
    x.ks.forEach((k) => {
      const r = runs[runs.length - 1]
      if (r && r[r.length - 1] === k - 1) r.push(k)
      else runs.push([k])
    })
    // axes come from the untouched path, as runs do not overlap
    runs.forEach((run) => {
      const fn = ownAxis(x.horse.path, run[0] as number)
      if (!fn) return
      const f = sectionGeom(x.horse.path, run[0] as number).s0
      const t = sectionGeom(x.horse.path, run[run.length - 1] as number).e
      transformPts(pts, f, t, fn)
      flipHands(pts, f, t)
    })
  })
}

/**
 * Removes section k; the following sections keep their place in time (prototype
 * `deleteSection`): their gap grows by gap and duration of the removed one, their first point
 * becomes a jump and the gap a pause.
 */
export function deleteSection(path: Path, k: number, ctx: TimelineContext): Path {
  const tl = timeline(path, ctx)
  const p = toStrokes(path)
  const { s: s0, e } = sectionRange(path, k)
  const n = e - s0 + 1
  const sec = tl.secs[k]
  const gk = p.gaps[k] || 0
  p.pts.splice(s0, n)
  p.strokes.splice(k, 1)
  p.sg.splice(k, 1)
  p.gaps.splice(k, 1)
  p.gt.splice(k, 1)
  p.tack.splice(k, 1)
  p.link.splice(k, 1)
  for (let j = k; j < p.strokes.length; j++) p.strokes[j] = (p.strokes[j] as number) - n
  if (k < p.strokes.length) {
    const st = p.strokes[k] as number
    if (st > 0) {
      ;(p.pts[st] as PathPoint).jump = true
      p.gt[k] = 'pause'
    }
    p.gaps[k] = gk + (sec?.time ?? 0) + (p.gaps[k] || 0)
  }
  normalizeStrokes(p)
  return fromStrokes(p)
}

export interface HorseContext {
  gaits: readonly Gait[]
}

/** Deletes every selected section (highest index first per horse). */
export function deleteSelection(
  horses: readonly Horse[],
  keys: Iterable<string>,
  ctx: HorseContext,
): Horse[] {
  const changed = new Map<string, Path>()
  for (const { horse, ks } of selectionGroups(horses, keys)) {
    let path = horse.path
    for (const k of [...ks].reverse())
      path = deleteSection(path, k, { gaits: ctx.gaits, horseTack: horse.tack })
    changed.set(horse.id, path)
  }
  return replace(horses, changed)
}

/** Merges adjacent selected sections of a single horse; anything else leaves the horses as they are. */
export function mergeSelection(horses: readonly Horse[], keys: Iterable<string>): Horse[] {
  const groups = selectionGroups(horses, keys)
  const only = groups.length === 1 ? groups[0] : undefined
  const merged = only && mergeSections(only.horse.path, only.ks)
  return only && merged ? replace(horses, new Map([[only.horse.id, merged]])) : [...horses]
}

/** "Zusammenführen" is possible for at least two adjacent sections of one horse. */
export function canMerge(groups: readonly SelGroup[]): boolean {
  const ks = groups.length === 1 ? (groups[0]?.ks ?? []) : []
  return ks.length >= 2 && (ks[ks.length - 1] as number) - (ks[0] as number) + 1 === ks.length
}

// ---------- shape handles (exactly one section selected) ----------

export type HandleKind = 'end' | 'start' | 'apex'
export interface Handle extends Point {
  kind: HandleKind
}

/** Point half way along the section (by distance), used as the apex handle. */
export function midPoint(path: Path, g: SectionGeom): Point {
  const P = (i: number) => path.pts[i] as PathPoint
  let total = 0
  for (let i = g.si + 1; i <= g.e; i++) total += dist(P(i - 1), P(i))
  let acc = 0
  for (let i = g.si + 1; i <= g.e; i++) {
    const seg = dist(P(i - 1), P(i))
    if (acc + seg >= total / 2 && seg > 0) {
      const f = (total / 2 - acc) / seg
      const a = P(i - 1)
      const b = P(i)
      return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
    }
    acc += seg
  }
  return { x: P(g.e).x, y: P(g.e).y }
}

/** End (circle), start after a pause (square) and apex (diamond) handles of section k. */
export function editHandles(path: Path, k: number): Handle[] {
  const g = sectionGeom(path, k)
  const out: Handle[] = []
  const endPt = g.geo ? g.geo.E : (path.pts[g.e] as PathPoint)
  out.push({ kind: 'end', x: endPt.x, y: endPt.y })
  const first = path.pts[g.s0] as PathPoint
  if (g.own && !g.geo) out.push({ kind: 'start', x: first.x, y: first.y })
  if (!(g.geo && g.geo.kind === 'circle') && g.e - g.si >= 1) {
    const m = g.geo && g.geo.kind === 'arc3' && g.geo.M ? g.geo.M : midPoint(path, g)
    out.push({ kind: 'apex', x: m.x, y: m.y })
  }
  return out
}

/** Position of the ⟳ rotate handle: beside the far end of the selection, `offset` metres out. */
export function rotateHandle(
  groups: readonly SelGroup[],
  offset: number,
): { x: number; y: number; pivot: Point } | null {
  const aff = affected(groups, false)
  if (!aff.length) return null
  const P0 = groupPivot(aff)
  let far = 0
  let cx = 0
  let cy = 0
  let n = 0
  aff.forEach((a) =>
    a.ranges.forEach(([f, t]) => {
      for (let i = f; i <= t; i++) {
        const q = a.horse.path.pts[i] as PathPoint
        far = Math.max(far, dist(P0, q))
        cx += q.x
        cy += q.y
        n++
      }
    }),
  )
  if (!n) return null
  cx /= n
  cy /= n
  let ux = cx - P0.x
  let uy = cy - P0.y
  let l = Math.hypot(ux, uy)
  if (l < 0.3) {
    ux = 0
    uy = -1
    l = 1
  }
  ux /= l
  uy /= l
  let nx = -uy
  let ny = ux
  if (ny > 0) {
    nx = -nx
    ny = -ny
  }
  return { x: P0.x + ux * far + nx * offset, y: P0.y + uy * far + ny * offset, pivot: P0 }
}

/** Shifts points from `from` to the end by (dx, dy) ("Folgende hängen dran"). */
const shiftAfter = (pts: PathPoint[], from: number, dx: number, dy: number) =>
  transformPts(pts, from, pts.length - 1, (q) => ({ x: q.x + dx, y: q.y + dy }))

/** Replaces the points after the start S of section k by `fresh` and fixes the following starts. */
function spliceSection(
  p: ReturnType<typeof toStrokes>,
  k: number,
  g: SectionGeom,
  fresh: Point[],
): number {
  const oldCount = g.e - g.si
  const diff = fresh.length - oldCount
  p.pts.splice(g.si + 1, oldCount, ...fresh.map((q) => ({ x: r2(q.x), y: r2(q.y) })))
  for (let j = k + 1; j < p.strokes.length; j++) p.strokes[j] = (p.strokes[j] as number) + diff
  return diff
}

/**
 * Drag the end of section k to E (prototype `applyEdit` mode "end"): remembered figures are
 * rebuilt (`regenerate`), freehand follows weighted by distance along the section.
 */
export function dragEnd(
  path: Path,
  k: number,
  E: Point,
  follow: boolean,
  ctx: HorseContext & { snapDiameter?: boolean },
): Path | null {
  const g = sectionGeom(path, k)
  const p = toStrokes(path)
  p.link[k] = false
  const oldEnd = { ...(p.pts[g.e] as PathPoint) }
  let endIdx = g.e
  const m = g.geo
  if (m) {
    const S = p.pts[g.si] as PathPoint
    const hd = g.own ? null : g.si > 0 ? headingAt(path.pts, g.si) : null
    const gait = gaitOf(ctx.gaits, path.sections[k]?.gaitId ?? '')
    const res =
      m.kind === 'arc3' && m.M
        ? arc3Points({ x: S.x, y: S.y }, m.M, E)
        : figure(m.kind === 'arc3' ? 'line' : m.kind, { x: S.x, y: S.y }, hd, E, {
            turnDiameter: gait.turnDiameter,
            roundCorners: m.round !== false,
            hand: m.hand,
            half: m.half,
            shift: false,
            snapDiameter: ctx.snapDiameter,
          })
    if (!res.pts.length) return null
    const diff = spliceSection(p, k, g, res.pts)
    const first = p.pts[p.strokes[k] as number] as PathPoint
    first.geo = { ...m, E: { x: r2(E.x), y: r2(E.y) }, ...(m.M ? { M: { ...m.M } } : {}) }
    if (g.own && g.s0 > 0) first.jump = true
    endIdx = g.e + diff
  } else {
    // rubber band: the end moves fully, the start stays, points in between follow by distance
    const ddx = E.x - oldEnd.x
    const ddy = E.y - oldEnd.y
    const { total, cum } = cumulative(p.pts, g.si, g.e)
    for (let i = g.si + 1; i <= g.e; i++) {
      const w = total > 0 ? (cum[i - g.si] as number) / total : 1
      const q = p.pts[i] as PathPoint
      q.x += ddx * w
      q.y += ddy * w
    }
  }
  if (follow) {
    const ne = p.pts[endIdx] as PathPoint
    shiftAfter(p.pts, endIdx + 1, ne.x - oldEnd.x, ne.y - oldEnd.y)
  }
  return normalize(fromStrokes(p))
}

function cumulative(
  pts: readonly PathPoint[],
  from: number,
  to: number,
): { total: number; cum: number[] } {
  let total = 0
  const cum = [0]
  for (let i = from + 1; i <= to; i++) {
    total += dist(pts[i - 1] as PathPoint, pts[i] as PathPoint)
    cum.push(total)
  }
  return { total, cum }
}

/**
 * Drag the apex of section k to M (prototype mode "apex"): lines and arcs become an arc through
 * start, apex and end (`arc3`); freehand bends with a sine weight, strongest in the middle.
 * `h0` is where the apex handle was when the drag started.
 */
export function dragApex(path: Path, k: number, h0: Point, M: Point): Path {
  const g = sectionGeom(path, k)
  const p = toStrokes(path)
  p.link[k] = false
  if (g.geo) {
    const end = p.pts[g.e] as PathPoint
    const E = { x: end.x, y: end.y }
    const S = p.pts[g.si] as PathPoint
    const res = arc3Points({ x: S.x, y: S.y }, M, E)
    spliceSection(p, k, g, res.pts)
    const first = p.pts[p.strokes[k] as number] as PathPoint
    first.geo = {
      kind: 'arc3',
      E,
      M: { x: r2(M.x), y: r2(M.y) },
      hand: 'auto',
      half: false,
      round: true,
    }
    if (g.own && g.s0 > 0) first.jump = true
  } else {
    const dx = M.x - h0.x
    const dy = M.y - h0.y
    const { total, cum } = cumulative(p.pts, g.si, g.e)
    for (let i = g.si + 1; i < g.e; i++) {
      const w = total > 0 ? Math.sin((Math.PI * (cum[i - g.si] as number)) / total) : 0
      const q = p.pts[i] as PathPoint
      q.x += dx * w
      q.y += dy * w
    }
  }
  return normalize(fromStrokes(p))
}

/** Drag the start of a section that begins on its own point (after a pause) by (dx, dy). */
export function dragStart(path: Path, k: number, dx: number, dy: number): Path {
  const g = sectionGeom(path, k)
  const p = toStrokes(path)
  p.link[k] = false
  const { total, cum } = cumulative(p.pts, g.s0, g.e)
  for (let i = g.s0; i <= g.e; i++) {
    const w = total > 0 ? 1 - (cum[i - g.s0] as number) / total : 1
    const q = p.pts[i] as PathPoint
    q.x += dx * w
    q.y += dy * w
  }
  return normalize(fromStrokes(p))
}
