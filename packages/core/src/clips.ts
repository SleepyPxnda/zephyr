import { selectionGroups, selKey, type HorseContext } from './edit'
import { clonePoint, normalizeStrokes, sectionGeom, fromStrokes, type Strokes } from './path'
import type { GapType, Geo, Horse, Path, PathPoint, Point } from './schemas'
import { sectionTimes, timeline, type TimelineContext } from './timeline'
import { dist } from './vec'

/** Ends closer than this share their point; otherwise a connecting line is inserted (m). */
export const LINK_TOL = 0.05

/**
 * One section as a movable piece (SPEC "Umsortieren und Verbindungen"): its start position
 * (shared with the previous section or its own) followed by its points.
 */
export interface Clip {
  pts: PathPoint[]
  /** remembered figure of the section (lives on its first point in the path) */
  geo: Geo | null
  gaitId: string
  gap: number
  gapType: GapType
  tack: boolean | null
  /** starts with a jump (after a pause): never joined by a connecting line */
  jump: boolean
  link: boolean
}

/** Splits a path into its sections. */
export function toClips(path: Path): Clip[] {
  return path.sections.map((s, k) => {
    const g = sectionGeom(path, k)
    const pts = path.pts.slice(g.si, g.e + 1).map((q) => {
      const o = clonePoint(q)
      delete o.jump
      delete o.geo
      return o
    })
    const geo = path.pts[g.s0]?.geo
    return {
      pts,
      geo: geo ? (clonePoint(path.pts[g.s0] as PathPoint).geo ?? null) : null,
      gaitId: s.gaitId,
      gap: s.gap,
      gapType: s.gapType,
      tack: s.tack,
      jump: g.own && g.s0 > 0,
      link: !!s.link,
    }
  })
}

/**
 * Joins clips in the given order (SPEC "Umsortieren und Verbindungen"): old connecting lines
 * are dropped; ends within 5 cm share their point, otherwise a straight connecting line with
 * gait and saddle of the following clip is inserted, unless that clip starts with a jump.
 * `sec[i]` is the section index of clip i (-1 for dropped connecting lines).
 */
export function fromClips(clips: readonly Clip[]): { path: Path; sec: number[] } {
  const p: Strokes = { pts: [], strokes: [], sg: [], gaps: [], gt: [], tack: [], link: [] }
  const sec: number[] = []
  const pushSection = (c: Clip, link: boolean) => {
    p.strokes.push(p.pts.length)
    p.sg.push(c.gaitId)
    p.gaps.push(link ? 0 : c.gap)
    p.gt.push(link ? 'halt' : c.gapType)
    p.tack.push(c.tack)
    p.link.push(link)
  }
  for (const c of clips) {
    const first = c.pts[0]
    if (c.link || !first || c.pts.length < 2) {
      sec.push(-1)
      continue
    }
    const own = !p.pts.length || c.jump
    const end = p.pts[p.pts.length - 1]
    if (!own && end && dist(end, first) > LINK_TOL) {
      pushSection(c, true)
      p.pts.push({ x: first.x, y: first.y })
    }
    sec.push(p.strokes.length)
    pushSection(c, false)
    const add = (own ? c.pts : c.pts.slice(1)).map(clonePoint)
    const head = add[0] as PathPoint
    if (own && p.pts.length) head.jump = true
    if (c.geo) head.geo = clonePoint({ x: 0, y: 0, geo: c.geo }).geo
    p.pts.push(...add)
  }
  normalizeStrokes(p)
  return { path: fromStrokes(p), sec }
}

/** A clip placed in time: `at` = wanted start (after its gap); undefined keeps its own gap. */
interface Entry {
  clip: Clip
  at?: number
}

/**
 * Builds a path from placed clips: a clip with `at` gets the gap that lets it start there, but
 * never earlier than right after its predecessor; new gaps take the type `fill`.
 */
function assemble(entries: readonly Entry[], ctx: TimelineContext, fill: GapType): Path {
  const { path, sec } = fromClips(entries.map((e) => ({ ...e.clip, gap: 0 })))
  if (!path.sections.length) return path
  const tl = timeline(path, ctx)
  const sections = path.sections.map((s) => ({ ...s }))
  let cum = 0
  entries.forEach((e, i) => {
    const k = sec[i] as number
    const s = sections[k]
    if (k < 0 || !s) return
    const c = e.clip
    const gap = e.at === undefined ? c.gap : Math.max(0, e.at - ((tl.secs[k]?.start ?? 0) + cum))
    s.gap = gap
    s.gapType = gap > 0 && c.gap <= 0 && !c.jump ? fill : c.gapType
    cum += gap
  })
  return { ...path, sections }
}

