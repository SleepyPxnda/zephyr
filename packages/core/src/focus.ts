import { sectionGeom } from './path'
import type { Horse, Part, Path } from './schemas'
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

/**
 * Start of a span of `len` seconds moved into the range; a span longer than the range starts at
 * its start. `from` is where the span is now: a span that crosses the window edge is never pushed
 * against the direction of the move.
 */
export function clampSpanStart(
  start: number,
  len: number,
  range: TimeRange | null,
  from: number,
): number {
  if (!range) return start
  const clamped = Math.max(range.start, Math.min(start, range.end - len))
  if (start > from) return Math.max(from, clamped)
  if (start < from) return Math.min(from, clamped)
  return from
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
 * crosses the range edge is drawn whole. `start` is when the horse sets off on the first of these
 * sections. `null` when no section touches the range (or no path).
 */
export function visiblePoints(
  path: Path,
  tl: Timeline,
  range: TimeRange | null,
): { from: number; to: number; start: number } | null {
  const n = path.pts.length
  if (!n) return null
  if (!range) return { from: 0, to: n - 1, start: 0 }
  let from = Number.POSITIVE_INFINITY
  let to = -1
  let start = Number.POSITIVE_INFINITY
  path.sections.forEach((_, k) => {
    const { a, b } = sectionTimes(path, tl, k)
    if (b <= range.start || a >= range.end) return
    const g = sectionGeom(path, k)
    from = Math.min(from, g.si)
    to = Math.max(to, g.e)
    start = Math.min(start, a)
  })
  return to < 0 ? null : { from, to, start }
}

/** One PDF page: a part, or a stretch no part covers (`part: null`). */
export interface ExportPage extends TimeRange {
  part: Part | null
}

/** Gaps between parts shorter than this (s) are rounding, not a page of their own. */
const EXPORT_GAP_MIN = 0.05

/**
 * PDF pages in time order: one per part (sorted by start, overlaps allowed) and one per stretch
 * between 0, the parts and `end` that no part covers, but only where a horse rides.
 */
export function exportPages(
  parts: readonly Part[],
  horses: readonly Horse[],
  timelines: ReadonlyMap<string, Timeline>,
  end: number,
): ExportPage[] {
  const rides = (r: TimeRange) =>
    horses.some((h) => {
      const tl = timelines.get(h.id)
      return !!tl && visiblePoints(h.path, tl, r) !== null
    })
  const pages: ExportPage[] = []
  const gap = (start: number, stop: number) => {
    if (stop - start >= EXPORT_GAP_MIN && rides({ start, end: stop }))
      pages.push({ start, end: stop, part: null })
  }
  let covered = 0
  for (const p of [...parts].sort((a, b) => a.start - b.start)) {
    gap(covered, p.start)
    pages.push({ start: p.start, end: p.end, part: p })
    covered = Math.max(covered, p.end)
  }
  gap(covered, end)
  return pages
}
