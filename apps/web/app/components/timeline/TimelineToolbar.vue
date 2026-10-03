<script setup lang="ts">
import { bpmFromTaps, PLAYBACK_RATES, type Timing } from '@zephyr/core'
import { Pause, Play, Plus, SkipBack } from '@lucide/vue'

/**
 * Bar above the timeline (SPEC "TimelineToolbar"): play/pause, to the start, tempo, zoom, beat
 * (BPM, tap, meter, first beat), snapping options, clock, "+ Part" and "+ Pferd".
 */
const props = defineProps<{
  timing: Timing
  time: number
  end: number
  editable: boolean
  playing: boolean
}>()
const rate = defineModel<number>('rate', { required: true })
const zoom = defineModel<number>('zoom', { required: true })
const snapBeat = defineModel<boolean>('snapBeat', { required: true })
const magnet = defineModel<boolean>('magnet', { required: true })
const emit = defineEmits<{
  timing: [patch: Partial<Timing>]
  addPart: []
  addHorse: []
  toggle: []
  home: []
}>()

function onRate(v: unknown) {
  const r = Number(v)
  if (PLAYBACK_RATES.some((x) => x === r)) rate.value = r
}

const { clock: fmtClock } = useFormat()
const clock = computed(() => `${fmtClock(props.time)} / ${fmtClock(props.end)}`)

// number fields keep their own text and apply it on change (Enter or leaving the field)
const bpmText = ref<string | number>('')
const beat0Text = ref<string | number>('')
watch(
  () => props.timing,
  (tm) => {
    bpmText.value = tm.bpm ? String(tm.bpm) : ''
    beat0Text.value = String(tm.beat0)
  },
  { immediate: true },
)
const parse = (v: string | number) => Number.parseFloat(String(v).replace(',', '.'))
function onBpm() {
  const v = parse(bpmText.value)
  emit('timing', { bpm: Number.isFinite(v) && v > 0 ? Math.min(260, Math.max(1, v)) : null })
}
function onBeat0() {
  const v = parse(beat0Text.value)
  if (Number.isFinite(v) && v >= 0) emit('timing', { beat0: Math.min(1e6, v) })
}
function onMeter(v: unknown) {
  if (v === '3' || v === '4') emit('timing', { meter: v === '3' ? 3 : 4 })
}
/** "= Position": the playhead becomes the first beat (rounded to 0.01 s, as in the prototype) */
const beatHere = () => emit('timing', { beat0: Math.round(props.time * 100) / 100 })

// tap tempo: taps more than 2 s apart start over; the last 12 count
const taps = shallowRef<number[]>([])
function tap() {
  const now = performance.now()
  const prev = taps.value.at(-1)
  const list = prev !== undefined && now - prev > 2000 ? [now] : [...taps.value, now].slice(-12)
  taps.value = list
  const bpm = bpmFromTaps(list)
  if (bpm) emit('timing', { bpm })
}
const onZoom = (v: number[] | undefined) => {
  if (v?.[0] !== undefined) zoom.value = v[0]
}
</script>

<template>
  <div
    class="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-1 border-b px-3 py-1.5 text-sm"
    role="toolbar"
    :aria-label="$t('timeline.toolbar')"
  >
    <div class="flex items-center gap-1">
      <Button
        size="icon-sm"
        :disabled="end <= 0"
        :aria-label="playing ? $t('timeline.pause') : $t('timeline.play')"
        :title="playing ? $t('timeline.pauseHint') : $t('timeline.playHint')"
        data-testid="play"
        @click="emit('toggle')"
      >
        <Pause v-if="playing" />
        <Play v-else />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        :aria-label="$t('timeline.home')"
        :title="$t('timeline.homeHint')"
        @click="emit('home')"
      >
        <SkipBack />
      </Button>
      <Select :model-value="String(rate)" @update:model-value="onRate">
        <SelectTrigger class="w-20" size="sm" :aria-label="$t('timeline.rate')" data-testid="rate"
          ><SelectValue
        /></SelectTrigger>
        <SelectContent>
          <SelectItem v-for="r in PLAYBACK_RATES" :key="r" :value="String(r)"
            >{{ $n(r) }}×</SelectItem
          >
        </SelectContent>
      </Select>
    </div>
    <label class="flex items-center gap-2">
      <span class="text-muted-foreground">{{ $t('timeline.zoom') }}</span>
      <Slider
        class="w-28"
        :model-value="[zoom]"
        :min="6"
        :max="90"
        :step="1"
        :aria-label="$t('timeline.zoom')"
        @update:model-value="onZoom"
      />
    </label>
    <div class="flex items-center gap-1">
      <label class="flex items-center gap-2">
        <span class="text-muted-foreground">{{ $t('timeline.bpm') }}</span>
        <Input
          v-model="bpmText"
          type="number"
          class="h-8 w-20"
          min="0"
          max="260"
          step="0.5"
          placeholder="–"
          :disabled="!editable"
          data-testid="bpm"
          @change="onBpm"
        />
      </label>
      <Button variant="ghost" size="sm" :disabled="!editable" @click="tap">
        {{
          taps.length && taps.length < 3
            ? $t('timeline.tapCount', { n: taps.length })
            : $t('timeline.tap')
        }}
      </Button>
    </div>
    <label class="flex items-center gap-2">
      <span class="text-muted-foreground">{{ $t('timeline.meter') }}</span>
      <Select
        :model-value="String(timing.meter)"
        :disabled="!editable"
        @update:model-value="onMeter"
      >
        <SelectTrigger class="w-20" size="sm"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="3">3/4</SelectItem>
          <SelectItem value="4">4/4</SelectItem>
        </SelectContent>
      </Select>
    </label>
    <div class="flex items-center gap-1">
      <label class="flex items-center gap-2">
        <span class="text-muted-foreground">{{ $t('timeline.beat0') }}</span>
        <Input
          v-model="beat0Text"
          type="number"
          class="h-8 w-20"
          min="0"
          step="0.05"
          :disabled="!editable"
          @change="onBeat0"
        />
        s
      </label>
      <Button
        variant="ghost"
        size="sm"
        :disabled="!editable"
        :title="$t('timeline.beatHereHint')"
        @click="beatHere"
        >{{ $t('timeline.beatHere') }}</Button
      >
    </div>
    <div class="flex items-center gap-2">
      <Checkbox
        id="tl-snap-beat"
        :model-value="snapBeat"
        @update:model-value="snapBeat = $event === true"
      />
      <Label for="tl-snap-beat">{{ $t('timeline.snapBeat') }}</Label>
    </div>
    <div class="flex items-center gap-2" :title="$t('timeline.magnetHint')">
      <Checkbox
        id="tl-magnet"
        :model-value="magnet"
        @update:model-value="magnet = $event === true"
      />
      <Label for="tl-magnet">{{ $t('timeline.magnet') }}</Label>
    </div>
    <div class="ml-auto flex items-center gap-2">
      <span class="tabular-nums" aria-live="off" data-testid="clock">{{ clock }}</span>
      <Button
        variant="ghost"
        size="sm"
        :disabled="!editable"
        data-testid="add-part"
        @click="emit('addPart')"
      >
        <Plus />
        {{ $t('timeline.parts.add') }}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        :disabled="!editable"
        data-testid="add-horse"
        @click="emit('addHorse')"
      >
        <Plus />
        {{ $t('editor.lanes.add') }}
      </Button>
    </div>
  </div>
</template>
