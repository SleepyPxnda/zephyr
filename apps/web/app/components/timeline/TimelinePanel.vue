<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { selKey, type Gait, type Horse } from '@zephyr/core'
import {
  LANE_HEADER_PX,
  type TimelineEdit,
  type TimelineTarget,
} from '~/composables/useTimelineEdit'
import type { Music } from '~/composables/useMusic'
import type { Playback } from '~/composables/usePlayback'

/**
 * Zone 3, the timeline (SPEC "Zeitleiste und Wiedergabe"): toolbar, ruler, parts, music and one
 * lane per horse, with part bands, the magnet's guide line and the playhead across all lanes.
 * Pointer events are read here once (target from the DOM) and handed to `useTimelineEdit`.
 */
const props = defineProps<{
  ctl: TimelineEdit
  playback: Playback
  music: Music
  gaits: readonly Gait[]
  editable: boolean
  /** music name of an imported prototype plan (hint until music is uploaded) */
  importedMusic: string | null
}>()
const emit = defineEmits<{
  addHorse: []
  selectWhole: [id: string]
  update: [id: string, patch: Partial<Pick<Horse, 'name' | 'color' | 'tack'>>]
  clear: [id: string]
  remove: [id: string]
}>()

const planStore = usePlanStore()
const editor = useEditorStore()

/** Height of the ruler and parts rows (incl. borders): part bands start below them. */
const BANDS_TOP = 29 + 37

const width = computed(() =>
  Math.min(30000, Math.round(props.ctl.span.value * props.ctl.pps.value)),
)
const x = (t: number) => LANE_HEADER_PX + t * props.ctl.pps.value

const zoom = computed({
  get: () => props.ctl.pps.value,
  set: (v: number) => planStore.setSettings({ timelineZoom: v }),
})
// zooming keeps the time at the left edge in place (prototype)
const scroller = useTemplateRef<HTMLElement>('scroller')
watch(
  () => props.ctl.pps.value,
  (now, before) => {
    const el = scroller.value
    if (el && before) el.scrollLeft = (el.scrollLeft / before) * now
  },
  { flush: 'post' },
)
// while playing, the playhead stays in view (prototype `updatePlayhead(true)`)
watch(
  () => editor.time,
  (t) => {
    const el = scroller.value
    if (!el || !props.playback.playing.value) return
    const left = t * props.ctl.pps.value
    const visible = el.clientWidth - LANE_HEADER_PX
    if (left > el.scrollLeft + visible - 40 || left < el.scrollLeft)
      el.scrollLeft = Math.max(0, left - 60)
  },
)

// ---------- pointer: read the target from the DOM, hand it on ----------
const content = useTemplateRef<HTMLElement>('content')
function targetOf(el: EventTarget | null): TimelineTarget | null {
  const node = el instanceof Element ? el : null
  if (!node || node.closest('[data-lane-header]')) return null
  const block = node.closest<HTMLElement>('[data-horse]')
  if (block?.dataset.horse && block.dataset.k)
    return { horseId: block.dataset.horse, k: Number(block.dataset.k), gap: !!block.dataset.gap }
  const part = node.closest<HTMLElement>('[data-part]')
  if (part?.dataset.part) {
    const edge = node.closest<HTMLElement>('[data-edge]')?.dataset.edge
    return {
      partId: part.dataset.part,
      edge: edge === 'start' || edge === 'end' ? edge : undefined,
    }
  }
  if (node.closest('[data-parts-lane]')) return { partsLane: true }
  return {}
}
let pointerTarget: TimelineTarget | null = null
/** pointer capture retargets the double click to the container, so the pressed target is kept */
let lastDown: TimelineTarget | null = null
function send(kind: 'down' | 'move' | 'up' | 'cancel', e: PointerEvent) {
  const el = content.value
  if (!el || !pointerTarget) return
  const t = (e.clientX - el.getBoundingClientRect().left - LANE_HEADER_PX) / props.ctl.pps.value
  // pointer capture keeps events on the container: the lane under the pointer is looked up
  const lane = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-lane]')
    ?.dataset.lane
  props.ctl.onPointer({
    kind,
    t,
    x: e.clientX,
    shift: e.shiftKey,
    alt: e.altKey,
    ctrl: e.ctrlKey || e.metaKey,
    lane,
    target: pointerTarget,
  })
}
// Esc cancels a drag before the editor's shortcuts see it
useEventListener(
  window,
  'keydown',
  (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !props.ctl.cancelDrag()) return
    pointerTarget = null
    e.stopImmediatePropagation()
    e.preventDefault()
  },
  { capture: true },
)
function onDown(e: PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  pointerTarget = targetOf(e.target)
  lastDown = pointerTarget
  if (!pointerTarget) return
  content.value?.setPointerCapture(e.pointerId)
  send('down', e)
}
const onMove = (e: PointerEvent) => send('move', e)
function onUp(e: PointerEvent) {
  send(e.type === 'pointercancel' ? 'cancel' : 'up', e)
  pointerTarget = null
}
function onDblclick() {
  if (lastDown?.horseId) props.ctl.selectWhole(lastDown.horseId)
}

