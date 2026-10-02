import { figure, type FigureKind, type FigureOptions } from './geometry'
import { fromStrokes, normalizeStrokes, toStrokes, type Strokes } from './path'
import type { Horse, Pending, Point } from './schemas'
import { headingAt } from './timeline'
import { dist, r2, roundPt } from './vec'

/** "+ Halt (2 s)" and "+ Pause (4 s, nächste Linie frei ansetzen)". */
export const NEXT_HALT_S = 2
export const NEXT_PAUSE_S = 4
/** Freehand: a point every 4 screen pixels; a new stroke further than 14 px away gets its own start. */
export const FREEHAND_STEP_PX = 4
export const FREEHAND_CONNECT_PX = 14

/** Announces a halt or pause before the next line (`horses.pending`). Needs a path. */
export function announceGap(h: Horse, kind: 'halt' | 'pause'): Horse {
  if (!h.path.pts.length) return h
  const pending: Pending =
    kind === 'halt'
      ? { gap: NEXT_HALT_S, gapType: 'halt', jump: false }
      : { gap: NEXT_PAUSE_S, gapType: 'pause', jump: true }
  return { ...h, pending }
}

/** Appends a section start for the next line; it takes the announced halt/pause as its gap. */
function pushSection(p: Strokes, gaitId: string, pending: Pending | null): void {
  p.strokes.push(p.pts.length)
  p.sg.push(gaitId)
  p.tack.push(null)
  p.gaps.push(pending && pending.gap > 0 ? pending.gap : 0)
  p.gt.push(
    pending ? (pending.gap > 0 ? pending.gapType : pending.jump ? 'pause' : 'halt') : 'halt',
  )
}

function firstPoint(p: Strokes, pt: Point, gaitId: string): void {
  p.pts.push(roundPt(pt))
  p.strokes = [0]
  p.sg = [gaitId]
  p.gaps = [0]
  p.gt = [null]
  p.tack = [null]
}

/** Start S and heading for the next figure; S is null on an empty path or after "+ Pause". */
export function figureStart(h: Horse): { S: Point | null; hd: number | null } {
  const pts = h.path.pts
  const last = pts[pts.length - 1]
  if (!last || h.pending?.jump) return { S: null, hd: null }
  return { S: { x: last.x, y: last.y }, hd: pts.length > 1 ? headingAt(pts, pts.length - 1) : null }
}

export interface FigureGesture extends FigureOptions {
  kind: FigureKind
  /** where the pointer went down (the new start on an empty path or after "+ Pause") */
  down: Point
  /** where it was released (the target E) */
  up: Point
  /** the pointer moved more than a click */
  moved: boolean
  gaitId: string
}

/**
 * One gesture with the line, arc or volte tool (prototype pointerdown + pointerup): on an empty
 * path or after "+ Pause" the press sets the start; the figure runs from the path end to the
 * release point. A plain click on an empty path only sets the start point.
 */
export function drawFigure(h: Horse, g: FigureGesture): Horse {
  const p = toStrokes(h.path)
  let pending = h.pending
  let fresh = false
  const down = roundPt(g.down)
  const up = roundPt(g.up)
  if (!p.pts.length) {
    firstPoint(p, down, g.gaitId)
    pending = null
    fresh = true
  } else if (pending?.jump) {
    pushSection(p, g.gaitId, pending)
    p.pts.push({ ...down, jump: true })
    pending = null
    fresh = true
  }
  const last = p.pts[p.pts.length - 1] as Point
  const S = { x: last.x, y: last.y }
  const hd = p.pts.length > 1 ? headingAt(p.pts, p.pts.length - 1) : null
  const fig = figure(g.kind, S, hd, up, g)
  if (fig.pts.length && (!fresh || g.moved)) {
    pushSection(p, g.gaitId, pending)
    pending = null
    fig.pts.forEach((q) => p.pts.push(roundPt(q)))
    normalizeStrokes(p)
    const E = g.kind === 'circle' ? up : fig.end
    const first = p.pts[p.strokes[p.strokes.length - 1] as number]
    if (first)
      first.geo = {
        kind: g.kind,
        E: { x: r2(E.x), y: r2(E.y) },
        hand: g.hand,
        half: g.half,
        round: g.roundCorners,
      }
  } else if (!fresh) return h
  normalizeStrokes(p)
  return { ...h, path: fromStrokes(p), pending }
}

/** Starts a freehand stroke at pt (`metresPerPx` = 1 / current scale). */
export function freehandBegin(h: Horse, pt: Point, gaitId: string, metresPerPx: number): Horse {
  const p = toStrokes(h.path)
  let pending = h.pending
  const first = roundPt(pt)
  if (!p.pts.length) {
    firstPoint(p, first, gaitId)
    pending = null
  } else {
    pushSection(p, gaitId, pending)
    const last = p.pts[p.pts.length - 1] as Point
    if (pending?.jump) p.pts.push({ ...first, jump: true })
    else if (dist(last, first) / metresPerPx > FREEHAND_CONNECT_PX) p.pts.push(first)
    pending = null
  }
  return { ...h, path: fromStrokes(p), pending }
}

/** Adds pt when it is at least 4 screen pixels from the last point. The path is not normalized yet. */
export function freehandExtend(h: Horse, pt: Point, metresPerPx: number): Horse {
  const q = roundPt(pt)
  const last = h.path.pts[h.path.pts.length - 1]
  if (!last || dist(last, q) < FREEHAND_STEP_PX * metresPerPx) return h
  return { ...h, path: { ...h.path, pts: [...h.path.pts, q] } }
}

/** Ends a freehand stroke. */
export function freehandEnd(h: Horse): Horse {
  const p = toStrokes(h.path)
  normalizeStrokes(p)
  return { ...h, path: fromStrokes(p) }
}

/** A complete freehand stroke through the raw pointer positions. */
export function drawFreehand(
  h: Horse,
  raw: readonly Point[],
  gaitId: string,
  metresPerPx: number,
): Horse {
  const [first, ...rest] = raw
  if (!first) return h
  let out = freehandBegin(h, first, gaitId, metresPerPx)
  for (const pt of rest) out = freehandExtend(out, pt, metresPerPx)
  return freehandEnd(out)
}
