<script setup lang="ts">
import {
  canvasSize,
  fitView,
  viewTransform,
  type Gait,
  type Horse,
  type Part,
  type Timeline,
} from '@zephyr/core'
import { Circle, Download, Square } from '@lucide/vue'
import type { ArenaInfo } from '~/composables/useCatalog'
import { decodeAudio } from '~/composables/useMusic'
import { drawField, drawScene } from '~/lib/arena/render'

/**
 * Video of the whole plan with its music (plan M15): the arena is drawn frame by frame as in
 * playback, `MediaRecorder` records canvas and music in real time. MP4 where the browser can
 * (Chrome, Edge, Safari), WebM otherwise. Nothing is stored on the server.
 */
const props = defineProps<{
  planId: string
  title: string
  arena: ArenaInfo
  image: HTMLImageElement | null
  horses: readonly Horse[]
  timelines: ReadonlyMap<string, Timeline>
  gaits: readonly Gait[]
  parts: readonly Part[]
  /** end of paths and parts; the music may run longer */
  planEnd: number
}>()

const FPS = 30
const TYPES = [
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm',
]
// rendered in the browser only: the export page loads its data client-side
const mime =
  TYPES.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ??
  null
const ext = mime?.startsWith('video/mp4') ? 'mp4' : 'webm'

// even pixel sizes: H.264 encoders reject odd ones
const vp = computed(() => {
  const s = canvasSize(props.arena, 1280, 720)
  return { width: Math.round(s.width / 2) * 2, height: Math.round(s.height / 2) * 2 }
})
const canvas = useTemplateRef<HTMLCanvasElement>('canvas')
const labels = useSceneLabels()
const { clock } = useFormat()

const state = shallowRef<'idle' | 'preparing' | 'recording' | 'done' | 'error'>('idle')
const now = shallowRef(0)
const end = shallowRef(props.planEnd)
const url = shallowRef<string | null>(null)
/** the music could not be loaded: recorded without sound */
const silent = shallowRef(false)
const fileName = computed(
  () => `${props.title.replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'zephyr'}.${ext}`,
)

function draw(t: number) {
  const el = canvas.value
  const ctx = el?.getContext('2d')
  if (!el || !ctx) return
  const tr = viewTransform(fitView(props.arena), props.arena, vp.value)
  drawField(ctx, { arena: props.arena, image: props.image, t: tr, vp: vp.value, dpr: 1 })
  // drawScene clears its canvas, so the scene goes on a second one laid over the hall
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
      parts: props.parts,
      activeId: null,
      time: t,
      showPaths: true,
      showNames: true,
      onlyHorses: false,
      labels: labels.value,
      ghost: null,
      splitHover: null,
      selection: [],
      handles: [],
      overlay: null,
      pastePreview: [],
    },
    tr,
    vp.value,
    1,
  )
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.drawImage(layer, 0, 0)
}
const layer = document.createElement('canvas')
// preview of the start while nothing is recorded
watchEffect(
  () => {
    if (state.value === 'idle') draw(0)
  },
  { flush: 'post' },
)

let stop: (() => void) | null = null

async function record() {
  if (!mime || !canvas.value) return
  state.value = 'preparing'
  silent.value = false
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = null
  const ac = new AudioContext()
  try {
    // fresh signed address: the one from page load may have expired (5 minutes)
    const { music } = await $fetch<{ music: { url: string } | null }>(
      `/api/plans/${props.planId}/play`,
    )
    // without loadable music the paths are still worth a video (as in the read-only view)
    const buffer = music
      ? await decodeAudio(music.url).catch((e: unknown) => {
          console.error('[video] music loading failed', e)
          silent.value = true
          return null
        })
      : null
    end.value = Math.max(props.planEnd, buffer?.duration ?? 0)
    if (!(end.value > 0)) throw new Error('nothing to record')

    const stream = canvas.value.captureStream(FPS)
    let src: AudioBufferSourceNode | null = null
    if (buffer) {
      const dest = ac.createMediaStreamDestination()
      src = ac.createBufferSource()
      src.buffer = buffer
      src.connect(dest)
      for (const track of dest.stream.getAudioTracks()) stream.addTrack(track)
    }
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 })
    const chunks: Blob[] = []
    let cancelled = false
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.onstop = () => {
      stream.getTracks().forEach((tr) => tr.stop())
      void ac.close()
      if (cancelled) return void (state.value = 'idle')
      url.value = URL.createObjectURL(new Blob(chunks, { type: mime }))
      state.value = 'done'
    }

    await ac.resume()
    rec.start(1000)
    src?.start()
    const t0 = ac.currentTime
    state.value = 'recording'
    let frame = 0
    const tick = () => {
      const t = Math.min(ac.currentTime - t0, end.value)
      now.value = t
      draw(t)
      if (t >= end.value) return rec.stop()
      frame = requestAnimationFrame(tick)
    }
    stop = () => {
      cancelled = true
      cancelAnimationFrame(frame)
      src?.stop()
      rec.stop()
    }
    tick()
  } catch (e) {
    console.error('[video] recording failed', e)
    void ac.close()
    state.value = 'error'
  }
}

function cancel() {
  stop?.()
  stop = null
}

onBeforeUnmount(() => {
  cancel()
  if (url.value) URL.revokeObjectURL(url.value)
})
</script>

<template>
  <section
    class="flex w-full max-w-[297mm] flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground"
    :aria-label="$t('export.video.title')"
  >
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="font-semibold">{{ $t('export.video.title') }}</h2>
      <span class="text-sm text-muted-foreground">
        {{
          mime
            ? $t('export.video.hint', { format: ext.toUpperCase() })
            : $t('export.video.unsupported')
        }}
      </span>
      <div class="ml-auto flex items-center gap-2">
        <span
          v-if="state === 'recording'"
          class="text-sm tabular-nums"
          role="status"
          aria-live="off"
        >
          {{ clock(now) }} / {{ clock(end) }}
        </span>
        <Button v-if="state === 'recording'" variant="outline" size="sm" @click="cancel">
          <Square />
          {{ $t('export.video.cancel') }}
        </Button>
        <Button
          v-else
          size="sm"
          :disabled="!mime || state === 'preparing'"
          data-testid="record"
          @click="record"
        >
          <Circle />
          {{ state === 'preparing' ? $t('export.video.preparing') : $t('export.video.record') }}
        </Button>
        <Button v-if="url && state === 'done'" variant="outline" size="sm" as-child>
          <a :href="url" :download="fileName" data-testid="video-download">
            <Download />
            {{ $t('export.video.download', { format: ext.toUpperCase() }) }}
          </a>
        </Button>
      </div>
    </div>
    <p v-if="state === 'error'" class="text-sm" role="alert">{{ $t('export.video.failed') }}</p>
    <p v-else-if="silent" class="text-sm" role="status">{{ $t('export.video.silent') }}</p>
    <canvas
      ref="canvas"
      :width="vp.width"
      :height="vp.height"
      class="h-auto w-full rounded-md"
      role="img"
      :aria-label="$t('export.video.preview')"
    />
  </section>
</template>
