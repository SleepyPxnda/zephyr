<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'
import type { PlanRole, SaveStatus } from '~/stores/plan'

const props = defineProps<{
  title: string
  status: SaveStatus
  role: PlanRole | null
  editable: boolean
}>()
const emit = defineEmits<{ rename: [title: string] }>()

const statusVariant = computed(() =>
  props.status === 'conflict' || props.status === 'error'
    ? 'destructive'
    : props.status === 'saved'
      ? 'secondary'
      : 'outline',
)
function onTitle(v: string | number) {
  const title = String(v).trim()
  if (title) emit('rename', title.slice(0, 200))
}
</script>

<template>
  <header class="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-2">
    <Button variant="ghost" size="icon" as-child>
      <NuxtLink to="/" :aria-label="$t('editor.back')"><ArrowLeft /></NuxtLink>
    </Button>
    <span class="font-brand text-xl font-bold">{{ $t('app.name') }}</span>
    <Input
      :model-value="title"
      class="h-9 max-w-md flex-1 font-medium"
      :aria-label="$t('editor.title')"
      :disabled="!editable"
      maxlength="200"
      @update:model-value="onTitle"
    />
    <Badge v-if="role === 'viewer'" variant="outline">{{ $t('roles.viewer') }}</Badge>
    <Badge :variant="statusVariant" role="status" aria-live="polite" data-testid="save-status">
      {{ $t(`editor.status.${status}`) }}
    </Badge>
  </header>
</template>
