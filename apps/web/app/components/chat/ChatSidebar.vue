<script setup lang="ts">
import { MessageSquare, PanelRightClose } from '@lucide/vue'
import type { ChatRef, Horse, Part } from '@zephyr/core'

/**
 * Chat column at the right edge: a narrow rail with the unread badge when collapsed, the
 * message list and input when open. Below `lg` it floats over the editor.
 */
defineProps<{ horses: readonly Horse[]; parts: readonly Part[] }>()
defineEmits<{ jump: [ref: ChatRef] }>()
const chat = useChatStore()

/** a new header after another person or a pause of 5 minutes */
const GROUP_MS = 5 * 60_000
const items = computed(() =>
  chat.messages.map((m, i) => {
    const prev = chat.messages[i - 1]
    return { m, head: !prev || prev.userId !== m.userId || m.sentAt - prev.sentAt > GROUP_MS }
  }),
)

// follow new messages only while the list is scrolled to the bottom
const list = useTemplateRef<HTMLElement>('list')
let stuck = true
function onScroll() {
  const el = list.value
  if (el) stuck = el.scrollHeight - el.scrollTop - el.clientHeight < 24
}
const toBottom = () => {
  const el = list.value
  if (el) el.scrollTop = el.scrollHeight
}
watch(
  () => chat.messages,
  () => stuck && nextTick(toBottom),
)
watch(
  () => chat.open,
  (o) => {
    stuck = true
    if (o) void nextTick(toBottom)
  },
)
onMounted(toBottom)
</script>

<template>
  <aside
    v-if="!chat.open"
    class="fixed right-4 bottom-4 z-40 lg:sticky lg:top-0 lg:right-auto lg:bottom-auto lg:z-auto lg:flex lg:h-dvh lg:w-12 lg:shrink-0 lg:flex-col lg:items-center lg:border-l lg:bg-card lg:py-2"
    data-testid="chat-rail"
  >
    <Button
      variant="outline"
      size="icon-lg"
      class="relative rounded-full shadow-lg lg:size-9 lg:rounded-md lg:border-0 lg:shadow-none"
      :aria-label="chat.unread ? $t('chat.openUnread', { n: chat.unread }) : $t('chat.open')"
      @click="chat.open = true"
    >
      <MessageSquare />
      <Badge
        v-if="chat.unread"
        class="absolute -top-1.5 -right-1.5 min-w-5 px-1"
        data-testid="chat-unread"
        aria-hidden="true"
      >
        {{ chat.unread > 99 ? '99+' : chat.unread }}
      </Badge>
    </Button>
  </aside>
  <aside
    v-else
    class="fixed inset-y-0 right-0 z-40 flex w-80 max-w-full flex-col border-l bg-card shadow-lg lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:shrink-0 lg:shadow-none"
    :aria-label="$t('chat.title')"
    data-testid="chat-sidebar"
  >
    <header class="flex items-center gap-1 border-b px-3 py-2">
      <h2 class="flex-1 font-semibold">{{ $t('chat.title') }}</h2>
      <ChatHelp />
      <slot name="actions" />
      <Button
        variant="ghost"
        size="icon-sm"
        :aria-label="$t('chat.close')"
        @click="chat.open = false"
      >
        <PanelRightClose />
      </Button>
    </header>
    <ol
      ref="list"
      class="flex-1 overflow-y-auto pb-3"
      :aria-label="$t('chat.messages')"
      aria-live="polite"
      @scroll="onScroll"
    >
      <li v-if="!items.length" class="p-4 text-sm text-muted-foreground">{{ $t('chat.empty') }}</li>
      <ChatMessage
        v-for="{ m, head } in items"
        :key="m.peerId + m.nonce"
        :message="m"
        :head="head"
        :horses="horses"
        :parts="parts"
        @jump="$emit('jump', $event)"
      />
    </ol>
    <ChatInput :horses="horses" :parts="parts" />
  </aside>
</template>
