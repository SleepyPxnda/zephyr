import {
  copySelection,
  dist,
  partPoints,
  paste,
  pasteAnchor,
  pasteOffset,
  pasteTargets,
  wholePathKeys,
  type Gait,
  type PathPoint,
  type Point,
} from '@zephyr/core'
import type { ArenaPointer } from './useDrawTools'

export interface PastePreview {
  color: string
  pts: PathPoint[]
  /** the straight connection from the path end, if any */
  from: Point | null
}

/** Dragging the preview snaps the first point to the path end within 14 px (prototype). */
const SNAP_PX = 14

/**
 * Copy and paste (SPEC "Kopieren und Einfügen", prototype `copySel` / `doPaste`): copies exactly
 * the selection (or the active horse's whole path), pastes with a movable preview.
 */
export function useClipboardTools(gaits: Ref<readonly Gait[]>) {
  const planStore = usePlanStore()
  const editor = useEditorStore()
  const { t } = useI18n()

  const horses = computed(() => planStore.plan?.horses ?? [])
  const targets = computed(() =>
    editor.clipboard
      ? pasteTargets(editor.clipboard, horses.value, editor.activeHorseId, editor.paste.target)
      : [],
  )

  /** Strg+C: the selection; without one, the whole path of the active horse. */
  function copy(): boolean {
    let keys = editor.selection
    if (!keys.length) {
      const h = horses.value.find((q) => q.id === editor.activeHorseId)
      keys = h ? wholePathKeys([h]) : []
    }
    const clip = copySelection(horses.value, keys, { gaits: gaits.value })
    if (clip) editor.clipboard = clip
    return !!clip
  }

  function setPosition(kind: 'end' | 'orig') {
    const clip = editor.clipboard
    if (clip)
      editor.paste = { ...editor.paste, off: pasteOffset(clip, targets.value[0] ?? null, kind) }
  }

  /** Strg+V: opens the paste bar; several parts default to their place and a pause. */
  function open() {
    const clip = editor.clipboard
    if (!clip || !planStore.canEdit) return
    const multi = clip.parts.length > 1
    editor.paste = {
      open: true,
      off: { x: 0, y: 0 },
      link: multi ? 'gap' : 'line',
      target: editor.paste.target,
    }
    if (!targets.value.some(Boolean)) {
      editor.paste = { ...editor.paste, open: false }
      return
    }
    setPosition(multi ? 'orig' : 'end')
  }

  function close() {
    editor.paste = { ...editor.paste, open: false }
    drag = null
  }

  /** Enter: one undo step for all receiving horses. */
  function confirm() {
    const clip = editor.clipboard
    if (!clip || !editor.paste.open) return
    const { link, target, off } = editor.paste
    planStore.editHorses((hs) =>
      paste(
        hs,
        clip,
        { activeId: editor.activeHorseId, target, link, off },
        { gaits: gaits.value },
      ),
    )
    editor.clearSelection()
    close()
  }

  const preview = computed<PastePreview[]>(() => {
    const clip = editor.clipboard
    if (!clip || !editor.paste.open) return []
    return clip.parts.flatMap((part, i) => {
      const h = targets.value[i]
      if (!h) return []
      const pts = partPoints(part, editor.paste.off)
      const end = pasteAnchor(h)
      return [{ color: h.color, pts, from: editor.paste.link === 'line' && end ? end : null }]
    })
  })

  const label = computed(() => {
    const clip = editor.clipboard
    if (!clip) return ''
    const what =
      clip.parts.length === 1
        ? t(
            'paste.onePart',
            {
              name: horses.value.find((h) => h.id === clip.parts[0]?.from)?.name ?? '',
              count: clip.sections,
            },
            clip.sections,
          )
        : t('paste.manyParts', { count: clip.sections, horses: clip.parts.length })
    const to = targets.value.map((h) => h?.name || '–').join(', ')
    return t('paste.title', { what, to })
  })

  // ---------- dragging the preview on the arena ----------
  let drag: { screen0: Point; off0: Point } | null = null
  function onPointer(e: ArenaPointer) {
    const clip = editor.clipboard
    if (!clip) return
    if (e.kind === 'down') drag = { screen0: e.screen, off0: { ...editor.paste.off } }
    else if (e.kind === 'move' && drag) {
      let off = {
        x: drag.off0.x + (e.screen.x - drag.screen0.x) / e.scale,
        y: drag.off0.y + (e.screen.y - drag.screen0.y) / e.scale,
      }
      const first = clip.parts[0]?.pts[0]
      const end = pasteAnchor(targets.value[0] ?? null)
      if (first && end && dist(end, { x: first.x + off.x, y: first.y + off.y }) * e.scale < SNAP_PX)
        off = { x: end.x - first.x, y: end.y - first.y }
      editor.paste = { ...editor.paste, off }
    } else if (e.kind === 'up' || e.kind === 'cancel') drag = null
  }

  return { copy, open, close, confirm, setPosition, preview, label, targets, onPointer }
}
