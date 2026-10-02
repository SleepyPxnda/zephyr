import type { Hand } from '@zephyr/core'

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
 * Editor UI state that is not part of the plan document. Selection and clipboard follow with
 * M6/M7; the playback time with M9.
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

  return {
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
