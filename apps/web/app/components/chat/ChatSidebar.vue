<script setup lang="ts">
import { ExternalLink, MessageSquare, PanelRightClose, PanelRightOpen } from '@lucide/vue'
import type { ChatRef, Horse, Part } from '@zephyr/core'

/**
 * Chat column at the right edge: a narrow rail with the unread badge when collapsed, the
 * message list and input when open. Below `lg` it floats over the editor; it can also live in
 * its own window (pop-out).
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
// popped out, the same panel is teleported into the other window (same store and socket)
const popout = useChatPopout()
function popin() {
  popout.close()
  chat.open = true
}
</script>

<template>
  <aside
    v-if="popout.target.value || !chat.open"
    class="fixed right-4 bottom-4 z-40 lg:sticky lg:top-0 lg:right-auto lg:bottom-auto lg:z-auto lg:flex lg:h-dvh lg:w-12 lg:shrink-0 lg:flex-col lg:items-center lg:border-l lg:bg-card lg:py-2"
    data-testid="chat-rail"
  >
    <Button
      variant="outline"
      size="icon-lg"
      class="relative rounded-full shadow-lg lg:size-9 lg:rounded-md lg:border-0 lg:shadow-none"
      :title="popout.target.value ? $t('chat.poppedOut') : undefined"
      :aria-label="
        popout.target.value
          ? `${$t('chat.poppedOut')} ${$t('chat.popin')}`
          : chat.unread
            ? $t('chat.openUnread', { n: chat.unread })
            : $t('chat.open')
      "
      @click="popout.target.value ? popin() : (chat.open = true)"
    >
      <PanelRightOpen v-if="popout.target.value" />
      <MessageSquare v-else />
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
  <Teleport :to="popout.target.value ?? 'body'" :disabled="!popout.target.value">
    <aside
      v-if="popout.target.value || chat.open"
      class="flex flex-col bg-card"
      :class="
        popout.target.value
          ? 'h-dvh'
          : 'fixed inset-y-0 right-0 z-40 w-80 max-w-full border-l shadow-lg lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:shrink-0 lg:shadow-none'
      "
      :aria-label="$t('chat.title')"
      data-testid="chat-sidebar"
    >
      <header class="flex items-center gap-1 border-b px-3 py-2">
        <h2 class="flex-1 font-semibold">{{ $t('chat.title') }}</h2>
        <ChatHelp :to="popout.target.value ?? undefined" />
        <Button
          v-if="popout.target.value"
          variant="ghost"
          size="icon-sm"
          :aria-label="$t('chat.popin')"
          :title="$t('chat.popin')"
          @click="popin"
        >
          <PanelRightOpen />
        </Button>
        <template v-else>
          <Button
            variant="ghost"
            size="icon-sm"
            :aria-label="$t('chat.popout')"
            :title="$t('chat.popout')"
            data-testid="chat-popout"
            @click="popout.open"
          >
            <ExternalLink />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            :aria-label="$t('chat.close')"
            :title="$t('chat.close')"
            @click="chat.open = false"
          >
            <PanelRightClose />
          </Button>
        </template>
      </header>
      <p v-if="popout.blocked.value" class="border-b px-3 py-2 text-xs" role="status">
        {{ $t('chat.popupBlocked') }}
      </p>
      <ol
        ref="list"
        class="flex-1 overflow-y-auto pb-3"
        :aria-label="$t('chat.messages')"
        aria-live="polite"
        @scroll="onScroll"
      >
        <li v-if="!items.length" class="p-4 text-sm text-muted-foreground">
          {{ $t('chat.empty') }}
        </li>
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
  </Teleport>
</template>
