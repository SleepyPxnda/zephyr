/**
 * The chat in its own window: an empty same-origin window gets the stylesheets and the theme
 * class of this one and a root element; the sidebar is teleported into it, so store, socket and
 * history stay the same. Closing that window brings the chat back.
 */
export function useChatPopout() {
  const chat = useChatStore()
  const { t } = useI18n()
  const target = shallowRef<HTMLElement | null>(null)
  const blocked = shallowRef(false)

  function open() {
    if (chat.popout && !chat.popout.closed) return chat.popout.focus()
    const w = window.open('', 'zephyr-chat', 'popup,width=380,height=720')
    blocked.value = !w
    if (!w) return
    const doc = w.document
    // shortcut: styles added later (dev hot reload) do not reach the window; reopen it then
    doc.head.replaceChildren(
      ...[...document.head.querySelectorAll('link[rel=stylesheet], style')].map((n) =>
        n.cloneNode(true),
      ),
    )
    // after the head was replaced, which drops a <title> set before
    doc.title = `${t('chat.title')} · Zephyr`
    doc.documentElement.className = document.documentElement.className
    doc.documentElement.lang = document.documentElement.lang
    doc.body.className = 'bg-background text-foreground'
    const root = doc.createElement('div')
    doc.body.replaceChildren(root)
    w.addEventListener('pagehide', close)
    doc.addEventListener('visibilitychange', () => {
      if (!doc.hidden) chat.markRead()
    })
    chat.popout = w
    chat.markRead()
    target.value = root
  }

  function close() {
    const w = chat.popout
    chat.popout = null
    target.value = null
    if (w && !w.closed) w.close()
  }

  onBeforeUnmount(close)
  return { target, blocked, open, close }
}
