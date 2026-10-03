import type { Clipboard, GapType, Hand, PasteLink, PasteTarget, Point } from '@zephyr/core'

export type Tool = 'select' | 'free' | 'line' | 'arc' | 'circle' | 'split'
/** Keyboard shortcuts of the tools (SPEC "Interaktionen und Tastenkürzel"). */
export const TOOL_KEYS: Record<string, Tool> = {
  v: 'select',
  f: 'free',
  g: 'line',
  b: 'arc',
  z: 'circle',
  t: 'split',
}

/**
 * Editor UI state that is not part of the plan document: tool, selection, clipboard, timeline
 * options and the current time.
 */
export const useEditorStore = defineStore('editor', () => {
  const activeHorseId = shallowRef<string | null>(null)
  /** current time on the timeline (s) */
  const time = shallowRef(0)
  const tool = shallowRef<Tool>('free')
  /** volte options: hand by pointer side or fixed, whole or half, diameter on the 0.5 m grid */
  const circle = ref<{ hand: Hand; half: boolean; snapDiameter: boolean }>({
    hand: 'auto',
    half: false,
    snapDiameter: false,
  })

  // ---------- selection (SPEC: set of horseId:sectionIndex, across horses) ----------
  /** selected sections in the order they were selected */
  const selection = shallowRef<string[]>([])
  /** "Folgende hängen dran": edits also move everything after the first selected section */
  const follow = shallowRef(true)
  /** touch replacements for Shift (SPEC: switches in the selection panel) */
  const multiSelect = shallowRef(false)
  const fineRotate = shallowRef(false)

  const isSelected = (key: string) => selection.value.includes(key)
  function selectOnly(key: string) {
    selection.value = [key]
  }
  function toggle(key: string) {
    selection.value = isSelected(key)
      ? selection.value.filter((k) => k !== key)
      : [...selection.value, key]
  }
  function clearSelection() {
    selection.value = []
  }

  // ---------- timeline (M8) ----------
  /** "Am Takt einrasten": snap to beats (otherwise 0.1 s) */
  const snapBeat = shallowRef(true)
  /** magnet: snap dragged blocks to edges (Alt switches it off while dragging) */
  const magnet = shallowRef(true)
  /** "Lücken: Halt | Pause": type of gaps that come up when blocks are moved or pasted */
  const gapFill = shallowRef<GapType>('halt')
  /** the part shown in the part editor */
  const partId = shallowRef<string | null>(null)
  /** length of the loaded music (s); 0 without music (M9) */
  const musicDuration = shallowRef(0)

  // ---------- clipboard (M7); kept when switching plans ----------
  const clipboard = shallowRef<Clipboard | null>(null)
  /** paste bar: open, preview offset (m), join, target horses, time to paste at (s) */
  const paste = ref<{
    open: boolean
    off: Point
    link: PasteLink
    target: PasteTarget
    t: number
  }>({
    open: false,
    off: { x: 0, y: 0 },
    link: 'line',
    target: 'same',
    t: 0,
  })

  return {
    snapBeat,
    magnet,
    gapFill,
    partId,
    musicDuration,
    clipboard,
    paste,
    activeHorseId,
    time,
    tool,
    circle,
    selection,
    follow,
    multiSelect,
    fineRotate,
    isSelected,
    selectOnly,
    toggle,
    clearSelection,
  }
})
