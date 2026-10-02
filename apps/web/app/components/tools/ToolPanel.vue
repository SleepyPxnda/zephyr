<script setup lang="ts">
import type { Gait, Hand } from '@zephyr/core'
import { Undo2 } from '@lucide/vue'
import type { Tool } from '~/stores/editor'

/** Zone 1, above the arena: tools, gait for new lines, volte options, + Halt/+ Pause, undo, hint. */
defineProps<{
  gaits: readonly Gait[]
  drawGaitId: string | null
  editable: boolean
  canAnnounce: boolean
  canUndo: boolean
}>()
const tool = defineModel<Tool>('tool', { required: true })
const circle = defineModel<{ hand: Hand; half: boolean; snapDiameter: boolean }>('circle', {
  required: true,
})
const emit = defineEmits<{
  drawGait: [id: string]
  announce: [kind: 'halt' | 'pause']
  undo: []
}>()

const drawing = computed(() => tool.value !== 'select' && tool.value !== 'split')
</script>

<template>
  <div class="flex flex-col gap-2 rounded-lg border bg-card p-3">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <ToolBar v-model="tool" :disabled="!editable" />
      <!-- options that do not apply stay in place but invisible, so the arena never jumps (SPEC) -->
      <GaitPicker
        :class="{ invisible: !drawing }"
        :inert="!drawing"
        :gaits="gaits"
        :model-value="drawGaitId"
        :disabled="!editable"
        @update:model-value="emit('drawGait', $event)"
      />
      <Button
        class="ml-auto"
        variant="outline"
        size="sm"
        :disabled="!editable || !canUndo"
        data-testid="undo"
        @click="emit('undo')"
      >
        <Undo2 />
        {{ $t('tools.undo') }}
      </Button>
    </div>
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <NextGapButtons
        :class="{ invisible: !drawing }"
        :inert="!drawing"
        :disabled="!editable || !canAnnounce"
        @announce="emit('announce', $event)"
      />
      <CircleOptions
        :class="{ invisible: tool !== 'circle' }"
        :inert="tool !== 'circle'"
        v-model="circle"
      />
    </div>
    <!-- fixed height, so the arena does not jump when the tool changes (SPEC) -->
    <p class="h-10 overflow-hidden text-sm leading-5 text-muted-foreground" aria-live="polite">
      {{ $t(`tools.hint.${tool}`) }}
    </p>
  </div>
</template>
