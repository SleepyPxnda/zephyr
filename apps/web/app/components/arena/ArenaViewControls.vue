<script setup lang="ts">
import { Maximize, Minus, Plus } from '@lucide/vue'
import type { DisplayOptions } from '~/composables/useDisplayOptions'
import { injectArenaView } from '~/composables/arenaViewContext'

const options = defineModel<DisplayOptions>('options', { required: true })
const roundCorners = defineModel<boolean>('roundCorners', { required: true })

const view = injectArenaView()
const { t } = useI18n()

const toggles = computed(() => [
  { id: 'opt-paths', key: 'showPaths' as const, label: t('editor.view.showPaths') },
  { id: 'opt-names', key: 'showNames' as const, label: t('editor.view.showNames') },
  { id: 'opt-only', key: 'onlyHorses' as const, label: t('editor.view.onlyHorses') },
])
const setOption = (key: keyof DisplayOptions, value: boolean | 'indeterminate') =>
  (options.value = { ...options.value, [key]: value === true })
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
    <div class="flex items-center gap-1" role="group" :aria-label="$t('editor.view.zoom')">
      <Button
        variant="outline"
        size="icon"
        :aria-label="$t('editor.view.zoomOut')"
        @click="view.zoomOut()"
      >
        <Minus />
      </Button>
      <span class="w-14 text-center tabular-nums" aria-live="polite"
        >{{ view.zoomPercent.value }} %</span
      >
      <Button
        variant="outline"
        size="icon"
        :aria-label="$t('editor.view.zoomIn')"
        @click="view.zoomIn()"
      >
        <Plus />
      </Button>
      <Button variant="outline" size="sm" @click="view.fit()">
        <Maximize />
        {{ $t('editor.view.fit') }}
      </Button>
    </div>
    <div v-for="o in toggles" :key="o.id" class="flex items-center gap-2">
      <Checkbox
        :id="o.id"
        :model-value="options[o.key]"
        @update:model-value="setOption(o.key, $event)"
      />
      <Label :for="o.id">{{ o.label }}</Label>
    </div>
    <div class="flex items-center gap-2">
      <Checkbox
        id="opt-round"
        :model-value="roundCorners"
        @update:model-value="roundCorners = $event === true"
      />
      <Label for="opt-round">{{ $t('editor.view.roundCorners') }}</Label>
    </div>
  </div>
</template>
