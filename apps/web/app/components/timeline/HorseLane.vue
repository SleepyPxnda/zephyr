<script setup lang="ts">
import {
  effectiveTack,
  gaitOf,
  selKey,
  type Gait,
  type Horse,
  type LaneBlock,
  type Timeline,
  type Timing,
} from '@zephyr/core'
import { LANE_HEADER_PX } from '~/composables/useTimelineEdit'

/** One horse on the timeline: header (name, colour, saddle) and its sections and gaps. */
const props = defineProps<{
  horse: Horse
  blocks: readonly LaneBlock[]
  timeline: Timeline | null
  gaits: readonly Gait[]
  timing: Timing
  pps: number
  width: number
  active: boolean
  editable: boolean
  selection: readonly string[]
}>()
const emit = defineEmits<{
  select: []
  selectWhole: []
  update: [patch: Partial<Pick<Horse, 'name' | 'color' | 'tack'>>]
  clear: []
  remove: []
  key: [k: number, e: KeyboardEvent]
}>()

const { t, n } = useI18n()
const planStore = usePlanStore()
/** colours of the other people who work on this horse or selected one of its sections */
const horseMarks = computed(() => planStore.marks.horses.get(props.horse.id) ?? [])
const sectionMarks = (k: number) => planStore.marks.sections.get(selKey(props.horse.id, k)) ?? []
const { seconds, clock, duration: fmtDuration } = useFormat()
const duration = (v: number) => fmtDuration(v, props.timing)

const items = computed(() => {
  const h = props.horse
  const name = h.name || t('horse.defaultName', { number: h.number })
  return props.blocks.map((b) => {
    const s = h.path.sections[b.k]
    const gait = s && props.gaits.length ? gaitOf(props.gaits, s.gaitId) : null
    const sec = props.timeline?.secs[b.k]
    const tight = (sec?.tight ?? 0) > 0.05
    const bare = s ? !effectiveTack(s, h.tack) : false
    const selected = props.selection.includes(selKey(h.id, b.k))
    const dur = duration(b.b - b.a)
    const gapType = s?.gapType ?? 'halt'
    const gapLen = b.gap ? b.gap.b - b.gap.a : 0
    const link = !!s?.link
    const times = { name, k: b.k + 1, from: clock(b.a), to: clock(b.b) }
    return {
      ...b,
      gaitName: gait?.name ?? '',
      gaitColor: gait?.color ?? 'var(--muted)',
      tight,
      bare,
      selected,
      dur,
      link,
      label: [
        link
          ? t('timeline.linkLabel', times)
          : t('timeline.blockLabel', { ...times, gait: gait?.name ?? '' }),
        sec ? n(sec.dist, 'metres') : '',
        dur,
        bare ? t('timeline.bare') : '',
        tight ? t('timeline.tight') : '',
      ]
        .filter(Boolean)
        .join(' · '),
      gapType,
      gapText: `${t(`editor.arena.${gapType}`)} ${seconds(gapLen)}`,
      gapLabel: `${t(`editor.arena.${gapType}`)} · ${duration(gapLen)} · ${t(`timeline.${gapType}Hint`)}`,
    }
  })
})
/** wait before the first section: dashed line in the horse colour */
const wait = computed(() => props.horse.path.sections[0]?.gap ?? 0)
const endLabel = computed(() =>
  props.timeline && props.horse.path.pts.length
    ? t('timeline.end', {
        dist: n(props.timeline.dist, { maximumFractionDigits: 0 }) + ' m',
        time: clock(props.timeline.total),
      })
    : '',
)
</script>

<template>
  <div class="flex border-b" :data-testid="`lane-${horse.number}`">
    <div
      class="sticky left-0 z-10 shrink-0 border-r bg-card"
      :class="active ? 'bg-muted shadow-[inset_3px_0_0_var(--ring)]' : ''"
      :style="{ width: `${LANE_HEADER_PX}px` }"
      data-lane-header
    >
      <HorseLaneHeader
        :horse="horse"
        :active="active"
        :editable="editable"
        @select="emit('select')"
        @select-whole="emit('selectWhole')"
        @update="emit('update', $event)"
        @clear="emit('clear')"
        @remove="emit('remove')"
      />
      <span class="pointer-events-none absolute top-1 right-1 flex gap-0.5" aria-hidden="true">
        <span
          v-for="c in horseMarks"
          :key="c"
          class="size-2 rounded-full"
          :style="{ backgroundColor: c }"
        />
      </span>
    </div>
    <div
      class="relative h-14 shrink-0 touch-none"
      :style="{ width: `${width}px` }"
      :data-lane="horse.id"
    >
      <span
        v-if="!horse.path.pts.length"
        class="absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
        >{{ $t('timeline.noPath') }}</span
      >
      <div
        v-if="wait > 0"
        class="pointer-events-none absolute top-1/2 left-0 border-t-2 border-dashed opacity-55"
        :style="{ width: `${wait * pps}px`, borderColor: horse.color }"
        :title="$t('timeline.wait', { d: seconds(wait) })"
      />
      <template v-for="b in items" :key="b.k">
        <GapBlock
          v-if="b.gap && b.k > 0"
          :horse-id="horse.id"
          :k="b.k"
          :left="b.gap.a * pps"
          :width="(b.gap.b - b.gap.a) * pps"
          :type="b.gapType"
          :selected="b.selected"
          :text="b.gapText"
          :label="b.gapLabel"
        />
        <SectionBlock
          :horse-id="horse.id"
          :k="b.k"
          :left="b.a * pps"
          :width="Math.max(2, (b.b - b.a) * pps)"
          :gait-name="b.gaitName"
          :gait-color="b.gaitColor"
          :horse-color="horse.color"
          :bare="b.bare"
          :tight="b.tight"
          :selected="b.selected"
          :duration="b.dur"
          :link="b.link"
          :label="b.label"
          :peers="sectionMarks(b.k)"
          @key="emit('key', b.k, $event)"
        />
      </template>
      <span
        v-if="endLabel && timeline"
        class="pointer-events-none absolute top-1/2 -translate-y-1/2 text-xs whitespace-nowrap text-muted-foreground tabular-nums"
        :style="{ left: `${timeline.total * pps + 8}px` }"
        >{{ endLabel }}</span
      >
    </div>
  </div>
</template>
