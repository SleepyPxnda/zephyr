import { useEventListener } from '@vueuse/core'
import { TOOL_KEYS } from '~/stores/editor'

/** Shortcuts only act when no input has the focus (SPEC "Interaktionen und Tastenkürzel"). */
export function isTyping(target: EventTarget | null): boolean {
  const el = target instanceof HTMLElement ? target : null
  if (!el) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

/** Editor keyboard shortcuts; selection, undo and clipboard keys follow with M6/M7. */
export function useEditorShortcuts(o: { canEdit: () => boolean }) {
  const editor = useEditorStore()
  useEventListener(window, 'keydown', (e: KeyboardEvent) => {
    if (e.defaultPrevented || isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
    const tool = TOOL_KEYS[e.key.toLowerCase()]
    if (tool && o.canEdit()) {
      editor.tool = tool
      e.preventDefault()
    }
  })
}
