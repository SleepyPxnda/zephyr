<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { refPick, type ChatRef, type Horse, type Part } from '@zephyr/core'
import { keepMovedFocus } from '~/lib/utils'

/**
 * "An Chat senden" on arena or timeline (the default slot is the trigger). The page captures the
 * spot under the pointer (`capture`) before the menu opens; while open, the spot is marked on
 * the surface, and a chosen entry becomes the attachment of the chat input. Nothing is sent.
 */
const props = defineProps<{
  horses: readonly Horse[]
  parts: readonly Part[]
  /** a stroke, drag or paste is in progress: no menu */
  disabled?: boolean
}>()
const chat = useChatStore()
const editor = useEditorStore()

type Only = 'all' | 't' | 'pos'
const captured = shallowRef<ChatRef | null>(null)
const canPos = shallowRef(true)
const open = shallowRef(false)

function capture(ref: ChatRef, withPos: boolean) {
  captured.value = ref
  canPos.value = withPos
}
defineExpose({ capture })

const items = computed(() => {
  const c = captured.value
  if (!c) return []
  return (
    [
      ['all', 'chat.menu.sendSpot', true],
      ['t', 'chat.menu.sendTime', c.t !== null],
      ['pos', 'chat.menu.sendPos', canPos.value && c.pos !== null],
    ] as const
  ).map(([only, label, enabled]) => ({ only, label, enabled, ref: refPick(c, only) }))
})

function onOpen(o: boolean) {
  // a right click where nothing could be captured (lane headers, toolbar) opens nothing
  if (o && !captured.value) return
  open.value = o
  if (o && captured.value) editor.mark = { ref: captured.value, pulse: false }
  if (!o) {
    if (editor.mark && !editor.mark.pulse) editor.mark = null
    captured.value = null
  }
}
function preview(only: Only) {
  if (captured.value) editor.mark = { ref: refPick(captured.value, only), pulse: false }
}
function choose(only: Only) {
  if (captured.value) chat.attach(refPick(captured.value, only))
}

// Shift+F10 / the context menu key fire `contextmenu` on the focused element (often the body):
// open the menu where the mouse is instead, if that is over this trigger
const id = useId()
let last: { x: number; y: number } | null = null
useEventListener(
  window,
  'pointermove',
  (e: PointerEvent) => (last = { x: e.clientX, y: e.clientY }),
)
useEventListener(
  window,
  'contextmenu',
  (e: MouseEvent) => {
    if (!e.isTrusted || e.button === 2 || !last || props.disabled) return
    if (e.target instanceof Element && e.target.closest('[data-chat-spot]')) return
    const at = document.elementFromPoint(last.x, last.y)
    if (at?.closest('[data-chat-spot]')?.getAttribute('data-chat-spot') !== id) return
    e.preventDefault()
    e.stopPropagation()
    at.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: last.x,
        clientY: last.y,
        button: 2,
      }),
    )
  },
  { capture: true },
)
</script>

<template>
  <ContextMenu :open="open" @update:open="onOpen">
    <ContextMenuTrigger as-child :disabled="disabled" :data-chat-spot="id">
      <slot />
    </ContextMenuTrigger>
    <ContextMenuContent class="w-72" data-testid="chat-menu" @close-auto-focus="keepMovedFocus">
      <ContextMenuItem
        v-for="it in items"
        :key="it.only"
        class="flex-col items-start gap-1"
        :disabled="!it.enabled"
        @select="choose(it.only)"
        @pointerenter="it.enabled && preview(it.only)"
        @focus="preview(it.only)"
      >
        <span>{{ $t(it.label) }}</span>
        <ChatRefChip v-if="it.enabled" :value="it.ref" :horses="horses" :parts="parts" />
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
</template>
