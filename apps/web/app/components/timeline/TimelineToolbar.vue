<script setup lang="ts">
import { bpmFromTaps, PLAYBACK_RATES, type Timing } from '@zephyr/core'
import {
  ChevronDown,
  Grid3x3,
  Magnet,
  Metronome,
  Pause,
  Play,
  Plus,
  SkipBack,
  ZoomIn,
} from '@lucide/vue'

/**
 * Bar above the timeline (SPEC "TimelineToolbar"), one row in four groups: transport (play/pause,
 * to the start, clock, tempo) · beat (summary; BPM, tap, meter and first beat in a popover) ·
 * snapping (beat, magnet) and zoom · "+ Pferd". "+ Part" sits in the parts lane header.
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
  addHorse: []
  toggle: []
  home: []
}>()

const { t, n } = useI18n()

function onRate(v: unknown) {
  const r = Number(v)
  if (PLAYBACK_RATES.some((x) => x === r)) rate.value = r
}

const { clock: fmtClock } = useFormat()
const now = computed(() => fmtClock(props.time))
const total = computed(() => fmtClock(props.end))

const beatSummary = computed(() =>
  props.timing.bpm
    ? t('timeline.beatSummary', { bpm: n(props.timing.bpm), meter: props.timing.meter })
    : t('timeline.beatSetup'),
)

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
/** "on" must be clearly visible; aria-pressed, as the tooltip trigger takes over data-state */
const toggleOn = 'aria-pressed:bg-primary/15 aria-pressed:text-primary'
const onZoom = (v: number[] | undefined) => {
  if (v?.[0] !== undefined) zoom.value = v[0]
}
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <div
      class="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-1.5 text-sm"
      role="toolbar"
      :aria-label="$t('timeline.toolbar')"
    >
      <!-- transport -->
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
        <span class="px-2 tabular-nums" aria-live="off" data-testid="clock"
          >{{ now }} <span class="text-muted-foreground">/ {{ total }}</span></span
        >
        <Select :model-value="String(rate)" @update:model-value="onRate">
          <SelectTrigger
            class="w-[4.5rem]"
            size="sm"
            :aria-label="$t('timeline.rate')"
            :title="$t('timeline.rate')"
            data-testid="rate"
            ><SelectValue
          /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="r in PLAYBACK_RATES" :key="r" :value="String(r)"
              >{{ $n(r) }}×</SelectItem
            >
          </SelectContent>
        </Select>
      </div>

      <div class="h-6 w-px bg-border" aria-hidden="true" />

      <!-- beat: summary, details in a popover -->
      <Popover>
        <PopoverTrigger as-child>
          <Button variant="ghost" size="sm" :title="$t('timeline.beatHint')" data-testid="beat">
            <Metronome />
            <span :class="timing.bpm ? 'tabular-nums' : 'text-muted-foreground'">{{
              beatSummary
            }}</span>
            <ChevronDown class="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" class="w-72">
          <div class="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2.5 text-sm">
            <h3 class="col-span-2 font-semibold">{{ $t('timeline.beatTitle') }}</h3>
            <Label for="tl-bpm" class="whitespace-nowrap text-muted-foreground">{{
              $t('timeline.bpm')
            }}</Label>
            <div class="flex items-center gap-1">
              <Input
                id="tl-bpm"
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
              <Button variant="outline" size="sm" :disabled="!editable" @click="tap">
                {{
                  taps.length && taps.length < 3
                    ? $t('timeline.tapCount', { n: taps.length })
                    : $t('timeline.tap')
                }}
              </Button>
            </div>
            <span class="text-muted-foreground">{{ $t('timeline.meter') }}</span>
            <Select
              :model-value="String(timing.meter)"
              :disabled="!editable"
              @update:model-value="onMeter"
            >
              <SelectTrigger class="w-20" size="sm" :aria-label="$t('timeline.meter')"
                ><SelectValue
              /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3/4</SelectItem>
                <SelectItem value="4">4/4</SelectItem>
              </SelectContent>
            </Select>
            <Label for="tl-beat0" class="whitespace-nowrap text-muted-foreground">{{
              $t('timeline.beat0')
            }}</Label>
            <div class="flex items-center gap-1">
              <Input
                id="tl-beat0"
                v-model="beat0Text"
                type="number"
                class="h-8 w-20"
                min="0"
                step="0.05"
                :disabled="!editable"
                @change="onBeat0"
              />
              <span class="text-muted-foreground">s</span>
              <Button
                variant="outline"
                size="sm"
                :disabled="!editable"
                :title="$t('timeline.beatHereHint')"
                @click="beatHere"
                >{{ $t('timeline.beatHere') }}</Button
              >
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <div class="h-6 w-px bg-border" aria-hidden="true" />

      <!-- snapping -->
      <div class="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger as-child>
            <Toggle
              v-model="snapBeat"
              size="sm"
              :class="toggleOn"
              :aria-label="$t('timeline.snapBeat')"
              data-testid="snap-beat"
            >
              <Grid3x3 />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>{{ $t('timeline.snapBeat') }}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <Toggle
              v-model="magnet"
              size="sm"
              :class="toggleOn"
              :aria-label="$t('timeline.magnet')"
              data-testid="magnet"
            >
              <Magnet />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent class="max-w-72">
            <b>{{ $t('timeline.magnet') }}</b> · {{ $t('timeline.magnetHint') }}
          </TooltipContent>
        </Tooltip>
      </div>

      <label class="flex items-center gap-2" :title="$t('timeline.zoom')">
        <ZoomIn class="size-4 text-muted-foreground" aria-hidden="true" />
        <Slider
          class="w-24"
          :model-value="[zoom]"
          :min="6"
          :max="90"
          :step="1"
          :aria-label="$t('timeline.zoom')"
          @update:model-value="onZoom"
        />
      </label>

      <Button
        class="ml-auto"
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
  </TooltipProvider>
</template>
