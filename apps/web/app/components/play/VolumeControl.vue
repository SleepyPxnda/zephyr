<script setup lang="ts">
import { Volume1, Volume2, VolumeX } from '@lucide/vue'

/** Music volume slider, shared by the editor timeline and the read-only player. */
const editor = useEditorStore()
function onVolume(v: number[] | undefined) {
  if (v?.[0] !== undefined) editor.volume = v[0]
}
</script>

<template>
  <label class="flex items-center gap-2" :title="$t('timeline.volume')">
    <VolumeX v-if="editor.volume === 0" class="size-4 text-muted-foreground" aria-hidden="true" />
    <Volume1
      v-else-if="editor.volume < 0.5"
      class="size-4 text-muted-foreground"
      aria-hidden="true"
    />
    <Volume2 v-else class="size-4 text-muted-foreground" aria-hidden="true" />
    <Slider
      class="w-20"
      :model-value="[editor.volume]"
      :min="0"
      :max="1"
      :step="0.05"
      :aria-label="$t('timeline.volume')"
      data-testid="volume"
      @update:model-value="onVolume"
    />
  </label>
</template>
