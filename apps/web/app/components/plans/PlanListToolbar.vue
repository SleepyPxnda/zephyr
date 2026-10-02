<script setup lang="ts">
import { Plus, Search, Upload } from '@lucide/vue'

const search = defineModel<string>('search', { required: true })
defineProps<{ busy: boolean }>()
const emit = defineEmits<{ create: []; import: [] }>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <div class="relative min-w-48 flex-1">
      <Search
        class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        v-model="search"
        type="search"
        class="pl-8"
        :aria-label="$t('plans.search')"
        :placeholder="$t('plans.search')"
      />
    </div>
    <Button :disabled="busy" data-testid="new-plan" @click="emit('create')"
      ><Plus />{{ $t('plans.new') }}</Button
    >
    <Button variant="secondary" @click="emit('import')"><Upload />{{ $t('plans.import') }}</Button>
  </div>
</template>
