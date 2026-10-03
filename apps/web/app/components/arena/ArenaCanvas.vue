<script setup lang="ts">
import {
  pointerToArena,
  toMetres,
  viewKeeping,
  type Gait,
  type Horse,
  type Part,
  type Point,
  type Timeline,
  type Viewport,
} from '@zephyr/core'
import { useDevicePixelRatio, useEventListener, useRafFn } from '@vueuse/core'
import type { ArenaInfo } from '~/composables/useCatalog'
import type { DisplayOptions } from '~/composables/useDisplayOptions'
import { injectArenaView } from '~/composables/arenaViewContext'
import type { ArenaPointer, Ghost } from '~/composables/useDrawTools'
import type { HandleView, OverlayLabel } from '~/composables/useSelectTool'
import type { PastePreview } from '~/composables/useClipboardTools'
import { drawField, drawScene, type SceneLabels } from '~/lib/arena/render'

const props = defineProps<{
  arena: ArenaInfo
  viewport: Viewport
  horses: readonly Horse[]
  timelines: ReadonlyMap<string, Timeline>
  gaits: readonly Gait[]
  parts: readonly Part[]
  activeId: string | null
  time: number
  options: DisplayOptions
  ghost: Ghost | null
  splitHover: Point | null
  selection: readonly string[]
  peerMarks?: ReadonlyMap<string, readonly string[]>
  handles: readonly HandleView[]
  overlay: OverlayLabel | null
  pastePreview: readonly PastePreview[]
  /** cursor style for the current tool */
  cursor: string
}>()
const emit = defineEmits<{ pointer: [e: ArenaPointer] }>()

const { t, n } = useI18n()
const view = injectArenaView()
const { pixelRatio } = useDevicePixelRatio()
const fieldCanvas = useTemplateRef<HTMLCanvasElement>('field')
const sceneCanvas = useTemplateRef<HTMLCanvasElement>('scene')

// hall image (signed address)
const image = shallowRef<HTMLImageElement | null>(null)
watch(
  () => props.arena.imageUrl,
  (url) => {
    if (!url) return (image.value = null)
    const img = new Image()
    img.onload = () => (image.value = img)
    img.src = url
  },
  { immediate: true },
)

const pxSize = computed(() => ({
  width: Math.round(props.viewport.width * pixelRatio.value),
  height: Math.round(props.viewport.height * pixelRatio.value),
}))

const labels = computed<SceneLabels>(() => ({
  waiting: t('editor.arena.waiting'),
  halt: t('editor.arena.halt'),
  pause: t('editor.arena.pause'),
  pending: (kind, seconds, jump) =>
    t(jump ? 'editor.arena.pendingJump' : 'editor.arena.pending', {
      kind: t(`editor.arena.${kind}`),
      seconds: n(seconds, 'decimal'),
    }),
}))

// two layers: the hall only when zoom/size/image change, the scene once per frame when needed
let fieldDirty = true
let sceneDirty = true
watch([() => view.transform.value, pxSize, image], () => {
  fieldDirty = true
  sceneDirty = true
})
watch(
  () => [
    props.horses,
    props.timelines,
    props.gaits,
    props.parts,
    props.activeId,
    props.time,
    ...Object.values(props.options),
    labels.value,
    props.ghost,
    props.splitHover,
    props.selection,
    props.peerMarks,
    props.handles,
    props.overlay,
    props.pastePreview,
  ],
  () => (sceneDirty = true),
)
useRafFn(() => {
  const tr = view.transform.value
  const dpr = pixelRatio.value
  if (fieldDirty && fieldCanvas.value) {
    const ctx = fieldCanvas.value.getContext('2d')
    if (ctx)
      drawField(ctx, { arena: props.arena, image: image.value, t: tr, vp: props.viewport, dpr })
    fieldDirty = false
  }
  if (sceneDirty && sceneCanvas.value) {
    const ctx = sceneCanvas.value.getContext('2d')
    if (ctx)
      drawScene(
        ctx,
        {
          horses: props.horses,
          timelines: props.timelines,
          gaits: props.gaits,
          parts: props.parts,
          activeId: props.activeId,
          time: props.time,
          labels: labels.value,
          ghost: props.ghost,
          splitHover: props.splitHover,
          selection: props.selection,
          peerMarks: props.peerMarks,
          handles: props.handles,
          overlay: props.overlay,
          pastePreview: props.pastePreview,
          ...props.options,
        },
        tr,
        props.viewport,
        dpr,
      )
    sceneDirty = false
  }
})

