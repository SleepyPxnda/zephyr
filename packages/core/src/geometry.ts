import type { Hand, Point } from './schemas'
import { cross, dist } from './vec'

/** Sampling steps (SPEC "Geometrie-Werkzeuge"): lines every 0.5 m, arcs every 0.4 m. */
export const LINE_STEP = 0.5
export const ARC_STEP = 0.4
/** Angle snapping with Shift: 15° steps. */
export const SNAP_ANGLE = Math.PI / 12
/** Volte diameters snap to this grid (m). */
export const VOLTE_GRID = 0.5

/** Points from a (exclusive) to b (inclusive), at most LINE_STEP apart. */
export function sampleLine(a: Point, b: Point): Point[] {
  const n = Math.max(1, Math.ceil(dist(a, b) / LINE_STEP))
  const out: Point[] = []
  for (let i = 1; i <= n; i++) out.push({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n })
  return out
}

export interface Turn {
  pts: Point[]
  length: number
  center: Point
  R: number
}

/**
 * Turn on the circle of radius R until the horse faces E, then ride straight to it
 * (prototype `turnThenStraight`). Null when no turn is needed (< 2°, or E closer than
 * 0.3 m); 'inside' when E lies inside the turning circle.
 */
export function turnThenStraight(S: Point, hd: number, E: Point, R: number): Turn | null | 'inside' {
  const h = { x: Math.cos(hd), y: Math.sin(hd) }
  const v = { x: E.x - S.x, y: E.y - S.y }
  const cr = cross(h, v)
  const ang = Math.atan2(cr, h.x * v.x + h.y * v.y)
  if (Math.abs(ang) < 0.035 || Math.hypot(v.x, v.y) < 0.3) return null
  const side = Math.sign(cr)
  const n = { x: -h.y * side, y: h.x * side }
  const C = { x: S.x + n.x * R, y: S.y + n.y * R }
  if (dist(C, E) <= R * 1.001) return 'inside'
  const th0 = Math.atan2(S.y - C.y, S.x - C.x)
  const s = Math.sign(cross({ x: S.x - C.x, y: S.y - C.y }, h)) || 1
  const facing = (th: number) => {
    const a = th0 + s * th
    const P = { x: C.x + R * Math.cos(a), y: C.y + R * Math.sin(a) }
    const t = { x: -s * Math.sin(a), y: s * Math.cos(a) }
    return cross(t, { x: E.x - P.x, y: E.y - P.y }) * side
  }
  const step = Math.min(0.05, 0.2 / R)
  let lo = 0
  let hi: number | null = null
  for (let th = step; th <= Math.PI * 2 + step; th += step) {
    if (facing(th) <= 0) {
      hi = th
      break
    }
    lo = th
  }
  if (hi === null) return 'inside'
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2
    if (facing(mid) > 0) lo = mid
    else hi = mid
  }
  const thE = (lo + hi) / 2
  const arcLen = thE * R
  const cnt = Math.max(3, Math.ceil(arcLen / ARC_STEP))
  const pts: Point[] = []
  for (let i = 1; i <= cnt; i++) {
    const a = th0 + (s * thE * i) / cnt
    pts.push({ x: C.x + R * Math.cos(a), y: C.y + R * Math.sin(a) })
  }
  const T = pts[pts.length - 1] as Point
  sampleLine(T, E).forEach((q) => pts.push(q))
  return { pts, length: arcLen + dist(T, E), center: C, R }
}

/** Circular arc from S over M to E; two straight pieces when the three are collinear. */
export function arc3Points(S: Point, M: Point, E: Point): { pts: Point[]; R: number } {
  const ax = S.x
  const ay = S.y
  const bx = M.x
  const by = M.y
  const cx = E.x
  const cy = E.y
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
  if (Math.abs(d) < 1e-6) return { pts: [...sampleLine(S, M), ...sampleLine(M, E)], R: Infinity }
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d
  const R = Math.hypot(ax - ux, ay - uy)
  const TAU = Math.PI * 2
  const norm = (a: number) => ((a % TAU) + TAU) % TAU
  const a0 = Math.atan2(ay - uy, ax - ux)
  const am = norm(Math.atan2(by - uy, bx - ux) - a0)
  const a1 = norm(Math.atan2(cy - uy, cx - ux) - a0)
  const sweep = am < a1 ? a1 : -(TAU - a1)
  const cnt = Math.max(6, Math.ceil((Math.abs(sweep) * R) / ARC_STEP))
  const pts: Point[] = []
  for (let i = 1; i <= cnt; i++) {
    const a = a0 + (sweep * i) / cnt
    pts.push({ x: ux + R * Math.cos(a), y: uy + R * Math.sin(a) })
  }
  pts[pts.length - 1] = { x: E.x, y: E.y }
  return { pts, R }
}

