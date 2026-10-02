import { useLocalStorage } from '@vueuse/core'

export interface DisplayOptions {
  /** show planned paths of all horses (the active horse always shows its path) */
  showPaths: boolean
  showNames: boolean
  /** "Nur Pferde": hide all paths */
  onlyHorses: boolean
}

/** Personal view options; they stay in this browser (SPEC "plans.settings"). */
export const useDisplayOptions = () =>
  useLocalStorage<DisplayOptions>(
    'zephyr:display',
    { showPaths: true, showNames: true, onlyHorses: false },
    { mergeDefaults: true },
  )
