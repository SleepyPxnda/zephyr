<script setup lang="ts">
import type { Gait, Hand } from '@zephyr/core'
import type { Tool } from '~/stores/editor'

/** Zone 1, above the arena: tools, gait for new lines, volte options, + Halt/+ Pause, hint. */
defineProps<{
  gaits: readonly Gait[]
  drawGaitId: string | null
  editable: boolean
  canAnnounce: boolean
}>()
const tool = defineModel<Tool>('tool', { required: true })
const circle = defineModel<{ hand: Hand; half: boolean; snapDiameter: boolean }>('circle', {
  required: true,
})
const emit = defineEmits<{ drawGait: [id: string]; announce: [kind: 'halt' | 'pause'] }>()

const drawing = computed(() => tool.value !== 'select' && tool.value !== 'split')
</script>

<template>
  <div class="flex flex-col gap-2 rounded-lg border bg-card p-3">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <ToolBar v-model="tool" :disabled="!editable" />
      <GaitPicker
        v-if="drawing"
        :gaits="gaits"
        :model-value="drawGaitId"
        :disabled="!editable"
        @update:model-value="emit('drawGait', $event)"
      />
    </div>
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <NextGapButtons
        v-if="drawing"
        :disabled="!editable || !canAnnounce"
        @announce="emit('announce', $event)"
      />
      <CircleOptions v-if="tool === 'circle'" v-model="circle" />
    </div>
    <!-- fixed height, so the arena does not jump when the tool changes (SPEC) -->
    <p class="h-10 overflow-hidden text-sm leading-5 text-muted-foreground" aria-live="polite">
      {{ $t(`tools.hint.${tool}`) }}
    </p>
  </div>
</template>
