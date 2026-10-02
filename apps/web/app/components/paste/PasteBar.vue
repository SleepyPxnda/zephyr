<script setup lang="ts">
import type { PasteLink, PasteTarget } from '@zephyr/core'

/** Paste options inside the tool bar (SPEC "PasteBar"): position, join, targets; Enter / Esc. */
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
  <div
    class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
    role="group"
    :aria-label="$t('paste.label')"
    data-testid="paste-bar"
  >
    <h2 class="max-w-80 truncate font-semibold" :title="title">{{ title }}</h2>
    <div class="flex items-center gap-1" role="group" :aria-label="$t('paste.position')">
      <span class="text-muted-foreground">{{ $t('paste.position') }}</span>
      <Button variant="ghost" size="sm" @click="emit('position', 'end')">{{
        $t('paste.atEnd')
      }}</Button>
      <Button variant="ghost" size="sm" @click="emit('position', 'orig')">{{
        $t('paste.atOrigin')
      }}</Button>
    </div>
    <div class="flex items-center gap-2">
      <span id="paste-link" class="text-muted-foreground">{{ $t('paste.link') }}</span>
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
      <span id="paste-target" class="text-muted-foreground">{{ $t('paste.target') }}</span>
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
    <div class="flex gap-1">
      <Button size="sm" data-testid="paste-confirm" @click="emit('confirm')">{{
        $t('paste.confirm')
      }}</Button>
      <Button variant="ghost" size="sm" @click="emit('cancel')">{{ $t('common.cancel') }}</Button>
    </div>
  </div>
</template>
