<script setup lang="ts">
import type { Gait } from '@zephyr/core'

/** "Neue Linien in": gait of new sections (plan setting `drawGaitId`). */
const props = defineProps<{
  gaits: readonly Gait[]
  modelValue: string | null
  disabled: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [id: string] }>()
const active = computed(() => props.gaits.filter((g) => !g.archivedAt))

function pick(v: unknown) {
  if (typeof v === 'string' && v) emit('update:modelValue', v)
}
</script>

<template>
  <div class="flex flex-col items-start gap-2">
    <span id="gait-picker-label" class="text-sm text-muted-foreground">{{
      $t('tools.newLinesIn')
    }}</span>
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      :model-value="modelValue ?? undefined"
      :disabled="disabled"
      aria-labelledby="gait-picker-label"
      @update:model-value="pick"
    >
      <ToggleGroupItem v-for="g in active" :key="g.id" :value="g.id">
        <span
          class="size-3 rounded-full border border-foreground/40"
          :style="{ backgroundColor: g.color }"
        />
        {{ g.name }}
      </ToggleGroupItem>
    </ToggleGroup>
  </div>
</template>