// ---------- zoom and pan (SPEC "Interaktionen und Tastenkürzel") ----------
const local = (e: { clientX: number; clientY: number }): Point => {
  const r = sceneCanvas.value?.getBoundingClientRect()
  return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) }
}

useEventListener(
  sceneCanvas,
  'wheel',
  (e: WheelEvent) => {
    const zoom = view.view.value.zoom
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const p = local(e)
      view.zoomAtPoint(p.x, p.y, zoom * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.04 : 0.0015)))
    } else if (zoom > 1) {
      e.preventDefault()
      view.pan(-e.deltaX, -e.deltaY)
    }
  },
  { passive: false },
)

type Gesture = { kind: 'pan'; last: Point } | { kind: 'pinch'; d0: number; z0: number; m: Point }
let gesture: Gesture | null = null
const touches = new Map<number, Point>()
const twoTouches = () => [...touches.values()].slice(0, 2) as [Point, Point]

// ---------- pointer events for the tools, in metres ----------
function toolEvent(kind: ArenaPointer['kind'], e: MouseEvent & { pointerId?: number }) {
  const s = local(e)
  const tr = view.transform.value
  emit('pointer', {
    kind,
    m: pointerToArena(tr, props.arena, s.x, s.y),
    screen: s,
    shift: e.shiftKey,
    scale: tr.scale,
    pointerId: e.pointerId ?? 0,
  })
}

function onPointerDown(e: PointerEvent) {
  if (e.pointerType === 'touch') {
    touches.set(e.pointerId, local(e))
    if (touches.size === 2) {
      // a second finger aborts the stroke and starts pinch zoom
      toolEvent('cancel', e)
      const [a, b] = twoTouches()
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      gesture = {
        kind: 'pinch',
        d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        z0: view.view.value.zoom,
        m: toMetres(view.transform.value, mid.x, mid.y),
      }
      return
    }
    if (touches.size > 2) return
  } else if (e.button === 1 || e.altKey) {
    e.preventDefault()
    gesture = { kind: 'pan', last: { x: e.clientX, y: e.clientY } }
    sceneCanvas.value?.setPointerCapture(e.pointerId)
    return
  } else if (e.button !== 0) return
  e.preventDefault()
  sceneCanvas.value?.setPointerCapture(e.pointerId)
  toolEvent('down', e)
}

function onPointerMove(e: PointerEvent) {
  if (e.pointerType === 'touch' && touches.has(e.pointerId)) touches.set(e.pointerId, local(e))
  if (!gesture) return toolEvent('move', e)
  if (gesture.kind === 'pan') {
    view.pan(e.clientX - gesture.last.x, e.clientY - gesture.last.y)
    gesture.last = { x: e.clientX, y: e.clientY }
  } else if (touches.size >= 2) {
    const [a, b] = twoTouches()
    const d = Math.hypot(a.x - b.x, a.y - b.y)
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    view.setView(
      viewKeeping(
        { lengthM: props.arena.lengthM, widthM: props.arena.widthM },
        props.viewport,
        (gesture.z0 * d) / gesture.d0,
        gesture.m,
        mid.x,
        mid.y,
      ),
    )
  }
}

function onPointerUp(e: PointerEvent) {
  touches.delete(e.pointerId)
  if (!gesture) return toolEvent(e.type === 'pointercancel' ? 'cancel' : 'up', e)
  if (gesture.kind === 'pan' || touches.size < 2) gesture = null
}
</script>

<template>
  <div
    class="relative overflow-hidden bg-card"
    :style="{ width: `${viewport.width}px`, height: `${viewport.height}px` }"
  >
    <canvas
      ref="field"
      class="absolute inset-0 size-full"
      :width="pxSize.width"
      :height="pxSize.height"
      aria-hidden="true"
    />
    <canvas
      ref="scene"
      class="absolute inset-0 size-full touch-none"
      :style="{ cursor }"
      :width="pxSize.width"
      :height="pxSize.height"
      role="img"
      :aria-label="$t('editor.arena.canvas', horses.length)"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="toolEvent('leave', $event)"
      @dblclick="toolEvent('dblclick', $event)"
    />
  </div>
</template>
