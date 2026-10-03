import { sectionGeom } from './path'
import type { Path } from './schemas'
import { sectionTimes, type Timeline } from './timeline'

/** Time window of a focused part (s). */
export interface TimeRange {
  start: number
  end: number
}

/** Timeline zoom limits (px per second), shared by the slider and the focus fit. */
export const TIMELINE_ZOOM_MIN = 6
export const TIMELINE_ZOOM_MAX = 90

/** t limited to the range; without a range unchanged. */
export function clampToRange(t: number, range: TimeRange | null): number {
  return range ? Math.min(range.end, Math.max(range.start, t)) : t
}

/** Start of a span of `len` seconds moved into the range; a span longer than the range starts at its start. */
export function clampSpanStart(start: number, len: number, range: TimeRange | null): number {
  if (!range) return start
  return Math.max(range.start, Math.min(start, range.end - len))
}

/** Pixels per second that fit the range into `widthPx`, within the zoom limits. */
export function fitZoom(range: TimeRange, widthPx: number): number {
  const len = range.end - range.start
  if (!(len > 0) || !(widthPx > 0)) return TIMELINE_ZOOM_MIN
  return Math.min(TIMELINE_ZOOM_MAX, Math.max(TIMELINE_ZOOM_MIN, widthPx / len))
}

/**
 * Point indices of a path that the arena draws while a range is focused: from the start position
 * of the first section that overlaps the range to the last point of the last one. A section that
 * crosses the range edge is drawn whole. `null` when no section touches the range (or no path).
 */
export function visiblePoints(
  path: Path,
  tl: Timeline,
  range: TimeRange | null,
): { from: number; to: number } | null {
  const n = path.pts.length
  if (!n) return null
  if (!range) return { from: 0, to: n - 1 }
  let from = Number.POSITIVE_INFINITY
  let to = -1
  path.sections.forEach((_, k) => {
    const { a, b } = sectionTimes(path, tl, k)
    if (b <= range.start || a >= range.end) return
    const g = sectionGeom(path, k)
    from = Math.min(from, g.si)
    to = Math.max(to, g.e)
  })
  return to < 0 ? null : { from, to }
}
