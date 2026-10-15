<script setup lang="ts">
import { peerColor, type ChatMessage, type ChatRef, type Horse, type Part } from '@zephyr/core'

/** One message as in Discord: avatar, name and time only at the start of a group. */
defineProps<{
  message: ChatMessage
  head: boolean
  horses: readonly Horse[]
  parts: readonly Part[]
}>()
defineEmits<{ jump: [ref: ChatRef] }>()
const { locale } = useI18n()

const time = (ms: number) =>
  new Intl.DateTimeFormat(locale.value, { hour: '2-digit', minute: '2-digit' }).format(ms)
const initial = (name: string) => name.trim().charAt(0).toUpperCase()
</script>

<template>
  <li class="flex gap-2 px-3" :class="head ? 'mt-3' : 'mt-0.5'" data-testid="chat-message">
    <div class="w-8 shrink-0">
      <Avatar v-if="head" class="size-8">
        <AvatarImage v-if="message.avatarUrl" :src="message.avatarUrl" :alt="message.name" />
        <AvatarFallback class="text-xs">{{ initial(message.name) }}</AvatarFallback>
      </Avatar>
    </div>
    <div class="min-w-0 flex-1">
      <div v-if="head" class="flex items-baseline gap-2">
        <span class="truncate text-sm font-semibold" :style="{ color: peerColor(message.userId) }">
          {{ message.name }}
        </span>
        <time
          class="text-xs text-muted-foreground"
          :datetime="new Date(message.sentAt).toISOString()"
        >
          {{ time(message.sentAt) }}
        </time>
      </div>
      <ChatRefChip
        v-if="message.ref"
        class="my-0.5"
        :value="message.ref"
        :horses="horses"
        :parts="parts"
        interactive
        @activate="message.ref && $emit('jump', message.ref)"
      />
      <ChatText v-if="message.text" :text="message.text" :horses="horses" :parts="parts" />
    </div>
  </li>
</template>
