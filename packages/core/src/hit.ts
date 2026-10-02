import type { Horse, PathPoint, Point } from './schemas'

export interface SegmentHit {
  horseId: string
  /** the segment runs from point i-1 to point i */
  i: number
  /** position on the segment, 0..1 */
  f: number
  /** distance in metres */
  d: number
  /** the hit point */
  x: number
  y: number
}

/**
 * Nearest path segment within `maxDist` metres (prototype `nearestSegment`, 14 px). The active
 * horse is searched first and wins whenever it is hit; jumps are not segments.
 */
export function nearestSegment(
  horses: readonly Horse[],
  activeId: string | null,
  p: Point,
  maxDist: number,
): SegmentHit | null {
  const order = [
    ...horses.filter((h) => h.id === activeId),
    ...horses.filter((h) => h.id !== activeId),
  ]
  let best: SegmentHit | null = null
  for (const h of order) {
    const pts = h.path.pts
    for (let i = 1; i < pts.length; i++) {
      const b = pts[i] as PathPoint
      if (b.jump) continue
      const a = pts[i - 1] as PathPoint
      const dx = b.x - a.x
      const dy = b.y - a.y
      const L = dx * dx + dy * dy
      if (L < 1e-8) continue
      const f = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L))
      const x = a.x + dx * f
      const y = a.y + dy * f
      const d = Math.hypot(x - p.x, y - p.y)
      // a slightly nearer segment of another horse does not steal the hit (0.5 px in the prototype)
      if (d < maxDist && (!best || d < best.d - maxDist / 28))
        best = { horseId: h.id, i, f, d, x, y }
    }
    if (best && best.horseId === order[0]?.id) break
  }
  return best
}