// ---------- keyboard on blocks ----------
function onSectionKey(horseId: string, k: number, e: KeyboardEvent) {
  // while pasting, Enter confirms the paste (editor shortcut), also on a focused block
  if (e.key === 'Enter' && editor.paste.open) return
  if (e.key === 'Enter') {
    editor.activeHorseId = horseId
    editor.selectOnly(selKey(horseId, k))
    return e.preventDefault()
  }
  if (props.ctl.sectionKey(horseId, k, e.key, e.shiftKey, e.altKey)) e.preventDefault()
}
function onPartKey(id: string, e: KeyboardEvent) {
  if (e.key === 'Enter') {
    // the editor does not take the focus when opened by pointer; from the keyboard it does
    editor.partId = id
    e.preventDefault()
    return nextTick(() => document.querySelector<HTMLElement>('[data-testid=part-name]')?.focus())
  }
  if (props.ctl.partKey(id, e.key, e.altKey)) e.preventDefault()
}
function goToPart(id: string) {
  const p = props.ctl.parts.value.find((q) => q.id === id)
  if (p) props.ctl.seek(p.start)
}
</script>

<template>
  <section class="overflow-hidden rounded-lg border bg-card" :aria-label="$t('timeline.label')">
    <TimelineToolbar
      v-model:zoom="zoom"
      v-model:snap-beat="editor.snapBeat"
      v-model:magnet="editor.magnet"
      v-model:gap-fill="editor.gapFill"
      :rate="playback.rate.value"
      :timing="ctl.timing.value"
      :time="editor.time"
      :end="ctl.end.value"
      :editable="editable"
      :playing="playback.playing.value"
      @update:rate="playback.setRate"
      @toggle="playback.toggle"
      @home="ctl.seek(0)"
      @timing="planStore.setTiming"
      @add-horse="emit('addHorse')"
    />
    <div ref="scroller" class="relative overflow-x-auto overflow-y-hidden">
      <div
        ref="content"
        class="relative"
        :style="{ width: `${LANE_HEADER_PX + width}px` }"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
        @dblclick="onDblclick"
      >
        <!-- part bands across music and horse lanes -->
        <div
          v-for="p in ctl.parts.value"
          :key="p.id"
          class="pointer-events-none absolute bottom-0 border-x"
          :style="{
            top: `${BANDS_TOP}px`,
            left: `${x(p.start)}px`,
            width: `${Math.max(2, (p.end - p.start) * ctl.pps.value)}px`,
            backgroundColor: `color-mix(in srgb, ${p.color} 12%, transparent)`,
            borderColor: `color-mix(in srgb, ${p.color} 55%, transparent)`,
          }"
        />
        <div class="flex border-b">
          <div
            class="sticky left-0 z-10 shrink-0 border-r bg-card"
            :style="{ width: `${LANE_HEADER_PX}px` }"
            data-lane-header
          />
          <div
            class="relative h-7 shrink-0 cursor-text touch-none"
            :style="{ width: `${width}px` }"
          >
            <TimelineRuler
              :timing="ctl.timing.value"
              :pps="ctl.pps.value"
              :span="ctl.span.value"
              :width="width"
            />
          </div>
        </div>
        <PartsLane
          :parts="ctl.parts.value"
          :timing="ctl.timing.value"
          :pps="ctl.pps.value"
          :width="width"
          :selected-id="editor.partId"
          :editable="editable"
          @add="ctl.addPartAtPlayhead"
          @close="editor.partId = null"
          @update="ctl.updatePart"
          @times="ctl.setPartTimes"
          @go="goToPart"
          @remove="ctl.removePart"
          @key="onPartKey"
        />
        <MusicLane
          :music="music"
          :pps="ctl.pps.value"
          :width="width"
          :editable="editable"
          :imported-name="importedMusic"
        />
        <HorseLane
          v-for="h in ctl.horses.value"
          :key="h.id"
          :horse="h"
          :blocks="ctl.blocks.value.get(h.id) ?? []"
          :timeline="ctl.timelines.value.get(h.id) ?? null"
          :gaits="gaits"
          :timing="ctl.timing.value"
          :pps="ctl.pps.value"
          :width="width"
          :active="h.id === editor.activeHorseId"
          :editable="editable"
          :selection="editor.selection"
          @select="editor.activeHorseId = h.id"
          @select-whole="emit('selectWhole', h.id)"
          @update="emit('update', h.id, $event)"
          @clear="emit('clear', h.id)"
          @remove="emit('remove', h.id)"
          @key="(k, e) => onSectionKey(h.id, k, e)"
        />
        <p v-if="!ctl.horses.value.length" class="sticky left-0 p-3 text-sm text-muted-foreground">
          {{ $t('editor.lanes.empty') }}
        </p>
        <!-- magnet: guide line across all lanes with a hint -->
        <div
          v-if="ctl.guide.value"
          class="pointer-events-none absolute top-0 bottom-0 z-[6] w-px bg-primary"
          :style="{ left: `${x(ctl.guide.value.t)}px` }"
          data-testid="snap-guide"
        >
          <span
            class="absolute top-1 left-1.5 rounded bg-primary px-1.5 py-0.5 text-xs whitespace-nowrap text-primary-foreground shadow"
            >{{ ctl.guide.value.text }}</span
          >
        </div>
        <Playhead :left="x(editor.time)" />
      </div>
    </div>
  </section>
</template>
