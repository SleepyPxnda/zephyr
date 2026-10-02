<script setup lang="ts">
import type { PasteLink, PasteTarget } from '@zephyr/core'

/** Paste options (SPEC "PasteBar"): position, join, target horses; Enter confirms, Esc cancels. */
defineProps<{ title: string; multi: boolean }>()
const link = defineModel<PasteLink>('link', { required: true })
const target = defineModel<PasteTarget>('target', { required: true })
const emit = defineEmits<{ position: [kind: 'end' | 'orig']; confirm: []; cancel: [] }>()

const setLink = (v: unknown) => {
  if (v === 'line' || v === 'gap') link.value = v
}
const setTarget = (v: unknown) => {
  if (v === 'same' || v === 'from') target.value = v
}
</script>

<template>
  <section
    class="flex flex-col gap-3 rounded-lg border border-ring bg-card p-3"
    :aria-label="$t('paste.label')"
    data-testid="paste-bar"
  >
    <h2 class="font-semibold">{{ title }}</h2>
    <p class="text-sm text-muted-foreground">{{ $t('paste.hint') }}</p>
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <div class="flex items-center gap-1" role="group" :aria-label="$t('paste.position')">
        <span>{{ $t('paste.position') }}</span>
        <Button variant="outline" size="sm" @click="emit('position', 'end')">{{
          $t('paste.atEnd')
        }}</Button>
        <Button variant="outline" size="sm" @click="emit('position', 'orig')">{{
          $t('paste.atOrigin')
        }}</Button>
      </div>
      <div class="flex items-center gap-2">
        <span id="paste-link">{{ $t('paste.link') }}</span>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          :model-value="link"
          aria-labelledby="paste-link"
          @update:model-value="setLink"
        >
          <ToggleGroupItem value="line">{{ $t('paste.linkLine') }}</ToggleGroupItem>
          <ToggleGroupItem value="gap">{{ $t('paste.linkGap') }}</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div v-if="multi" class="flex items-center gap-2">
        <span id="paste-target">{{ $t('paste.target') }}</span>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          :model-value="target"
          aria-labelledby="paste-target"
          @update:model-value="setTarget"
        >
          <ToggleGroupItem value="same">{{ $t('paste.targetSame') }}</ToggleGroupItem>
          <ToggleGroupItem value="from">{{ $t('paste.targetFrom') }}</ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
    <div class="flex gap-2">
      <Button data-testid="paste-confirm" @click="emit('confirm')">{{
        $t('paste.confirm')
      }}</Button>
      <Button variant="outline" @click="emit('cancel')">{{ $t('common.cancel') }}</Button>
    </div>
  </section>
</template>
