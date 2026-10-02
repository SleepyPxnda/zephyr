import type { GapType, Geo, Path, PathPoint } from './schemas'
import { dist, r2 } from './vec'

/**
 * Parallel-array view of a path, as the prototype keeps it (`strokes`, `sg`, `gaps`, `gt`).
 * The algorithms below are ported from the prototype on this view and always work on a
 * private copy, so every exported function stays pure.
 */
export interface Strokes {
  pts: PathPoint[]
  strokes: number[]
  sg: string[]
  gaps: number[]
  /** null or anything else than halt/pause only occurs in imported data; normalize decides */
  gt: (GapType | string | null)[]
  tack: (boolean | null)[]
}

const cloneGeo = (g: Geo): Geo => ({ ...g, E: { ...g.E }, ...(g.M ? { M: { ...g.M } } : {}) })
export const clonePoint = (q: PathPoint): PathPoint => {
  const o: PathPoint = { x: q.x, y: q.y }
  if (q.jump) o.jump = true
  if (q.geo) o.geo = cloneGeo(q.geo)
  return o
}

export function toStrokes(path: Path): Strokes {
  return {
    pts: path.pts.map(clonePoint),
    strokes: path.sections.map((s) => s.start),
    sg: path.sections.map((s) => s.gaitId),
    gaps: path.sections.map((s) => s.gap),
    gt: path.sections.map((s) => s.gapType),
    tack: path.sections.map((s) => s.tack),
  }
}

export function fromStrokes(s: Strokes): Path {
  return {
    v: 1,
    pts: s.pts.map(clonePoint),
    sections: s.strokes.map((start, k) => ({
      start,
      gaitId: s.sg[k] ?? '',
      gap: s.gaps[k] ?? 0,
      gapType: s.gt[k] === 'pause' ? 'pause' : 'halt',
      tack: s.tack[k] ?? null,
    })),
  }
}

export interface NormalizeOptions {
  /** Valid gait ids; unknown ids are replaced by the first one. Omit to keep ids as they are. */
  gaitIds?: readonly string[]
  /** Gait for sections that have none (imported data). */
  drawGaitId?: string
}

const at = <T>(a: readonly T[], i: number): T => a[i] as T

/** In-place normalisation of a private copy (prototype `normalize`), plus rounding to cm. */
export function normalizeStrokes(p: Strokes, opts: NormalizeOptions = {}): void {
  const fallbackGait = opts.drawGaitId ?? opts.gaitIds?.[0] ?? ''
  if (!p.pts.length) {
    p.strokes = []
    p.sg = []
    p.gaps = []
    p.gt = []
    p.tack = []
    return
  }
  p.pts.forEach((q) => {
    q.x = r2(q.x)
    q.y = r2(q.y)
  })
  if (p.pts[0]?.jump) delete at(p.pts, 0).jump
  if (!p.strokes.length || p.strokes[0] !== 0) {
    p.strokes.unshift(0)
    p.sg.unshift(p.sg[0] || fallbackGait)
    p.gaps.unshift(0)
    p.gt.unshift(null)
    p.tack.unshift(null)
  }
  while (p.gaps.length < p.strokes.length) p.gaps.push(0)
  while (p.gt.length < p.strokes.length) p.gt.push(null)
  while (p.tack.length < p.strokes.length) p.tack.push(null)
  p.gaps.length = p.strokes.length
  p.gt.length = p.strokes.length
  p.tack.length = p.strokes.length
  const removeAt = (k: number) => {
    p.strokes.splice(k, 1)
    p.sg.splice(k, 1)
    p.gaps.splice(k, 1)
    p.gt.splice(k, 1)
    p.tack.splice(k, 1)
  }
  // The prototype runs this pass once, which can leave e.g. [0, 2, 1] behind for corrupt input.
  // Repeating it until nothing changes keeps the prototype's result whenever that one is valid.
  for (let removed = true; removed;) {
    removed = false
    for (let k = p.strokes.length - 1; k >= 1; k--) {
      if (at(p.strokes, k) >= p.pts.length || at(p.strokes, k) <= at(p.strokes, k - 1)) {
        removeAt(k)
        removed = true
      }
    }
  }
  // a section that only holds its start point (first point or a jump target) has no movement:
  // fold it into the next one
  for (let k = p.strokes.length - 2; k >= 0; k--) {
    const s0 = at(p.strokes, k)
    if (at(p.strokes, k + 1) === s0 + 1 && (k === 0 ? s0 === 0 : !!p.pts[s0]?.jump)) {
      p.strokes.splice(k + 1, 1)
      p.sg.splice(k, 1)
      p.tack.splice(k, 1)
      const g = p.gaps.splice(k + 1, 1)[0] || 0
      p.gaps[k] = (p.gaps[k] || 0) + g
      const t2 = p.gt.splice(k + 1, 1)[0] ?? null
      if (!p.gt[k]) p.gt[k] = t2
    }
  }
  while (p.sg.length < p.strokes.length) p.sg.push(fallbackGait)
  p.sg.length = p.strokes.length
  const ids = opts.gaitIds
  if (ids?.length) p.sg = p.sg.map((id) => (ids.includes(id) ? id : at(ids, 0)))
  p.gaps = p.gaps.map((g) => Math.max(0, +g || 0))
  p.gt = p.gt.map((t, k) =>
    t === 'halt' || t === 'pause' ? t : k > 0 && p.pts[at(p.strokes, k)]?.jump ? 'pause' : 'halt',
  )
}