export type FigureKind = 'line' | 'arc' | 'circle'
/** What was drawn; the UI turns it into a localised label. */
export type FigureShape = 'line' | 'lineTooClose' | 'turnLine' | 'arc' | 'volte' | 'halfVolte' | 'zirkel' | 'circle'

export interface FigureOptions {
  /** turning circle diameter of the drawing gait (m) */
  turnDiameter: number
  /** "Ecken mit Wendekreis abrunden": lines turn on the turning circle */
  roundCorners: boolean
  hand: Hand
  half: boolean
  /** Shift held: snap the angle to 15° */
  shift: boolean
}

export interface Figure {
  /** points without the start point S */
  pts: Point[]
  /** where the figure ends (the remembered end point E) */
  end: Point
  length: number
  /** null when nothing would be drawn */
  shape: FigureShape | null
  /** tighter than the turning circle (or target inside it) */
  tight: boolean
  center?: Point
  R?: number
  diameter?: number
  hand?: 'left' | 'right'
}

const withTurnCheck = (f: Figure, turnDiameter: number): Figure => {
  if (f.R && turnDiameter && f.R * 2 < turnDiameter - 0.05) f.tight = true
  return f
}

function circleShape(d: number, half: boolean): FigureShape {
  if (half) return 'halfVolte'
  if (d === 6 || d === 8 || d === 10) return 'volte'
  return d === 20 ? 'zirkel' : 'circle'
}

const snapAngle = (a: number) => Math.round(a / SNAP_ANGLE) * SNAP_ANGLE

/**
 * Builds a line, tangential arc or volte from the path end S with heading hd towards the
 * pointer E (prototype `geometry`).
 */
