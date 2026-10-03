<script setup lang="ts">
import { ArrowLeft, Play, Share2 } from '@lucide/vue'
import type { PeerInfo } from '@zephyr/core'
import type { PlanRole, SaveStatus } from '~/stores/plan'

const props = defineProps<{
  planId: string
  title: string
  status: SaveStatus
  role: PlanRole | null
  editable: boolean
  peers: readonly PeerInfo[]
}>()
const emit = defineEmits<{ rename: [title: string] }>()
const shareOpen = shallowRef(false)

const statusVariant = computed(() =>
  props.status === 'offline' ? 'destructive' : props.status === 'saved' ? 'secondary' : 'outline',
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
    <PeerAvatars :peers="peers" />
    <div class="ml-auto flex items-center gap-2">
      <Button variant="ghost" size="sm" as-child>
        <NuxtLink :to="`/plans/${planId}/play`" data-testid="open-play">
          <Play />
          {{ $t('play.open') }}
        </NuxtLink>
      </Button>
      <Button
        v-if="role === 'owner'"
        variant="outline"
        size="sm"
        data-testid="share"
        @click="shareOpen = true"
      >
        <Share2 />
        {{ $t('share.open') }}
      </Button>
    </div>
    <ShareDialog v-if="role === 'owner'" v-model:open="shareOpen" :plan-id="planId" />
  </header>
</template>
