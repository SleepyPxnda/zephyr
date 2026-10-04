<script setup lang="ts">
import { Circle, MousePointer2, Pencil, Scissors, Slash, Spline } from '@lucide/vue'
import type { Tool } from '~/stores/editor'

const tool = defineModel<Tool>({ required: true })
defineProps<{ disabled: boolean }>()

const TOOLS: { id: Tool; key: string; icon: typeof Pencil }[] = [
  { id: 'select', key: 'V', icon: MousePointer2 },
  { id: 'free', key: 'F', icon: Pencil },
  { id: 'line', key: 'G', icon: Slash },
  { id: 'arc', key: 'B', icon: Spline },
  { id: 'circle', key: 'Z', icon: Circle },
  { id: 'split', key: 'T', icon: Scissors },
]

function select(v: unknown) {
  const found = TOOLS.find((x) => x.id === v)
  if (found) tool.value = found.id
}
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <ToggleGroup
      type="single"
      :spacing="1"
      :model-value="tool"
      :disabled="disabled"
      :aria-label="$t('tools.label')"
      @update:model-value="select"
    >
      <Tooltip v-for="x in TOOLS" :key="x.id">
        <TooltipTrigger as-child>
          <ToggleGroupItem
            :value="x.id"
            :aria-label="`${$t(`tools.${x.id}`)} (${x.key})`"
            :data-testid="`tool-${x.id}`"
          >
            <component :is="x.icon" />
            <span class="hidden lg:inline">{{ $t(`tools.${x.id}`) }}</span>
          </ToggleGroupItem>
        </TooltipTrigger>
        <TooltipContent>{{ $t(`tools.${x.id}`) }} · {{ x.key }}</TooltipContent>
      </Tooltip>
    </ToggleGroup>
  </TooltipProvider>
</template>
