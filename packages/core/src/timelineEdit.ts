import type { Horse, Part, Path } from './schemas'
import { sectionTimes, type Timeline } from './timeline'
import { beatLength, snapTime, type SnapOptions } from './timing'

/** Part colours of the prototype (`PART_COLORS`). */
export const PART_COLORS = ['#7c6fd6', '#d9822b', '#2f9e8f', '#c2477a', '#5a8fd8', '#a38b2e']

/** Shortest part (s), as in the prototype. */
export const PART_MIN = 0.2

// ---------- layout ----------

/** Time the timeline shows: plan end, music and parts, at least 20 s, plus 6 s (prototype). */
export function timelineSpan(planEnd: number, musicEnd: number, parts: readonly Part[]): number {
  const partsEnd = parts.reduce((m, p) => Math.max(m, p.end), 0)
  return Math.max(planEnd, musicEnd, partsEnd, 20) + 6
}

/** End of everything that can be played: paths, music, parts. */
export function playEnd(planEnd: number, musicEnd: number, parts: readonly Part[]): number {
  return Math.max(
    planEnd,
    musicEnd,
    parts.reduce((m, p) => Math.max(m, p.end), 0),
  )
}

export interface RulerTick {
  /** time (s) */
  t: number
  /** long tick (bar or full step) */
  major: boolean
  /** label at the tick: bar number, or seconds without BPM */
  label: number | null
}

/**
 * Ticks of the time ruler (prototype `drawRuler`): with BPM bars from the first beat, labelled
 * every n bars so labels are ≥ 36 px apart, plus beat ticks; without BPM seconds in steps of
 * 1, 2, 5, 10, 15, 30 or 60 s (≥ 44 px apart) plus one tick per second.
 */
export function rulerTicks(
  span: number,
  pps: number,
  timing: { bpm: number | null; beat0: number; meter: number },
): RulerTick[] {
  const ticks: RulerTick[] = []
  const b = beatLength(timing.bpm)
  if (b) {
    const bar = b * timing.meter
    const every = Math.max(1, Math.ceil(36 / (bar * pps)))
    for (let n = 0, t = timing.beat0; t <= span; t += bar, n++)
      ticks.push({ t, major: true, label: n % every === 0 ? n + 1 : null })
    // beat ticks are skipped when they get denser than 3 px
    if (b * pps >= 3)
      for (let i = 0, t = timing.beat0; t <= span; t = timing.beat0 + ++i * b)
        if (i % timing.meter) ticks.push({ t, major: false, label: null })
    return ticks
  }
  const step = [1, 2, 5, 10, 15, 30, 60].find((s) => s * pps >= 44) ?? 60
  for (let t = 0; t <= span; t += step) ticks.push({ t, major: true, label: t })
  if (pps >= 3)
    for (let t = 1; t <= span; t++) if (t % step) ticks.push({ t, major: false, label: null })
  return ticks
}

/** One block of a horse lane: the gap before section k (if any) and the section itself. */
export interface LaneBlock {
  k: number
  /** start and end of the riding time */
  a: number
  b: number
  /** gap before the section; for k = 0 the wait before the start */
  gap: { a: number; b: number } | null
}

/** Blocks of a horse lane (prototype `renderBlocks`); gaps below 0.04 s are not shown. */
export function laneBlocks(path: Path, tl: Timeline): LaneBlock[] {
  return path.sections.map((s, k) => {
    const { a, b } = sectionTimes(path, tl, k)
    return { k, a, b, gap: s.gap > 0.04 ? { a: a - s.gap, b: a } : null }
  })
}

// ---------- magnet (SPEC "Zeitliches Verschieben") ----------

export type AnchorKind = 'start' | 'end' | 'gapStart' | 'partStart' | 'partEnd' | 'playhead'

export interface Anchor {
  t: number
  kind: AnchorKind
  /** horse or part the edge belongs to; null for the playhead */
  ownerId: string | null
  /** section index for horse edges */
  k: number | null
}

/**
 * Snap targets: start and end of every section of the other horses, the start of their gaps,
 * part edges and the playhead. `exclude` leaves out the horse or part being dragged.
 */
