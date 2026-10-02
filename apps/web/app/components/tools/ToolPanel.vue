<script setup lang="ts">
import type { Gait, Hand } from '@zephyr/core'
import { ChevronDown, ClipboardPaste, Copy, Undo2 } from '@lucide/vue'
import type { Tool } from '~/stores/editor'

/**
 * Zone 1, the bar above the arena (SPEC "Frontend"): tools, the tool's options as pop-outs,
 * copy / paste / undo on the right. While pasting, the `paste` slot replaces the tools.
 */
const props = defineProps<{
  gaits: readonly Gait[]
  drawGaitId: string | null
  editable: boolean
  canAnnounce: boolean
  canUndo: boolean
  canCopy: boolean
  canPaste: boolean
}>()
const tool = defineModel<Tool>('tool', { required: true })
const circle = defineModel<{ hand: Hand; half: boolean; snapDiameter: boolean }>('circle', {
  required: true,
})
const emit = defineEmits<{
  drawGait: [id: string]
  announce: [kind: 'halt' | 'pause']
  undo: []
  copy: []
  paste: []
}>()

const drawing = computed(() => tool.value !== 'select' && tool.value !== 'split')
const drawGait = computed(() => props.gaits.find((g) => g.id === props.drawGaitId) ?? null)

// short confirmation on the copy button, as in the prototype
const copied = shallowRef(false)
const resetCopied = useTimeoutFn(() => (copied.value = false), 1500, { immediate: false })
function onCopy() {
  emit('copy')
  copied.value = true
  resetCopied.start()
}
</script>

<template>
  <div
    class="flex min-h-12 flex-wrap items-center gap-x-2 gap-y-1 border-b px-2 py-1.5"
    role="toolbar"
    :aria-label="$t('tools.label')"
  >
    <slot name="paste">
      <ToolBar v-model="tool" :disabled="!editable" />
      <div class="mx-1 h-6 w-px bg-border" aria-hidden="true" />
      <!-- options that do not apply stay in place but invisible, so nothing jumps (SPEC) -->
      <Popover>
        <PopoverTrigger as-child>
          <Button
            variant="ghost"
            size="sm"
            :class="{ invisible: !drawing }"
            :inert="!drawing"
            :disabled="!editable"
            data-testid="gait-picker"
          >
            <span
              class="size-3 rounded-full border border-foreground/40"
              :style="{ backgroundColor: drawGait?.color }"
            />
            {{ drawGait?.name ?? $t('tools.newLinesIn') }}
            <ChevronDown class="opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" class="w-auto">
          <GaitPicker
            :gaits="gaits"
            :model-value="drawGaitId"
            :disabled="!editable"
            @update:model-value="emit('drawGait', $event)"
          />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger as-child>
          <Button
            variant="ghost"
            size="sm"
            :class="{ invisible: !drawing }"
            :inert="!drawing"
            :disabled="!editable || !canAnnounce"
          >
            {{ $t('tools.beforeNext') }}
            <ChevronDown class="opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" class="w-auto">
          <NextGapButtons
            :disabled="!editable || !canAnnounce"
            @announce="emit('announce', $event)"
          />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger as-child>
          <Button
            variant="ghost"
            size="sm"
            :class="{ invisible: tool !== 'circle' }"
            :inert="tool !== 'circle'"
            data-testid="circle-options"
          >
            {{ $t('tools.circleOptions.label') }}
            <ChevronDown class="opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" class="w-auto">
          <CircleOptions v-model="circle" />
        </PopoverContent>
      </Popover>
    </slot>
    <div class="ml-auto flex items-center gap-1">
      <Button variant="ghost" size="sm" :disabled="!canCopy" data-testid="copy" @click="onCopy">
        <Copy />
        <span class="hidden md:inline">{{
          copied ? $t('selection.copied') : $t('selection.copy')
        }}</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        :disabled="!editable || !canPaste"
        data-testid="paste"
        @click="emit('paste')"
      >
        <ClipboardPaste />
        <span class="hidden md:inline">{{ $t('tools.paste') }}</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        :disabled="!editable || !canUndo"
        data-testid="undo"
        @click="emit('undo')"
      >
        <Undo2 />
        <span class="hidden md:inline">{{ $t('tools.undo') }}</span>
      </Button>
    </div>
  </div>
</template>
