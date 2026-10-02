<script setup lang="ts">
import { Plus } from '@lucide/vue'
import type { Horse } from '@zephyr/core'

defineProps<{ horses: readonly Horse[]; activeId: string | null; editable: boolean }>()
const emit = defineEmits<{
  select: [id: string]
  add: []
  update: [id: string, patch: Partial<Pick<Horse, 'name' | 'color' | 'tack'>>]
  clear: [id: string]
  remove: [id: string]
}>()
</script>

<template>
  <section class="flex flex-col gap-2" :aria-label="$t('editor.lanes.label')">
    <p v-if="!horses.length" class="text-sm text-muted-foreground">
      {{ $t('editor.lanes.empty') }}
    </p>
    <HorseLaneHeader
      v-for="h in horses"
      :key="h.id"
      :horse="h"
      :active="h.id === activeId"
      :editable="editable"
      @select="emit('select', h.id)"
      @update="emit('update', h.id, $event)"
      @clear="emit('clear', h.id)"
      @remove="emit('remove', h.id)"
    />
    <div v-if="editable">
      <Button variant="secondary" size="sm" data-testid="add-horse" @click="emit('add')">
        <Plus />
        {{ $t('editor.lanes.add') }}
      </Button>
    </div>
  </section>
</template>
