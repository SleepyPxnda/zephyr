import {
  canMerge,
  deleteSelection,
  mergeSelection,
  mirrorSelection,
  rotateSelection,
  selectionGroups,
  selectionSummary,
  selKey,
  setSectionProps,
  wholePathKeys,
  type ArenaSize,
  type Gait,
  type MirrorMode,
  type SectionPatch,
} from '@zephyr/core'

/** What the selection panel shows and does; every action is one undo step. */
export function useSelectionActions(gaits: Ref<readonly Gait[]>, arena: Ref<ArenaSize | null>) {
  const planStore = usePlanStore()
  const editor = useEditorStore()
  const { t } = useI18n()

  const horses = computed(() => planStore.plan?.horses ?? [])
  const timelines = useTimelines(horses, gaits)
  const groups = computed(() => selectionGroups(horses.value, editor.selection))
  const summary = computed(() => selectionSummary(horses.value, editor.selection, timelines.value))
  const mergeable = computed(() => canMerge(groups.value))

  const title = computed(() => {
    const g = groups.value
    const only = g.length === 1 && g[0]?.ks.length === 1 ? g[0] : null
    if (only)
      return t('selection.titleOne', {
        name: only.horse.name || only.horse.number,
        k: (only.ks[0] ?? 0) + 1,
      })
    const count = g.reduce((n, q) => n + q.ks.length, 0)
    return t('selection.titleMany', {
      count,
      names: g.map((q) => q.horse.name || q.horse.number).join(', '),
    })
  })

  const edit = (fn: Parameters<typeof planStore.editHorses>[0]) => planStore.editHorses(fn)
  const set = (patch: SectionPatch) => edit((hs) => setSectionProps(hs, editor.selection, patch))

  function rotate(degrees: number) {
    edit((hs) => rotateSelection(hs, editor.selection, (degrees * Math.PI) / 180, editor.follow))
  }
  function mirror(mode: MirrorMode) {
    const a = arena.value
    if (a) edit((hs) => mirrorSelection(hs, editor.selection, mode, editor.follow, a))
  }
  function whole() {
    editor.selection = wholePathKeys(groups.value.map((g) => g.horse))
  }
  function merge() {
    const g = groups.value[0]
    if (!mergeable.value || !g) return
    edit((hs) => mergeSelection(hs, editor.selection))
    editor.selectOnly(selKey(g.horse.id, g.ks[0] ?? 0))
  }
  function remove() {
    if (!editor.selection.length) return
    edit((hs) => deleteSelection(hs, editor.selection, { gaits: gaits.value }))
    editor.clearSelection()
  }
  /** Strg+A: whole path of the active horse. */
  function selectAll() {
    const h = horses.value.find((q) => q.id === editor.activeHorseId)
    if (h) editor.selection = wholePathKeys([h])
  }

  return {
    summary,
    title,
    canMerge: mergeable,
    setGait: (gaitId: string) => set({ gaitId }),
    setTack: (tack: boolean | null) => set({ tack }),
    setGap: (gap: number) => set({ gap }),
    setGapType: (gapType: 'halt' | 'pause') => set({ gapType }),
    rotate,
    mirror,
    whole,
    merge,
    remove,
    selectAll,
  }
}
