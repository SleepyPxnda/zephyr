<script setup lang="ts">
import { peerColor, type PeerInfo } from '@zephyr/core'

/** Who is in the plan right now (one avatar per person, even with several tabs). */
const props = defineProps<{ peers: readonly PeerInfo[] }>()
const MAX = 5

const people = computed(() => {
  const byUser = new Map<string, PeerInfo>()
  for (const p of props.peers) if (!byUser.has(p.userId)) byUser.set(p.userId, p)
  return [...byUser.values()]
})
const shown = computed(() => people.value.slice(0, MAX))
const more = computed(() => Math.max(0, people.value.length - MAX))
const initial = (name: string) => name.trim().charAt(0).toUpperCase()
</script>

<template>
  <ul
    v-if="people.length"
    class="flex items-center -space-x-2"
    :aria-label="$t('editor.peers', { names: people.map((p) => p.name).join(', ') })"
    data-testid="peer-avatars"
  >
    <li v-for="p in shown" :key="p.userId" :title="p.name">
      <Avatar class="size-7 border-2" :style="{ borderColor: peerColor(p.userId) }">
        <AvatarImage v-if="p.avatarUrl" :src="p.avatarUrl" :alt="p.name" />
        <AvatarFallback class="text-xs">{{ initial(p.name) }}</AvatarFallback>
      </Avatar>
    </li>
    <li v-if="more" class="pl-3 text-xs text-muted-foreground">+{{ more }}</li>
  </ul>
</template>
