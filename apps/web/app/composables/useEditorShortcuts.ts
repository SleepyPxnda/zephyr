import { useEventListener } from '@vueuse/core'
import { TOOL_KEYS } from '~/stores/editor'

/** Shortcuts only act when no input has the focus (SPEC "Interaktionen und Tastenkürzel"). */
export function isTyping(target: EventTarget | null): boolean {
  const el = target instanceof HTMLElement ? target : null
  if (!el) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

export interface ShortcutActions {
  canEdit: () => boolean
  undo: () => void
  selectAll: () => void
  clearSelection: () => void
  removeSelection: () => void
  copy: () => void
  openPaste: () => void
  pasteOpen: () => boolean
  confirmPaste: () => void
  cancelPaste: () => void
}

/**
 * Editor keyboard shortcuts: tools (V F G B Z T), Strg/Cmd+Z, +A, +C, +V, Enter, Esc,
 * Entf/Rücktaste. Zoom (+ − 0) and W live with the arena; playback keys follow with M9.
 */
export function useEditorShortcuts(a: ShortcutActions) {
  const editor = useEditorStore()
  useEventListener(window, 'keydown', (e: KeyboardEvent) => {
    if (e.defaultPrevented || isTyping(e.target)) return
    const mod = e.ctrlKey || e.metaKey
    const key = e.key.toLowerCase()
    if (mod && !e.altKey) {
      if (key === 'z' && !e.shiftKey && a.canEdit()) a.undo()
      else if (key === 'a') a.selectAll()
      else if (key === 'c') a.copy()
      else if (key === 'v' && a.canEdit()) a.openPaste()
      else return
      e.preventDefault()
      return
    }
    if (e.altKey) return
    if (e.key === 'Escape') {
      // Esc cancels pasting first, otherwise it clears the selection (SPEC)
      if (a.pasteOpen()) a.cancelPaste()
      else a.clearSelection()
    } else if (e.key === 'Enter' && a.pasteOpen()) a.confirmPaste()
    else if ((e.key === 'Delete' || e.key === 'Backspace') && a.canEdit()) a.removeSelection()
    else if (TOOL_KEYS[key] && a.canEdit() && !e.shiftKey) editor.tool = TOOL_KEYS[key]
    else return
    e.preventDefault()
  })
}
