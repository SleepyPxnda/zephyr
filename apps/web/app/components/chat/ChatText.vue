<script setup lang="ts">
import { Clock } from '@lucide/vue'
import { chatTokens, type Horse, type Part } from '@zephyr/core'

/** Message text with horse and part names and times highlighted (never `v-html`). */
const props = defineProps<{ text: string; horses: readonly Horse[]; parts: readonly Part[] }>()

const tokens = computed(() => chatTokens(props.text, { horses: props.horses, parts: props.parts }))
const colorOf = (kind: 'horse' | 'part', id: string) =>
  (kind === 'horse' ? props.horses : props.parts).find((q) => q.id === id)?.color ?? 'transparent'
</script>

<template>
  <p class="text-sm break-words whitespace-pre-wrap">
    <template v-for="(tok, i) in tokens" :key="i">
      <span v-if="tok.kind === 'text'">{{ tok.s }}</span>
      <span v-else-if="tok.kind === 'time'" class="inline-flex items-baseline gap-0.5 font-mono"
        ><Clock class="size-3 self-center" aria-hidden="true" />{{ tok.s }}</span
      >
      <span
        v-else
        class="rounded px-1 font-medium"
        :style="{
          backgroundColor: `color-mix(in srgb, ${colorOf(tok.kind, tok.id)} 30%, transparent)`,
        }"
        >{{ tok.s }}</span
      >
    </template>
  </p>
</template>