export function figure(kind: FigureKind, S: Point, hd: number | null, E: Point, o: FigureOptions): Figure {
  if (kind === 'line') {
    if (o.shift) {
      const a = snapAngle(Math.atan2(E.y - S.y, E.x - S.x))
      const d = dist(S, E)
      E = { x: S.x + Math.cos(a) * d, y: S.y + Math.sin(a) * d }
    }
    const Rt = (o.turnDiameter || 0) / 2
    if (hd !== null && o.roundCorners && Rt > 0.05) {
      const turned = turnThenStraight(S, hd, E, Rt)
      if (turned === 'inside')
        return { pts: sampleLine(S, E), end: E, length: dist(S, E), shape: 'lineTooClose', tight: true }
      if (turned)
        return { pts: turned.pts, end: E, length: turned.length, shape: 'turnLine', tight: false, center: turned.center, R: turned.R }
    }
    return { pts: sampleLine(S, E), end: E, length: dist(S, E), shape: 'line', tight: false }
  }
  if (kind === 'arc') {
    const v = { x: E.x - S.x, y: E.y - S.y }
    const straight: Figure = { pts: sampleLine(S, E), end: E, length: dist(S, E), shape: 'line', tight: false }
    if (hd === null) return straight
    const h = { x: Math.cos(hd), y: Math.sin(hd) }
    const n = { x: -h.y, y: h.x }
    const vn = v.x * n.x + v.y * n.y
    const vv = v.x * v.x + v.y * v.y
    if (Math.abs(vn) < 1e-3 || vv < 0.01) return straight
    const r = vv / (2 * vn)
    const C = { x: S.x + n.x * r, y: S.y + n.y * r }
    const R = Math.abs(r)
    const a0 = Math.atan2(S.y - C.y, S.x - C.x)
    const a1 = Math.atan2(E.y - C.y, E.x - C.x)
    const dir = Math.sign(cross({ x: S.x - C.x, y: S.y - C.y }, h)) || 1
    let sweep = a1 - a0
    if (dir > 0) {
      while (sweep <= 0) sweep += Math.PI * 2
    } else {
      while (sweep >= 0) sweep -= Math.PI * 2
    }
    const len = Math.abs(sweep) * R
    const cnt = Math.max(4, Math.ceil(len / ARC_STEP))
    const pts: Point[] = []
    for (let i = 1; i <= cnt; i++) {
      const a = a0 + (sweep * i) / cnt
      pts.push({ x: C.x + R * Math.cos(a), y: C.y + R * Math.sin(a) })
    }
    pts[pts.length - 1] = { x: E.x, y: E.y }
    return withTurnCheck({ pts, end: E, length: len, shape: 'arc', tight: false, center: C, R, diameter: R * 2 }, o.turnDiameter)
  }
  // circle / volte
  const turnsA = o.half ? Math.PI : Math.PI * 2
  if (hd !== null) {
    // tangent to the current direction: no corner where the volte starts
    const h = { x: Math.cos(hd), y: Math.sin(hd) }
    const nL = { x: h.y, y: -h.x }
    const sideDot = (E.x - S.x) * nL.x + (E.y - S.y) * nL.y
    const side = o.hand === 'left' ? 1 : o.hand === 'right' ? -1 : sideDot >= 0 ? 1 : -1
    // SPEC: diameter = lateral distance of the pointer on a 0.5 m grid
    const d = Math.max(1, Math.round(Math.abs(sideDot) / VOLTE_GRID) * VOLTE_GRID)
    const n = { x: nL.x * side, y: nL.y * side }
    const R = d / 2
    const C = { x: S.x + n.x * R, y: S.y + n.y * R }
    const a0 = Math.atan2(S.y - C.y, S.x - C.x)
    const dir = Math.sign(cross({ x: S.x - C.x, y: S.y - C.y }, h)) || 1
    const len = R * turnsA
    const cnt = Math.max(12, Math.ceil(len / ARC_STEP))
    const pts: Point[] = []
    for (let i = 1; i <= cnt; i++) {
      const a = a0 + (dir * turnsA * i) / cnt
      pts.push({ x: C.x + R * Math.cos(a), y: C.y + R * Math.sin(a) })
    }
    if (!o.half) pts[pts.length - 1] = { x: S.x, y: S.y }
    return withTurnCheck(
      {
        pts,
        end: { x: S.x + n.x * d, y: S.y + n.y * d },
        length: len,
        shape: circleShape(d, o.half),
        tight: false,
        center: C,
        R,
        diameter: d,
        hand: side > 0 ? 'left' : 'right',
      },
      o.turnDiameter,
    )
  }
  let d = dist(S, E)
  if (d < 0.5) return { pts: [], end: E, length: 0, shape: null, tight: false }
  let ux = (E.x - S.x) / d
  let uy = (E.y - S.y) / d
  if (o.shift) {
    const a = snapAngle(Math.atan2(uy, ux))
    ux = Math.cos(a)
    uy = Math.sin(a)
  }
  d = Math.max(1, Math.round(d / VOLTE_GRID) * VOLTE_GRID)
  const R = d / 2
  const C = { x: S.x + ux * R, y: S.y + uy * R }
  const a0 = Math.atan2(S.y - C.y, S.x - C.x)
  // no direction yet (first element): the click marks the opposite side; the hand decides the sense
  const dir = o.hand === 'right' ? 1 : -1
  const len = R * turnsA
  const cnt = Math.max(16, Math.ceil(len / ARC_STEP))
  const pts: Point[] = []
  for (let i = 1; i <= cnt; i++) {
    const a = a0 + (dir * turnsA * i) / cnt
    pts.push({ x: C.x + R * Math.cos(a), y: C.y + R * Math.sin(a) })
  }
  if (!o.half) pts[pts.length - 1] = { x: S.x, y: S.y }
  return withTurnCheck(
    {
      pts,
      end: { x: S.x + ux * d, y: S.y + uy * d },
      length: len,
      shape: circleShape(d, o.half),
      tight: false,
      center: C,
      R,
      diameter: d,
      hand: dir > 0 ? 'right' : 'left',
    },
    o.turnDiameter,
  )
}
