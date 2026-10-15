import { chatRefSchema, type ChatMessage, type ChatRef } from '@zephyr/core'
import { useLocalStorage } from '@vueuse/core'

/** Messages kept in the list; older ones fall off (nothing is stored anywhere). */
const KEEP = 200
/** Without an echo the input is unlocked again after this time. */
const PENDING_MS = 5000

export type ChatError = 'rejected' | 'offline' | 'timeout'

/**
 * Chat of the open plan: messages since joining, the draft with its attached spot and the
 * unread count. The socket belongs to the plan store, which forwards `chat` / `chatReject`.
 */
export const useChatStore = defineStore('chat', () => {
  const messages = shallowRef<ChatMessage[]>([])
  const unread = shallowRef(0)
  /** sidebar open, a convenience per person in this browser */
  const open = useLocalStorage('zephyr-chat-open', true)
  const draft = shallowRef('')
  const attachment = shallowRef<ChatRef | null>(null)
  /** nonce of the message on its way; the input is locked until its echo */
  const pending = shallowRef<string | null>(null)
  const error = shallowRef<ChatError | null>(null)
  /** bumped to move the focus into the input */
  const focusInput = shallowRef(0)
  /** the chat lives in its own window (`useChatPopout`) */
  const popout = shallowRef<Window | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined

  const visible = () => (popout.value ? !popout.value.document.hidden : open.value)

  function settle(err: ChatError | null) {
    clearTimeout(timer)
    pending.value = null
    error.value = err
  }

  function send() {
    const text = draft.value.trim()
    if (pending.value || (!text && !attachment.value)) return
    const nonce = crypto.randomUUID()
    pending.value = nonce
    error.value = null
    if (!usePlanStore().sendChat(nonce, text, attachment.value)) return settle('offline')
    timer = setTimeout(() => {
      if (pending.value === nonce) settle('timeout')
    }, PENDING_MS)
  }

  function receive(m: ChatMessage, you: string | null) {
    messages.value = [...messages.value, m].slice(-KEEP)
    if (m.nonce === pending.value && m.peerId === you) {
      draft.value = ''
      attachment.value = null
      settle(null)
    } else if (m.peerId !== you && !visible()) unread.value++
  }

  function rejected(nonce: string) {
    if (nonce === pending.value) settle('rejected')
  }

  /** The connection was lost: a message on its way may never arrive. */
  function dropped() {
    if (pending.value) settle('offline')
  }

  function attach(ref: ChatRef) {
    // the server closes the socket on an invalid message, so a bad spot never gets attached
    const parsed = chatRefSchema.safeParse(ref)
    if (!parsed.success) return
    attachment.value = parsed.data
    open.value = true
    focusInput.value++
  }

  function markRead() {
    unread.value = 0
  }
  watch(open, (o) => o && markRead())

  function reset() {
    settle(null)
    messages.value = []
    unread.value = 0
    draft.value = ''
    attachment.value = null
  }

  return {
    messages: computed(() => messages.value),
    unread: computed(() => unread.value),
    open,
    draft,
    attachment,
    pending: computed(() => pending.value),
    error,
    focusInput: computed(() => focusInput.value),
    popout,
    send,
    receive,
    rejected,
    dropped,
    attach,
    markRead,
    reset,
  }
})
