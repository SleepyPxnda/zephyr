<script setup lang="ts">
import { X } from '@lucide/vue'
import { CHAT_MAX_CHARS, type Horse, type Part } from '@zephyr/core'

/** Draft with its attached spot; Enter sends, Shift+Enter breaks the line. */
defineProps<{ horses: readonly Horse[]; parts: readonly Part[] }>()
const chat = useChatStore()
const planStore = usePlanStore()
const box = useTemplateRef<HTMLElement>('box')

const locked = computed(() => !!chat.pending || !planStore.connected)
const focus = () => nextTick(() => box.value?.querySelector('textarea')?.focus())
watch(() => chat.focusInput, focus)
// the textarea was disabled while sending: give the focus back afterwards
watch(
  () => chat.pending,
  (p, was) => {
    if (!p && was) void focus()
  },
)

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return
  e.preventDefault()
  chat.send()
}
</script>

<template>
  <div ref="box" class="border-t p-3">
    <div v-if="chat.attachment" class="mb-2 flex items-center gap-1">
      <ChatRefChip :value="chat.attachment" :horses="horses" :parts="parts" class="min-w-0" />
      <Button
        variant="ghost"
        size="icon-xs"
        :aria-label="$t('chat.removeAttachment')"
        :disabled="!!chat.pending"
        @click="chat.attachment = null"
      >
        <X />
      </Button>
    </div>
    <Textarea
      v-model="chat.draft"
      class="max-h-32 min-h-9 resize-none"
      rows="1"
      :maxlength="CHAT_MAX_CHARS"
      :placeholder="$t('chat.placeholder')"
      :aria-label="$t('chat.placeholder')"
      :disabled="locked"
      data-testid="chat-input"
      @keydown="onKey"
    />
    <p
      v-if="chat.pending || chat.error || !planStore.connected"
      class="mt-1.5 text-xs text-muted-foreground"
      role="status"
    >
      {{
        chat.pending
          ? $t('chat.sending')
          : chat.error
            ? $t(`chat.error.${chat.error}`)
            : $t('chat.offline')
      }}
    </p>
  </div>
</template>
