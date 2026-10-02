import type { PathPoint, Point } from './schemas'
import { dist } from './vec'

/** Window (m) before and after a point for the curvature circle (SPEC "Wendekreis-Prüfung"). */
export const CURVE_WIN = 1.2
/** Minimum total turn (rad) inside the window for the corner test. */
export const CORNER_MIN_TURN = 0.2
/** Share of the window's turn that must happen at one point to count as a corner. */
export const CORNER_SHARE = 0.6

/** Angle between the segments a→b and b→c, or null when one of them is shorter than 5 cm. */
export function turnAngle(a: Point, b: Point, c: Point): number | null {
  const v1x = b.x - a.x
  const v1y = b.y - a.y
  const v2x = c.x - b.x
  const v2y = c.y - b.y
  const l1 = Math.hypot(v1x, v1y)
  const l2 = Math.hypot(v2x, v2y)
  if (l1 < 0.05 || l2 < 0.05) return null
  return Math.acos(Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (l1 * l2))))
}

/**
 * Curvature radius at every point (prototype `curveRadii`): circumcircle through the points
 * about CURVE_WIN metres before and after; jumps break the window. A corner (the turn of the
 * window happens mostly at one point) has radius 0; straight stretches have Infinity.
 */
export function curveRadii(pts: readonly PathPoint[]): number[] {
  const n = pts.length
  const R = new Array<number>(n).fill(Infinity)
  const cum = new Array<number>(n).fill(0)
  const P = (i: number) => pts[i] as PathPoint
  const C = (i: number) => cum[i] as number
  for (let i = 1; i < n; i++) cum[i] = C(i - 1) + (P(i).jump ? 0 : dist(P(i - 1), P(i)))
  for (let i = 1; i < n - 1; i++) {
    if (P(i).jump || P(i + 1).jump) continue
    let j = i - 1
    while (j > 0 && C(i) - C(j) < CURVE_WIN && !P(j).jump) j--
    let k = i + 1
    while (k < n - 1 && C(k) - C(i) < CURVE_WIN && !P(k + 1).jump) k++
    const A = P(j)
    const B = P(i)
    const Cp = P(k)
    const a = dist(B, Cp)
    const b = dist(A, Cp)
    const c = dist(A, B)
    const area2 = Math.abs((B.x - A.x) * (Cp.y - A.y) - (B.y - A.y) * (Cp.x - A.x))
    if (a < 0.05 || c < 0.05) continue
    // a sharp reversal on the spot gives a very small radius
    R[i] = area2 < 1e-6 ? (b < Math.max(a, c) ? 0.2 : Infinity) : (a * b * c) / (2 * area2)
    // a corner turns (almost) all at one point; a bend spreads the turn over the whole window
    const a1 = turnAngle(P(i - 1), P(i), P(i + 1))
    const th = turnAngle(A, B, Cp)
    if (a1 !== null && th !== null && th > CORNER_MIN_TURN && a1 > CORNER_SHARE * th && (j < i - 1 || k > i + 1))
      R[i] = 0
  }
  return R
}

/** A segment is too tight when 2 · min(radius of both ends) < 0.97 · turning diameter − 0.05 m. */
export function isTooTight(radius: number, turnDiameter: number): boolean {
  return Number.isFinite(radius) && radius * 2 < turnDiameter * 0.97 - 0.05
}
