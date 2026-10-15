<script setup lang="ts">
import type { ChatRef, Horse, Part } from '@zephyr/core'

/**
 * A spot attached to a message: horse (with section), part, time and position. Colours come
 * from the current plan by id; a horse or part that is gone is shown greyed with its sent name.
 * As a button it jumps to the spot (`activate`).
 */
const props = defineProps<{
  value: ChatRef
  horses: readonly Horse[]
  parts: readonly Part[]
  interactive?: boolean
}>()
defineEmits<{ activate: [] }>()
const { t, n } = useI18n()
const { clock } = useFormat()

const dec1 = (v: number) => n(v, { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const horse = computed(() => props.horses.find((h) => h.id === props.value.horse?.id) ?? null)
const part = computed(() => props.parts.find((p) => p.id === props.value.part?.id) ?? null)
const pos = computed(() =>
  props.value.pos
    ? t('chat.pos', { x: dec1(props.value.pos.x), y: dec1(props.value.pos.y) })
    : null,
)
const label = computed(() => {
  const r = props.value
  const what = [
    r.t !== null ? clock(r.t) : null,
    r.horse?.name,
    r.horse && r.horse.k !== null ? t('chat.section', { n: r.horse.k + 1 }) : null,
    r.part?.name,
    pos.value,
  ].filter(Boolean)
  return t('chat.jumpTo', { what: what.join(', ') })
})
</script>

<template>
  <component
    :is="interactive ? 'button' : 'span'"
    :type="interactive ? 'button' : undefined"
    :aria-label="interactive ? label : undefined"
    class="inline-flex max-w-full flex-wrap items-center gap-x-1.5 rounded-md border bg-muted/60 px-2 py-0.5 text-xs"
    :class="
      interactive &&
      'cursor-pointer hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none'
    "
    data-testid="chat-ref"
    @click="interactive && $emit('activate')"
  >
    <span
      v-if="value.horse"
      class="inline-flex items-center gap-1"
      :class="!horse && 'text-muted-foreground'"
    >
      <span
        class="size-2 rounded-full bg-muted-foreground"
        :style="horse ? { backgroundColor: horse.color } : undefined"
        aria-hidden="true"
      />
      {{ value.horse.name
      }}<template v-if="value.horse.k !== null"> #{{ value.horse.k + 1 }}</template>
    </span>
    <span
      v-if="value.part"
      class="inline-flex items-center gap-1"
      :class="!part && 'text-muted-foreground'"
    >
      <span
        class="size-2 rounded-sm bg-muted-foreground"
        :style="part ? { backgroundColor: part.color } : undefined"
        aria-hidden="true"
      />
      {{ value.part.name }}
    </span>
    <span v-if="value.t !== null" class="font-mono">{{ clock(value.t) }}</span>
    <span v-if="pos" class="text-muted-foreground">{{ pos }}</span>
  </component>
</template>
