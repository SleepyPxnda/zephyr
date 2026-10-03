<script setup lang="ts">
import { LANE_HEADER_PX } from '~/composables/useTimelineEdit'

/** Music lane: waveform and upload follow with M9; until then a placeholder. */
defineProps<{ width: number }>()
</script>

<template>
  <div class="flex border-b">
    <div
      class="sticky left-0 z-10 flex shrink-0 items-center border-r bg-card px-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
      :style="{ width: `${LANE_HEADER_PX}px` }"
      data-lane-header
    >
      {{ $t('timeline.music') }}
    </div>
    <div class="relative h-14 shrink-0 touch-none" :style="{ width: `${width}px` }">
      <span class="absolute top-1/2 left-3 -translate-y-1/2 text-xs text-muted-foreground">{{
        $t('timeline.musicPlaceholder')
      }}</span>
    </div>
  </div>
</template>