/** Brings a path into canonical form (SPEC "Weg-Struktur"). Pure and idempotent. */
export function normalize(path: Path, opts: NormalizeOptions = {}): Path {
  const s = toStrokes(path)
  normalizeStrokes(s, opts)
  return fromStrokes(s)
}

/** Index of the section the incoming segment of point i belongs to. */
export function sectionOf(path: { sections: readonly { start: number }[] }, i: number): number {
  let k = 0
  for (let j = 1; j < path.sections.length; j++) {
    if (at(path.sections, j).start <= i) k = j
    else break
  }
  return k
}

/** First and last point index of section k. */
export function sectionRange(path: Path, k: number): { s: number; e: number } {
  const next = path.sections[k + 1]
  return { s: at(path.sections, k).start, e: (next ? next.start : path.pts.length) - 1 }
}

export interface SectionGeom {
  /** first point of the section */
  s0: number
  /** last point of the section */
  e: number
  /** the section starts on its own point (first point or after a jump) */
  own: boolean
  /** index of the start position S */
  si: number
  geo: Geo | null
}

export function sectionGeom(path: Path, k: number): SectionGeom {
  const { s: s0, e } = sectionRange(path, k)
  const first = at(path.pts, s0)
  const own = s0 === 0 || !!first.jump
  return { s0, e, own, si: own ? s0 : s0 - 1, geo: first.geo ?? null }
}

/**
 * Splits the section under point `f` (0..1) of segment `i-1 → i` (prototype `splitAt`).
 * Clicks closer than `snapDist` metres to an existing point split there. Returns the new
 * section index, or null when no split is possible.
 */
export function splitAt(
  path: Path,
  i: number,
  f: number,
  snapDist: number,
): { path: Path; k: number } | null {
  const p = toStrokes(path)
  const a = at(p.pts, i - 1)
  const b0 = at(p.pts, i)
  const seg = dist(a, b0)
  let b = f * seg < snapDist ? i - 1 : (1 - f) * seg < snapDist ? i : null
  if (b === null) {
    p.pts.splice(i, 0, { x: r2(a.x + (b0.x - a.x) * f), y: r2(a.y + (b0.y - a.y) * f) })
    for (let k = 0; k < p.strokes.length; k++)
      if (at(p.strokes, k) > i) p.strokes[k] = at(p.strokes, k) + 1
    b = i
  }
  const start = b + 1
  if (b < 1 || start >= p.pts.length || p.strokes.includes(start)) return null
  const k = sectionOf({ sections: p.strokes.map((s) => ({ start: s })) }, b)
  delete at(p.pts, at(p.strokes, k)).geo
  p.strokes.splice(k + 1, 0, start)
  p.sg.splice(k + 1, 0, at(p.sg, k))
  p.gaps.splice(k + 1, 0, 0)
  p.gt.splice(k + 1, 0, 'halt')
  p.tack.splice(k + 1, 0, at(p.tack, k))
  return { path: fromStrokes(p), k: k + 1 }
}

/** Merges adjacent sections `ks` into the first of them (prototype `mergeSel`). */
export function mergeSections(
  path: Path,
  ks: readonly number[],
  opts: NormalizeOptions = {},
): Path | null {
  const sorted = [...ks].sort((x, y) => x - y)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (
    first === undefined ||
    last === undefined ||
    sorted.length < 2 ||
    last - first + 1 !== sorted.length
  )
    return null
  const p = toStrokes(path)
  for (let j = last; j > first; j--) {
    delete at(p.pts, at(p.strokes, j)).geo
    p.strokes.splice(j, 1)
    p.sg.splice(j, 1)
    p.gaps.splice(j, 1)
    p.gt.splice(j, 1)
    p.tack.splice(j, 1)
  }
  delete at(p.pts, at(p.strokes, first)).geo
  normalizeStrokes(p, opts)
  return fromStrokes(p)
}
