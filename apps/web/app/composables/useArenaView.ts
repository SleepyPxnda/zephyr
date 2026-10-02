import {
  clampView,
  fitView,
  panBy,
  viewTransform,
  zoomAt,
  type ArenaSize,
  type ViewState,
  type Viewport,
} from '@zephyr/core'

/** Zoom factor of the −/+ buttons and keys (as in the prototype). */
const STEP = 1.4

/** Zoom and visible area of the arena; the formulas live in @zephyr/core (`view`). */
export function useArenaView(arena: Ref<ArenaSize>, viewport: Ref<Viewport>) {
  const view = shallowRef<ViewState>(fitView(arena.value))
  watch(arena, (a) => (view.value = clampView(view.value, a)))

  const transform = computed(() => viewTransform(view.value, arena.value, viewport.value))
  const zoomPercent = computed(() => Math.round(view.value.zoom * 100))

  const zoomAtPoint = (sx: number, sy: number, zoom: number) =>
    (view.value = zoomAt(view.value, arena.value, viewport.value, sx, sy, zoom))
  const zoomBy = (factor: number) =>
    zoomAtPoint(viewport.value.width / 2, viewport.value.height / 2, view.value.zoom * factor)

  return {
    view: computed(() => view.value),
    transform,
    zoomPercent,
    zoomAtPoint,
    zoomIn: () => zoomBy(STEP),
    zoomOut: () => zoomBy(1 / STEP),
    fit: () => (view.value = fitView(arena.value)),
    pan: (dx: number, dy: number) =>
      (view.value = panBy(view.value, arena.value, viewport.value, dx, dy)),
    /** pinch: set zoom and centre directly */
    setView: (v: ViewState) => (view.value = clampView(v, arena.value)),
  }
}
