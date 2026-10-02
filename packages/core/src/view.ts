import type { Arena, Point } from './schemas'

/**
 * Zoom and visible area of the arena (prototype `view`, `applyView`, `zoomAt`, `panBy`).
 * Metres ↔ CSS pixels; the arena image is stretched to length × width.
 */
export type ArenaSize = Pick<Arena, 'lengthM' | 'widthM'>

export interface ViewState {
  /** 1 = whole arena (100 %), up to 8 (800 %) */
  zoom: number
  /** centre of the visible area in metres */
  cx: number
  cy: number
}

export interface Viewport {
  /** canvas size in CSS pixels */
  width: number
  height: number
}

export interface ViewTransform {
  /** CSS pixels per metre */
  scale: number
  ox: number
  oy: number
}

export const ZOOM_MIN = 1
export const ZOOM_MAX = 8

/** Dark border around the hall image (prototype: max(1.5 m, 3.5 % of the length)). */
export const arenaMargin = (a: ArenaSize): number => Math.max(1.5, a.lengthM * 0.035)

/** Size of the drawing area incl. margin, in metres. */
export function arenaExtent(a: ArenaSize): { w: number; h: number } {
  const m = arenaMargin(a)
  return { w: a.lengthM + 2 * m, h: a.widthM + 2 * m }
}

/** Canvas size for an available width, keeping the arena's aspect, at most `maxHeight` high. */
export function canvasSize(a: ArenaSize, availWidth: number, maxHeight: number): Viewport {
  const { w, h } = arenaExtent(a)
  let width = availWidth
  let height = (width * h) / w
  if (height > maxHeight) {
    height = maxHeight
    width = (height * w) / h
  }
  return { width, height }
}

export const fitView = (a: ArenaSize): ViewState => ({
  zoom: 1,
  cx: a.lengthM / 2,
  cy: a.widthM / 2,
})

export function clampView(v: ViewState, a: ArenaSize): ViewState {
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.zoom))
  if (zoom <= 1.001) return fitView(a)
  const m = arenaMargin(a)
  return {
    zoom,
    cx: Math.min(a.lengthM + m, Math.max(-m, v.cx)),
    cy: Math.min(a.widthM + m, Math.max(-m, v.cy)),
  }
}

export function viewTransform(v: ViewState, a: ArenaSize, vp: Viewport): ViewTransform {
  const { w, h } = arenaExtent(a)
  const base = Math.min(vp.width / w, vp.height / h)
  const scale = base * v.zoom
  return { scale, ox: vp.width / 2 - v.cx * scale, oy: vp.height / 2 - v.cy * scale }
}

export const toScreen = (t: ViewTransform, p: Point): Point => ({
  x: t.ox + p.x * t.scale,
  y: t.oy + p.y * t.scale,
})
export const toMetres = (t: ViewTransform, sx: number, sy: number): Point => ({
  x: (sx - t.ox) / t.scale,
  y: (sy - t.oy) / t.scale,
})

/** The view at `zoom` that shows the arena point `m` (metres) at screen position (sx, sy). */
export function viewKeeping(
  a: ArenaSize,
  vp: Viewport,
  zoom: number,
  m: Point,
  sx: number,
  sy: number,
): ViewState {
  const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))
  const s2 = viewTransform({ zoom: z, cx: 0, cy: 0 }, a, vp).scale
  return clampView(
    {
      zoom: z,
      cx: (vp.width / 2 - (sx - m.x * s2)) / s2,
      cy: (vp.height / 2 - (sy - m.y * s2)) / s2,
    },
    a,
  )
}

/** Zoom to `zoom` keeping the point under the pointer (sx, sy) in place. */
export function zoomAt(
  v: ViewState,
  a: ArenaSize,
  vp: Viewport,
  sx: number,
  sy: number,
  zoom: number,
): ViewState {
  return viewKeeping(a, vp, zoom, toMetres(viewTransform(v, a, vp), sx, sy), sx, sy)
}

/** Moves the visible area by a pointer movement in CSS pixels (only when zoomed in). */
export function panBy(v: ViewState, a: ArenaSize, vp: Viewport, dx: number, dy: number): ViewState {
  if (v.zoom <= 1) return v
  const s = viewTransform(v, a, vp).scale
  return clampView({ ...v, cx: v.cx - dx / s, cy: v.cy - dy / s }, a)
}

/**
 * Pointer position in metres (prototype `toM`): rounded to cm and kept within the arena plus
 * 80 % of the margin.
 */
export function pointerToArena(t: ViewTransform, a: ArenaSize, sx: number, sy: number): Point {
  const m = arenaMargin(a) * 0.8
  const p = toMetres(t, sx, sy)
  const round = (v: number) => Math.round(v * 100) / 100
  return {
    x: round(Math.max(-m, Math.min(a.lengthM + m, p.x))),
    y: round(Math.max(-m, Math.min(a.widthM + m, p.y))),
  }
}

/** Length of the scale bar: the first of 1, 2, 5, 10, 20, 50 m that is at least 45 px long. */
export const scaleBarMetres = (scale: number): number =>
  [1, 2, 5, 10, 20, 50].find((s) => s * scale >= 45) ?? 50
