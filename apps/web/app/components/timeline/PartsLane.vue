<script setup lang="ts">
import type { Part, Timing } from '@zephyr/core'
import { Plus } from '@lucide/vue'
import { LANE_HEADER_PX } from '~/composables/useTimelineEdit'

/**
 * Parts lane (prototype `partsTrack`): drag on empty space draws a part, drag a part moves it,
 * its edges resize it. The selected part opens the part editor beside it.
 */
const props = defineProps<{
  parts: readonly Part[]
  timing: Timing
  pps: number
  width: number
  selectedId: string | null
  editable: boolean
}>()
const emit = defineEmits<{
  close: []
  update: [id: string, patch: Partial<Pick<Part, 'name' | 'color'>>]
  times: [id: string, start: number, end: number]
  go: [id: string]
  remove: [id: string]
  key: [id: string, e: KeyboardEvent]
  add: []
}>()

const { clock: fmtClock } = useFormat()
const title = (p: Part) => `${p.name} · ${fmtClock(p.start)} – ${fmtClock(p.end)}`
const onOpen = (open: boolean) => {
  if (!open) emit('close')
}
// clicks on other parts or the lanes must not count as "outside" closes of a fresh selection
const keepOpen = (e: Event) => {
  if ((e.target as HTMLElement | null)?.closest?.('[data-part]')) e.preventDefault()
}
const selected = computed(() => props.parts.find((p) => p.id === props.selectedId) ?? null)
</script>

<template>
  <div class="flex border-b">
    <div
      class="sticky left-0 z-10 flex shrink-0 items-center justify-between border-r bg-card pr-1 pl-3 text-xs font-medium text-muted-foreground"
      :style="{ width: `${LANE_HEADER_PX}px` }"
      data-lane-header
    >
      {{ $t('timeline.parts.label') }}
      <Button
        v-if="editable"
        variant="ghost"
        size="icon-sm"
        class="size-7"
        :aria-label="$t('timeline.parts.addHint')"
        :title="$t('timeline.parts.addHint')"
        data-testid="add-part"
        @click="emit('add')"
      >
        <Plus />
      </Button>
    </div>
    <div
      class="relative h-9 shrink-0 cursor-crosshair touch-none"
      :style="{ width: `${width}px` }"
      data-parts-lane
    >
      <span
        v-if="!parts.length"
        class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-muted-foreground"
        >{{ $t('timeline.parts.hint') }}</span
      >
      <Popover :open="!!selected" @update:open="onOpen">
        <div
          v-for="p in parts"
          :key="p.id"
          class="absolute top-1 bottom-1 z-[1] cursor-grab overflow-hidden rounded-[5px] border px-2.5 text-xs leading-[26px] text-ellipsis whitespace-nowrap select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          :class="p.id === selectedId ? 'outline-2 outline-offset-1 outline-foreground' : ''"
          :style="{
            left: `${p.start * pps}px`,
            width: `${Math.max(6, (p.end - p.start) * pps)}px`,
            borderColor: p.color,
            backgroundColor: `color-mix(in srgb, ${p.color} 32%, var(--card))`,
          }"
          role="button"
          tabindex="0"
          :aria-label="title(p)"
          :title="title(p)"
          :data-part="p.id"
          data-testid="part-block"
          @keydown="emit('key', p.id, $event)"
        >
          <span class="absolute inset-y-0 left-0 w-2 cursor-ew-resize" data-edge="start" />
          <b class="font-semibold">{{ p.name }}</b>
          <span class="absolute inset-y-0 right-0 w-2 cursor-ew-resize" data-edge="end" />
        </div>
        <!-- the editor is anchored to the selected part -->
        <PopoverAnchor
          v-if="selected"
          class="pointer-events-none absolute top-0 bottom-0"
          :style="{
            left: `${selected.start * pps}px`,
            width: `${Math.max(6, (selected.end - selected.start) * pps)}px`,
          }"
        />
        <PopoverContent
          v-if="selected"
          align="start"
          class="w-72"
          @interact-outside="keepOpen"
          @open-auto-focus.prevent
        >
          <PartEditor
            :part="selected"
            :timing="timing"
            :editable="editable"
            @update="emit('update', selected.id, $event)"
            @times="(a, b) => emit('times', selected!.id, a, b)"
            @go="emit('go', selected.id)"
            @remove="emit('remove', selected.id)"
            @close="emit('close')"
          />
        </PopoverContent>
      </Popover>
    </div>
  </div>
</template>
