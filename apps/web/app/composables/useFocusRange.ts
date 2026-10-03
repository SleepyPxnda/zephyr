import type { TimeRange } from '@zephyr/core'

/** Time window of the focused part (null without focus); follows the stored part, so edge edits and live changes move it. */
export function useFocusRange(): ComputedRef<TimeRange | null> {
  const planStore = usePlanStore()
  const editor = useEditorStore()
  return computed(() => {
    const part = planStore.plan?.parts.find((p) => p.id === editor.focusPartId)
    return part ? { start: part.start, end: part.end } : null
  })
}
