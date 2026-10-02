/**
 * Editor UI state that is not part of the plan document. Selection, tools and clipboard follow
 * with M5–M7; the playback time with M9.
 */
export const useEditorStore = defineStore('editor', () => {
  const activeHorseId = shallowRef<string | null>(null)
  /** current time on the timeline (s) */
  const time = shallowRef(0)

  return { activeHorseId, time }
})
