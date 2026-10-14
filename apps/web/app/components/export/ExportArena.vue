<script setup lang="ts">
import {
  canvasSize,
  fitView,
  viewTransform,
  type Gait,
  type Horse,
  type TimeRange,
  type Timeline,
} from '@zephyr/core'
import type { ArenaInfo } from '~/composables/useCatalog'
import { drawField, drawScene } from '~/lib/arena/render'

/** The arena of one PDF page: hall and the paths of the range, horses where the range ends. */
const props = defineProps<{
  arena: ArenaInfo
  image: HTMLImageElement | null
  horses: readonly Horse[]
  timelines: ReadonlyMap<string, Timeline>
  gaits: readonly Gait[]
  range: TimeRange
}>()

// fixed drawing size (≈ the free area of an A4 landscape page), rendered at 3× for print
const DPR = 3
const vp = computed(() => canvasSize(props.arena, 1040, 540))
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const labels = useSceneLabels()

watchEffect(
  () => {
    const el = canvas.value
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const t = viewTransform(fitView(props.arena), props.arena, vp.value)
    drawField(ctx, { arena: props.arena, image: props.image, t, vp: vp.value, dpr: DPR })
    // drawScene clears its canvas, so the scene goes on a second one laid over the hall
    const layer = document.createElement('canvas')
    layer.width = el.width
    layer.height = el.height
    const lctx = layer.getContext('2d')
    if (!lctx) return
    drawScene(
      lctx,
      {
        horses: props.horses,
        timelines: props.timelines,
        gaits: props.gaits,
        // the sheet header names the part; the canvas badge would show the next one at range.end
        parts: [],
        activeId: null,
        time: props.range.end,
        showPaths: true,
        showNames: false,
        onlyHorses: false,
        labels: labels.value,
        ghost: null,
        splitHover: null,
        selection: [],
        handles: [],
        overlay: null,
        pastePreview: [],
        range: props.range,
      },
      t,
      vp.value,
      DPR,
    )
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(layer, 0, 0)
  },
  { flush: 'post' },
)
</script>

<template>
  <canvas
    ref="canvas"
    :width="Math.round(vp.width * DPR)"
    :height="Math.round(vp.height * DPR)"
    class="size-full min-h-0 object-contain"
    role="img"
    :aria-label="$t('editor.arena.canvas', horses.length)"
  />
</template>
