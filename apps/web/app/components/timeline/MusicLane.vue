<script setup lang="ts">
import { waveColumns } from '@zephyr/core'
import { useDevicePixelRatio } from '@vueuse/core'
import { Replace, Upload } from '@lucide/vue'
import { LANE_HEADER_PX } from '~/composables/useTimelineEdit'
import type { Music } from '~/composables/useMusic'

/**
 * Music lane (SPEC "Zeitleiste"): upload, file name and the waveform as a canvas, drawn from the
 * server's peaks (prototype `drawWave`). Without music it says what to do; after an import from
 * the prototype it names the file that has to be uploaded again.
 */
const props = defineProps<{
  music: Music
  pps: number
  width: number
  editable: boolean
  /** music name from an imported prototype plan, shown until music is uploaded */
  importedName: string | null
  /** px the time axis is shifted left (focused part) */
  offset?: number
}>()

const HEIGHT = 56
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const input = useTemplateRef<HTMLInputElement>('input')
const { pixelRatio } = useDevicePixelRatio()

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
  const peaks = props.music.peaks.value
  if (!peaks) return
  const mid = HEIGHT / 2
  g.fillStyle = getComputedStyle(c).getPropertyValue('--primary').trim()
  g.globalAlpha = 0.85
  const cols = waveColumns(peaks.data, peaks.stepS, props.pps, w)
  for (let x = 0; x < cols.length; x++) {
    const h = Math.max(0.5, (cols[x] ?? 0) * (mid - 3))
    g.fillRect(x, mid - h, 1, h * 2)
  }
}
watch(() => [props.music.peaks.value, props.pps, props.width, pixelRatio.value], draw, {
  flush: 'post',
})
onMounted(draw)

const message = computed(() => {
  const s = props.music.status.value
  if (s === 'loading') return { key: 'music.loading', name: '' }
  if (s === 'error') return { key: 'music.loadFailed', name: '' }
  if (s === 'ready') return null
  return props.importedName
    ? { key: 'music.reupload', name: props.importedName }
    : { key: 'timeline.musicPlaceholder', name: '' }
})

function onFile(e: Event) {
  const el = e.target as HTMLInputElement
  const file = el.files?.[0]
  el.value = ''
  if (file) void props.music.upload(file)
}
</script>

<template>
  <div class="flex border-b">
    <div
      class="sticky left-0 z-10 flex shrink-0 items-center justify-between gap-1 border-r bg-card pr-1 pl-3"
      :style="{ width: `${LANE_HEADER_PX}px` }"
      data-lane-header
    >
      <span class="text-xs font-medium text-muted-foreground">{{ $t('timeline.music') }}</span>
      <template v-if="editable">
        <input
          ref="input"
          type="file"
          accept="audio/*"
          class="sr-only"
          tabindex="-1"
          aria-hidden="true"
          data-testid="music-file"
          @change="onFile"
        />
        <!-- once music is there, replacing it is rare: an icon is enough -->
        <Button
          v-if="music.status.value === 'ready' && !music.uploading.value"
          variant="ghost"
          size="icon-sm"
          class="size-7"
          :aria-label="$t('music.replace')"
          :title="`${$t('music.replace')} · ${$t('music.uploadHint')}`"
          @click="input?.click()"
        >
          <Replace />
        </Button>
        <Button
          v-else
          variant="ghost"
          size="sm"
          :disabled="music.uploading.value"
          :title="$t('music.uploadHint')"
          @click="input?.click()"
        >
          <Upload />
          {{ music.uploading.value ? $t('music.uploading') : $t('music.upload') }}
        </Button>
      </template>
    </div>
    <div
      class="relative h-14 shrink-0 touch-none"
      :style="{ width: `${width}px`, marginLeft: `${-(offset ?? 0)}px` }"
    >
      <canvas
        ref="canvas"
        class="pointer-events-none absolute top-0 left-0 block"
        :style="{ width: `${width}px`, height: `${HEIGHT}px` }"
        aria-hidden="true"
      />
      <!-- texts stay visible while scrolling -->
      <span
        v-if="music.uploadError.value"
        role="alert"
        class="sticky mt-1 ml-2 inline-block rounded bg-destructive px-1.5 text-xs text-destructive-foreground"
        :style="{ left: `${LANE_HEADER_PX + 8}px` }"
        >{{ $t(music.uploadError.value) }}</span
      >
      <span
        v-else-if="music.status.value === 'ready'"
        class="pointer-events-none sticky mt-1 ml-2 inline-block max-w-80 truncate rounded bg-card/80 px-1.5 text-xs text-muted-foreground"
        :style="{ left: `${LANE_HEADER_PX + 8}px` }"
        data-testid="music-name"
        >{{ music.name.value }}</span
      >
      <span
        v-else-if="message"
        class="pointer-events-none sticky mt-5 ml-3 inline-block text-xs text-muted-foreground"
        :style="{ left: `${LANE_HEADER_PX + 12}px` }"
        data-testid="music-message"
        >{{ $t(message.key, { name: message.name }) }}</span
      >
    </div>
  </div>
</template>