export function timelineAnchors(
  horses: readonly { horse: Horse; tl: Timeline }[],
  parts: readonly Part[],
  playhead: number | null,
  exclude: { horseId?: string; partId?: string },
): Anchor[] {
  const out: Anchor[] = []
  for (const { horse, tl } of horses) {
    if (horse.id === exclude.horseId) continue
    for (const blk of laneBlocks(horse.path, tl)) {
      out.push({ t: blk.a, kind: 'start', ownerId: horse.id, k: blk.k })
      out.push({ t: blk.b, kind: 'end', ownerId: horse.id, k: blk.k })
      if (blk.gap && blk.k > 0)
        out.push({ t: blk.gap.a, kind: 'gapStart', ownerId: horse.id, k: blk.k })
    }
  }
  for (const p of parts) {
    if (p.id === exclude.partId) continue
    out.push({ t: p.start, kind: 'partStart', ownerId: p.id, k: null })
    out.push({ t: p.end, kind: 'partEnd', ownerId: p.id, k: null })
  }
  if (playhead !== null) out.push({ t: playhead, kind: 'playhead', ownerId: null, k: null })
  return out
}

export interface SnapHit {
  /** new start of the dragged block */
  start: number
  /** which edge of the dragged block met the anchor */
  edge: 'start' | 'end'
  anchor: Anchor
}

/**
 * Snaps a block [start, start + length] to the nearest anchor: both its start and its end are
 * checked; the nearest anchor within `tolerance` seconds wins. Null when none is in range.
 */
export function snapToAnchors(
  start: number,
  length: number,
  anchors: readonly Anchor[],
  tolerance: number,
): SnapHit | null {
  let best: SnapHit | null = null
  let bestD = tolerance
  for (const anchor of anchors) {
    const ds = Math.abs(anchor.t - start)
    if (ds <= bestD) {
      bestD = ds
      best = { start: anchor.t, edge: 'start', anchor }
    }
    const de = Math.abs(anchor.t - (start + length))
    if (de < bestD) {
      bestD = de
      best = { start: anchor.t - length, edge: 'end', anchor }
    }
  }
  return best && best.start >= 0 ? best : null
}

/**
 * Where a dragged block starts: on a magnet edge if one is near (`magnet` with a tolerance in
 * seconds), otherwise on the beat or 0.1 s.
 */
export function dragTarget(
  start: number,
  length: number,
  anchors: readonly Anchor[],
  magnetTolerance: number | null,
  snap: SnapOptions,
): { start: number; hit: SnapHit | null } {
  const raw = Math.max(0, start)
  const hit = magnetTolerance === null ? null : snapToAnchors(raw, length, anchors, magnetTolerance)
  return hit ? { start: hit.start, hit } : { start: Math.max(0, snapTime(raw, snap)), hit: null }
}

/**
 * Alt + arrow: the next edge (start or end of the block) that lands on an anchor in direction
 * `dir`, as the new start. Null when there is none.
 */
export function nextAnchorStart(
  start: number,
  length: number,
  anchors: readonly Anchor[],
  dir: 1 | -1,
): number | null {
  const eps = 1e-6
  let best: number | null = null
  for (const a of anchors)
    for (const s of [a.t, a.t - length]) {
      if (s < 0 || (s - start) * dir <= eps) continue
      if (best === null || (s - best) * dir < 0) best = s
    }
  return best
}

// ---------- parts ----------

/** A new part (prototype `newPart`): next free colour, sorted into the list by start. */
export function addPart(parts: readonly Part[], part: Omit<Part, 'color'>): Part[] {
  const color = PART_COLORS[parts.length % PART_COLORS.length] ?? '#7c6fd6'
  return sortParts([...parts, { ...part, color }])
}

export const sortParts = (parts: readonly Part[]): Part[] =>
  [...parts].sort((a, b) => a.start - b.start)

/** Default length of a part made with "+ Part": 8 bars, without BPM 20 s (prototype). */
export function defaultPartLength(bpm: number | null, meter: number): number {
  const b = beatLength(bpm)
  return b ? b * meter * 8 : 20
}

export type PartDragMode = 'move' | 'start' | 'end'

/**
 * Drags a part (prototype part drag): `move` keeps its length, `start`/`end` move one edge,
 * keeping at least `PART_MIN`. `t` is the already snapped new time of the dragged edge (for
 * `move`: the new start).
 */
export function dragPart(part: Part, mode: PartDragMode, t: number): Part {
  if (mode === 'move') {
    const len = part.end - part.start
    const start = Math.max(0, t)
    return { ...part, start, end: start + len }
  }
  if (mode === 'start') return { ...part, start: Math.max(0, Math.min(part.end - PART_MIN, t)) }
  return { ...part, end: Math.max(part.start + PART_MIN, t) }
}

/** Sets start and end from the part editor; ignored unless end − start ≥ 0.1 s (prototype). */
export function setPartRange(part: Part, start: number, end: number): Part {
  if (!(start >= 0) || !(end >= start + 0.1)) return part
  return { ...part, start, end }
}
