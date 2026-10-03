<script setup lang="ts">
import { PLAYBACK_RATES, type Part } from '@zephyr/core'
import { Pause, Play, SkipBack } from '@lucide/vue'

/** Transport of the read-only view: play/pause, start, clock, seek bar with part bands, tempo. */
const props = defineProps<{
  time: number
  end: number
  playing: boolean
  parts: readonly Part[]
}>()
const rate = defineModel<number>('rate', { required: true })
const emit = defineEmits<{ toggle: []; seek: [t: number] }>()

const { clock } = useFormat()
const position = computed(() => [Math.min(props.time, props.end)])
function onSeek(v: number[] | undefined) {
  if (v?.[0] !== undefined) emit('seek', v[0])
}
function onRate(v: unknown) {
  const r = Number(v)
  if (PLAYBACK_RATES.some((x) => x === r)) rate.value = r
}
const bands = computed(() =>
  props.end > 0
    ? props.parts.map((p) => ({
        part: p,
        left: `${(Math.min(p.start, props.end) / props.end) * 100}%`,
        width: `${((Math.min(p.end, props.end) - Math.min(p.start, props.end)) / props.end) * 100}%`,
      }))
    : [],
)
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-x-3 gap-y-2 border-t px-3 py-2 text-sm"
    role="toolbar"
    :aria-label="$t('play.transport')"
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
        @click="emit('seek', 0)"
      >
        <SkipBack />
      </Button>
      <span class="px-2 tabular-nums" data-testid="clock"
        >{{ clock(time) }} <span class="text-muted-foreground">/ {{ clock(end) }}</span></span
      >
    </div>
    <div class="flex min-w-48 flex-1 flex-col gap-1">
      <!-- parts as bands above the seek bar; a click jumps to the part's start -->
      <div class="relative h-5">
        <button
          v-for="b in bands"
          :key="b.part.id"
          type="button"
          class="absolute inset-y-0 truncate rounded-sm border px-1 text-left text-xs text-foreground"
          :style="{
            left: b.left,
            width: b.width,
            backgroundColor: `${b.part.color}55`,
            borderColor: b.part.color,
          }"
          :title="b.part.name"
          @click="emit('seek', b.part.start)"
        >
          {{ b.part.name }}
        </button>
      </div>
      <Slider
        :model-value="position"
        :min="0"
        :max="Math.max(end, 0.1)"
        :step="0.1"
        :disabled="end <= 0"
        :aria-label="$t('play.position')"
        @update:model-value="onSeek"
      />
    </div>
    <Select :model-value="String(rate)" @update:model-value="onRate">
      <SelectTrigger
        class="w-[4.5rem]"
        size="sm"
        :aria-label="$t('timeline.rate')"
        :title="$t('timeline.rate')"
        ><SelectValue
      /></SelectTrigger>
      <SelectContent>
        <SelectItem v-for="r in PLAYBACK_RATES" :key="r" :value="String(r)"
          >{{ $n(r) }}×</SelectItem
        >
      </SelectContent>
    </Select>
  </div>
</template>