interface Placed {
  clip: Clip
  k: number
  a: number
  b: number
}

/** The clips of a path with their times, connecting lines left out (they are rebuilt). */
function placed(path: Path, ctx: TimelineContext): Placed[] {
  if (!path.sections.length) return []
  const tl = timeline(path, ctx)
  return toClips(path)
    .map((clip, k) => ({ clip, k, ...sectionTimes(path, tl, k) }))
    .filter((q) => !q.clip.link)
}

/** Index among `others` before which something centred at `t` goes. */
const insertIndex = (others: readonly Placed[], t: number): number => {
  const i = others.findIndex((q) => (q.a + q.b) / 2 >= t)
  return i < 0 ? others.length : i
}

/** A unit of clips: the first starts at `t`, the others keep their gaps. */
const unitEntries = (unit: readonly Clip[], t: number): Entry[] =>
  unit.map((clip, i) => (i === 0 ? { clip, at: t } : { clip }))

/** Section indices of the unit in an assembled path. */
function unitKeys(horseId: string, path: Path, idx: number, n: number): string[] {
  // re-split to find the unit: it is the n non-link clips from position idx on
  const ks = path.sections.flatMap((s, k) => (s.link ? [] : [k]))
  return ks.slice(idx, idx + n).map((k) => selKey(horseId, k))
}

function insertUnit(
  path: Path,
  unit: readonly Clip[],
  t: number,
  ref: number,
  ctx: TimelineContext,
  fill: GapType,
  at?: number,
): { path: Path; idx: number } {
  const others = placed(path, ctx)
  const idx = at ?? insertIndex(others, ref)
  const entries: Entry[] = others.map((q) => ({ clip: q.clip, at: q.a }))
  entries.splice(idx, 0, ...unitEntries(unit, t))
  return { path: assemble(entries, ctx, fill), idx }
}

/**
 * Clips of a unit taken from one horse. Runs that were apart keep their distance in time with a
 * pause and a jump, as when copying.
 */
function unitClips(unit: readonly Placed[], all: readonly Placed[]): Clip[] {
  return unit.map((q, i) => {
    const prev = unit[i - 1]
    if (!prev) return q.clip
    // adjacent (only connecting lines in between) keep their own gap
    const between = all.some((o) => o.k > prev.k && o.k < q.k)
    if (!between) return q.clip
    return { ...q.clip, jump: true, gapType: 'pause', gap: Math.max(0, q.a - prev.b) }
  })
}

export interface ClipMove {
  fromId: string
  /** section indices of the moved unit (connecting lines are ignored) */
  ks: readonly number[]
  toId: string
  /** new start of the unit (s) */
  t: number
  /** Ctrl: copy instead of move */
  copy: boolean
  /** Shift: the hole at the old place stays */
  keepHole: boolean
  /** type of gaps that come up */
  fill: GapType
}

/**
 * Drops a unit of sections at time `t` in the same or another horse (SPEC "Umsortieren und
 * Verbindungen"). Without a change of order it only moves in time; otherwise it is taken out
 * (the hole closes, or stays with `keepHole`) and inserted before the first section whose
 * centre its leading edge has not passed (dragged later: its end; earlier: its start; into
 * another lane or as a copy: its centre). Following sections are only pushed. Returns the horses
 * and the keys of the dropped unit.
 */
