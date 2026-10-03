<script setup lang="ts">
import type { GapType } from '@zephyr/core'

/** The gap before a section (prototype `.gapz`): Halt striped, Pause dashed. */
defineProps<{
  horseId: string
  k: number
  left: number
  width: number
  type: GapType
  selected: boolean
  text: string
  label: string
}>()
</script>

<template>
  <div
    class="absolute top-4 bottom-4 flex cursor-pointer items-center overflow-hidden rounded px-1 text-[11px] leading-none whitespace-nowrap text-muted-foreground select-none"
    :class="[
      type === 'halt'
        ? 'border bg-[repeating-linear-gradient(135deg,var(--muted)_0_5px,var(--border)_5px_7px)]'
        : 'border-[1.5px] border-dashed border-muted-foreground',
      selected ? 'outline-2 outline-offset-1 outline-foreground' : '',
    ]"
    :style="{ left: `${left}px`, width: `${width}px` }"
    :title="label"
    :data-horse="horseId"
    :data-k="k"
    data-gap="true"
    data-testid="gap-block"
  >
    {{ text }}
  </div>
</template>
