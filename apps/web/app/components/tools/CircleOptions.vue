<script setup lang="ts">
import type { Hand } from '@zephyr/core'

/** Volte options: hand (by pointer side, left, right), whole or half, 0.5 m grid. */
const options = defineModel<{ hand: Hand; half: boolean; snapDiameter: boolean }>({
  required: true,
})

const setHand = (v: unknown) => {
  if (v === 'auto' || v === 'left' || v === 'right') options.value = { ...options.value, hand: v }
}
const setHalf = (v: unknown) => {
  if (v === 'whole' || v === 'half') options.value = { ...options.value, half: v === 'half' }
}
</script>

<template>
  <div class="flex flex-col items-start gap-3">
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      :model-value="options.hand"
      :aria-label="$t('tools.circleOptions.hand')"
      @update:model-value="setHand"
    >
      <ToggleGroupItem value="auto">{{ $t('tools.circleOptions.auto') }}</ToggleGroupItem>
      <ToggleGroupItem value="left">{{ $t('tools.circleOptions.left') }}</ToggleGroupItem>
      <ToggleGroupItem value="right">{{ $t('tools.circleOptions.right') }}</ToggleGroupItem>
    </ToggleGroup>
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      :model-value="options.half ? 'half' : 'whole'"
      :aria-label="$t('tools.circleOptions.size')"
      @update:model-value="setHalf"
    >
      <ToggleGroupItem value="whole">{{ $t('tools.circleOptions.whole') }}</ToggleGroupItem>
      <ToggleGroupItem value="half">{{ $t('tools.circleOptions.half') }}</ToggleGroupItem>
    </ToggleGroup>
    <div class="flex items-center gap-2 text-sm">
      <Checkbox
        id="circle-grid"
        :model-value="options.snapDiameter"
        @update:model-value="options = { ...options, snapDiameter: $event === true }"
      />
      <Label for="circle-grid">{{ $t('tools.circleOptions.grid') }}</Label>
    </div>
  </div>
</template>
