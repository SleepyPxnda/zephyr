<script setup lang="ts">
import { rulerTicks, type Timing } from '@zephyr/core'
import { useDevicePixelRatio } from '@vueuse/core'

/** Time ruler as a canvas (prototype `drawRuler`): bar numbers with BPM, otherwise m:ss. */
const props = defineProps<{ timing: Timing; pps: number; span: number; width: number }>()

const HEIGHT = 28
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const { pixelRatio } = useDevicePixelRatio()
const { t } = useI18n()

const label = (v: number) =>
  props.timing.bpm ? String(v) : `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`

function draw() {
  const c = canvas.value
  if (!c) return
  const w = Math.max(1, props.width)
  // very long timelines: keep the canvas below the browser's size limit
  const r = Math.min(pixelRatio.value, 30000 / w)
  c.width = Math.round(w * r)
  c.height = Math.round(HEIGHT * r)
  const g = c.getContext('2d')
  if (!g) return
  g.setTransform(r, 0, 0, r, 0, 0)
  g.clearRect(0, 0, w, HEIGHT)
  const css = getComputedStyle(c)
  const muted = css.getPropertyValue('--muted-foreground').trim()
  const ink = css.getPropertyValue('--foreground').trim()
  g.font = '600 11px Inter, system-ui, sans-serif'
  g.textBaseline = 'top'
  for (const tick of rulerTicks(props.span, props.pps, props.timing)) {
    const x = Math.round(tick.t * props.pps)
    g.fillStyle = muted
    g.globalAlpha = tick.major ? 1 : 0.5
    if (tick.major) g.fillRect(x, 16, 1, 12)
    else g.fillRect(x, 22, 1, 6)
    g.globalAlpha = 1
    if (tick.label !== null) {
      g.fillStyle = ink
      g.fillText(label(tick.label), x + 3, 3)
    }
  }
  if (props.timing.bpm) {
    g.fillStyle = muted
    g.textAlign = 'right'
    g.fillText(t('timeline.barUnit'), w - 6, 3)
    g.textAlign = 'left'
  }
}

watch(() => [props.timing, props.pps, props.span, props.width, pixelRatio.value], draw, {
  flush: 'post',
})
onMounted(draw)
</script>

<template>
  <canvas
    ref="canvas"
    class="pointer-events-none absolute top-0 left-0 block"
    :style="{ width: `${width}px`, height: `${HEIGHT}px` }"
    aria-hidden="true"
  />
</template>
