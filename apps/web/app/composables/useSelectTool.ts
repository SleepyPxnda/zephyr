import {
  dist,
  dragApex,
  dragEnd,
  dragStart,
  editHandles,
  moveSelection,
  nearestSegment,
  parseSelKey,
  rotateHandle,
  rotateSelection,
  sectionOf,
  selectionGroups,
  selKey,
  wholePathKeys,
  type Gait,
  type HandleKind,
  type Horse,
  type Point,
} from '@zephyr/core'
import type { ArenaPointer } from './useDrawTools'

export interface HandleView {
  kind: HandleKind | 'rot'
  x: number
  y: number
  /** rotation pivot (rotate handle only) */
  pivot?: Point
}

export interface OverlayLabel {
  text: string
  at: Point
}

/** Pointer radius for handles (prototype: 11 px), segments (14 px), and the drag threshold (4 px). */
const HANDLE_PX = 11
const HIT_PX = 14
const DRAG_PX = 4
/** The rotate handle sits 30 px beside the selection. */
const ROT_OFFSET_PX = 30
const DEG = Math.PI / 180

type Drag = {
  mode: HandleKind | 'rot' | 'move'
  base: readonly Horse[]
  keys: string[]
  m0: Point
  screen0: Point
  /** handle position when the drag started */
  h0: Point
  pivot: Point | null
  moved: boolean
}

/**
 * The select tool on the arena (prototype `editDown` / `applyEdit`): click selects, Shift (or
 * the touch switch) adds, double click selects the whole path, dragging moves, handles rotate
 * and reshape. A drag previews on a copy and becomes one undo step when released.
 */
export function useSelectTool(gaits: Ref<readonly Gait[]>) {
  const planStore = usePlanStore()
  const editor = useEditorStore()
  const { t, n } = useI18n()

  const preview = shallowRef<readonly Horse[] | null>(null)
  const overlay = shallowRef<OverlayLabel | null>(null)
  const cursor = shallowRef('default')
  const scale = shallowRef(20)
  let drag: Drag | null = null

  const horses = computed<readonly Horse[]>(() => preview.value ?? planStore.plan?.horses ?? [])
  const active = computed(() => editor.tool === 'select')

  /** Shape handles for exactly one section, plus the rotate handle for any selection. */
  const handles = computed<HandleView[]>(() => {
    if (!active.value || !planStore.canEdit) return []
    const groups = selectionGroups(horses.value, editor.selection)
    const out: HandleView[] = []
    const only = groups.length === 1 && groups[0]?.ks.length === 1 ? groups[0] : null
    if (only && only.horse.path.pts.length > 1)
      out.push(...editHandles(only.horse.path, only.ks[0] as number))
    const rot = rotateHandle(groups, ROT_OFFSET_PX / scale.value)
    if (rot) out.push({ kind: 'rot', x: rot.x, y: rot.y, pivot: rot.pivot })
    return out
  })

  const hitHandle = (e: ArenaPointer) =>
    handles.value.find((h) => dist(h, e.m) * e.scale < HANDLE_PX) ?? null
  const hitSection = (e: ArenaPointer) => {
    const hit = nearestSegment(horses.value, editor.activeHorseId, e.m, HIT_PX / e.scale)
    const horse = hit && horses.value.find((h) => h.id === hit.horseId)
    return hit && horse ? { horse, key: selKey(horse.id, sectionOf(horse.path, hit.i)) } : null
  }

  function onDown(e: ArenaPointer) {
    scale.value = e.scale
    const handle = planStore.canEdit ? hitHandle(e) : null
    const base = planStore.plan?.horses ?? []
    if (handle) {
      drag = {
        mode: handle.kind,
        base,
        keys: [...editor.selection],
        m0: e.m,
        screen0: e.screen,
        h0: handle,
        pivot: handle.pivot ?? null,
        moved: false,
      }
      return
    }
    const hit = hitSection(e)
    const add = e.shift || editor.multiSelect
    if (!hit) {
      if (!add) editor.clearSelection()
      return
    }
    editor.activeHorseId = hit.horse.id
    if (add) return editor.toggle(hit.key)
    if (!editor.isSelected(hit.key)) editor.selectOnly(hit.key)
    if (planStore.canEdit)
      drag = {
        mode: 'move',
        base,
        keys: [...editor.selection],
        m0: e.m,
        screen0: e.screen,
        h0: e.m,
        pivot: null,
        moved: false,
      }
  }

  /** The dragged result, always computed from the horses as they were when the drag started. */
  function apply(d: Drag, e: ArenaPointer): readonly Horse[] {
    const dx = e.m.x - d.m0.x
    const dy = e.m.y - d.m0.y
    if (d.mode === 'move') return moveSelection(d.base, d.keys, dx, dy, editor.follow)
    if (d.mode === 'rot' && d.pivot) {
      const raw =
        Math.atan2(e.m.y - d.pivot.y, e.m.x - d.pivot.x) -
        Math.atan2(d.m0.y - d.pivot.y, d.m0.x - d.pivot.x)
      const step = (e.shift || editor.fineRotate ? 15 : 5) * DEG
      const a = Math.round(raw / step) * step
      overlay.value = { text: t('select.rotated', { deg: n(a / DEG, 'decimal') }), at: d.h0 }
      return rotateSelection(d.base, d.keys, a, editor.follow)
    }
    const only = parseSelKey(d.keys[0] ?? '')
    const horse = d.base.find((h) => h.id === only.horseId)
    if (!horse) return d.base
    const target = { x: d.h0.x + dx, y: d.h0.y + dy }
    let path = horse.path
    if (d.mode === 'end')
      path =
        dragEnd(horse.path, only.k, target, editor.follow, {
          gaits: gaits.value,
          snapDiameter: editor.circle.snapDiameter,
        }) ?? horse.path
    else if (d.mode === 'apex') path = dragApex(horse.path, only.k, d.h0, target)
    else if (d.mode === 'start') path = dragStart(horse.path, only.k, dx, dy)
    return d.base.map((h) => (h === horse ? { ...h, path } : h))
  }

  function onMove(e: ArenaPointer) {
    scale.value = e.scale
    if (drag) {
      if (!drag.moved && dist(e.screen, drag.screen0) < DRAG_PX) return
      drag.moved = true
      preview.value = apply(drag, e)
      return
    }
    cursor.value = hitHandle(e) ? 'grab' : hitSection(e) ? 'move' : 'default'
  }

  function onUp() {
    const d = drag
    drag = null
    overlay.value = null
    const result = preview.value
    preview.value = null
    if (d?.moved && result) planStore.editHorses(() => result)
  }

  function onDouble(e: ArenaPointer) {
    const hit = hitSection(e)
    if (!hit) return
    editor.activeHorseId = hit.horse.id
    editor.selection = wholePathKeys([hit.horse])
  }

  function cancel() {
    drag = null
    preview.value = null
    overlay.value = null
  }

  function onPointer(e: ArenaPointer) {
    if (!active.value) return
    if (e.kind === 'down') onDown(e)
    else if (e.kind === 'move') onMove(e)
    else if (e.kind === 'up') onUp()
    else if (e.kind === 'dblclick') onDouble(e)
    else if (e.kind === 'cancel') cancel()
  }

  watch(active, cancel)

  return { preview, handles, overlay, cursor, onPointer, cancel }
}
