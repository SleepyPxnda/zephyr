<script setup lang="ts">
import { isLightColor } from '@zephyr/core'

/**
 * One section on a horse lane (prototype `.blk`): gait colour and name, duration (in bars with
 * BPM), horse colour along the bottom, a pattern without saddle, a red edge when too tight.
 * A focusable DOM element; dragging is handled by the timeline, arrow keys by the parent.
 */
const props = defineProps<{
  horseId: string
  k: number
  left: number
  width: number
  gaitName: string
  gaitColor: string
  horseColor: string
  bare: boolean
  tight: boolean
  selected: boolean
  duration: string
  /** automatic connecting line: thin and dashed, without text */
  link: boolean
  label: string
}>()
const emit = defineEmits<{ key: [e: KeyboardEvent] }>()

const ink = computed(() =>
  !props.gaitColor.startsWith('#') || isLightColor(props.gaitColor)
    ? 'text-foreground'
    : 'text-white',
)
</script>

<template>
  <div
    class="absolute overflow-hidden rounded-[5px] border text-xs leading-tight whitespace-nowrap select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    :class="[
      ink,
      link
        ? 'top-5 bottom-5 cursor-pointer border-dashed'
        : 'top-1.5 bottom-1.5 cursor-grab px-1.5 py-1',
      tight
        ? 'border-2 border-destructive'
        : link
          ? 'border-foreground/50'
          : 'border-foreground/20',
      selected ? 'z-[1] outline-2 outline-offset-1 outline-foreground' : '',
    ]"
    :style="{
      left: `${left}px`,
      width: `${width}px`,
      backgroundColor: link ? `color-mix(in srgb, ${gaitColor} 35%, transparent)` : gaitColor,
      boxShadow: link ? undefined : `inset 0 -4px 0 ${horseColor}`,
    }"
    role="button"
    tabindex="0"
    :aria-label="label"
    :aria-pressed="selected"
    :title="label"
    :data-horse="horseId"
    :data-k="k"
    :data-link="link || undefined"
    :data-testid="link ? 'link-block' : 'section-block'"
    @keydown="emit('key', $event)"
  >
    <!-- without saddle: diagonal stripes in the text colour (SPEC) -->
    <template v-if="!link">
      <span
        v-if="bare"
        class="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent_0_6px,color-mix(in_oklab,currentColor_22%,transparent)_6px_8px)]"
        aria-hidden="true"
      />
      <b class="relative block truncate font-semibold"
        ><span v-if="tight" class="text-destructive" aria-hidden="true">! </span>{{ gaitName }}</b
      >
      <span class="relative tabular-nums opacity-75">{{ duration }}</span>
    </template>
  </div>
</template>
