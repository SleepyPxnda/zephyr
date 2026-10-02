import type { Point } from './schemas'

export const dist = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y)
export const cross = (a: Point, b: Point): number => a.x * b.y - a.y * b.x
/** Rounds to centimetres exactly like the prototype (`+x.toFixed(2)`). */
export const r2 = (v: number): number => +v.toFixed(2) || 0 // `|| 0` turns -0 into 0
export const roundPt = (q: Point): Point => ({ x: r2(q.x), y: r2(q.y) })