export function moveClips(
  horses: readonly Horse[],
  m: ClipMove,
  ctx: HorseContext,
): { horses: Horse[]; keys: string[] } {
  const src = horses.find((h) => h.id === m.fromId)
  const dst = horses.find((h) => h.id === m.toId)
  const none = { horses: [...horses], keys: [] }
  if (!src || !dst) return none
  const cS: TimelineContext = { gaits: ctx.gaits, horseTack: src.tack }
  const cD: TimelineContext = { gaits: ctx.gaits, horseTack: dst.tack }
  const all = placed(src.path, cS)
  const unit = all.filter((q) => m.ks.includes(q.k))
  const first = unit[0]
  const last = unit[unit.length - 1]
  if (!first || !last) return none
  const clips = unitClips(unit, all)
  const t = Math.max(0, m.t)
  const len = last.b - first.a
  // the leading edge decides (later: the end, earlier: the start); into another lane: the centre
  const ref = src === dst && !m.copy ? (t > first.a ? t + len : t) : t + len / 2
  const others = all.filter((q) => !unit.includes(q))
  const set = (changed: Map<string, Path>, id: string, path: Path, idx: number) => {
    changed.set(id, path)
    return {
      horses: horses.map((h) =>
        changed.has(h.id) ? { ...h, path: changed.get(h.id) as Path } : h,
      ),
      keys: unitKeys(id, path, idx, clips.length),
    }
  }

  if (src === dst && !m.copy) {
    const idx = insertIndex(others, ref)
    const before = others.filter((q) => q.k < first.k).length
    if (idx === before) {
      // same place in the order: only the time changes, the others keep theirs
      const entries: Entry[] = others.map((q) => ({ clip: q.clip, at: q.a }))
      entries.splice(idx, 0, ...unitEntries(clips, t))
      return set(new Map(), src.id, assemble(entries, cS, m.fill), idx)
    }
    // the order is decided on the times before the hole closes
    const removed = removeUnit(src.path, others, m.keepHole, cS, m.fill)
    const out = insertUnit(removed, clips, t, ref, cS, m.fill, idx)
    return set(new Map(), src.id, out.path, out.idx)
  }
  const changed = new Map<string, Path>()
  if (!m.copy) changed.set(src.id, removeUnit(src.path, others, m.keepHole, cS, m.fill))
  const base = changed.get(dst.id) ?? dst.path
  const out = insertUnit(base, clips, t, ref, cD, m.fill)
  return set(changed, dst.id, out.path, out.idx)
}

/** The path without the unit: the hole closes (following keep their gaps) or stays. */
function removeUnit(
  path: Path,
  rest: readonly Placed[],
  keepHole: boolean,
  ctx: TimelineContext,
  fill: GapType,
): Path {
  if (!rest.length) return { v: 1, pts: [], sections: [] }
  const start = placed(path, ctx)[0]?.a ?? 0
  const entries: Entry[] = rest.map((q) =>
    keepHole ? { clip: q.clip, at: q.a } : { clip: q.clip },
  )
  // closing a hole at the very beginning keeps the start time of the path
  if (!keepHole && rest[0]?.k !== 0) (entries[0] as Entry).at = start
  return assemble(entries, ctx, fill)
}

/** Clips of a copied part (clipboard), with the points already moved to their place. */
export function partClips(part: Strokes, link: 'line' | 'gap'): Clip[] {
  const p: Strokes = {
    pts: part.pts,
    strokes: [...part.strokes],
    sg: [...part.sg],
    gaps: [...part.gaps],
    gt: [...part.gt],
    tack: [...part.tack],
    link: part.strokes.map(() => false),
  }
  normalizeStrokes(p)
  const clips = toClips(fromStrokes(p))
  const first = clips[0]
  if (first) {
    first.gap = 0
    first.jump = link === 'gap'
    first.gapType = link === 'gap' ? 'pause' : 'halt'
  }
  return clips
}

/**
 * Inserts clips into a horse at time `t` (Ctrl+V): after every section whose centre lies
 * before `t`, following ones only pushed. Returns the horse and the keys of the inserted clips.
 */
export function insertClips(
  horse: Horse,
  clips: readonly Clip[],
  t: number,
  fill: GapType,
  ctx: HorseContext,
): { horse: Horse; keys: string[] } {
  const c: TimelineContext = { gaits: ctx.gaits, horseTack: horse.tack }
  const out = insertUnit(horse.path, clips, Math.max(0, t), t, c, fill)
  return {
    horse: { ...horse, path: out.path },
    keys: unitKeys(horse.id, out.path, out.idx, clips.filter((q) => q.pts.length > 1).length),
  }
}

/** End point of the section that would come before something inserted at `t` (paste anchor). */
export function insertAnchor(horse: Horse, t: number, ctx: HorseContext): Point | null {
  const others = placed(horse.path, { gaits: ctx.gaits, horseTack: horse.tack })
  const prev = others[insertIndex(others, t) - 1]
  const q = prev?.clip.pts[prev.clip.pts.length - 1]
  return q ? { x: q.x, y: q.y } : null
}

/** Paste time: end of the latest selected section, without selection the playhead. */
export function pasteTime(
  horses: readonly Horse[],
  keys: Iterable<string>,
  playhead: number,
  ctx: HorseContext,
): number {
  const groups = selectionGroups(horses, keys)
  if (!groups.length) return playhead
  let t = 0
  for (const { horse, ks } of groups) {
    const tl = timeline(horse.path, { gaits: ctx.gaits, horseTack: horse.tack })
    for (const k of ks) t = Math.max(t, sectionTimes(horse.path, tl, k).b)
  }
  return t
}
