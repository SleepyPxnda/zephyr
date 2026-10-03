import {
  copySelection,
  dist,
  insertAnchor,
  insertClips,
  partClips,
  partPoints,
  pasteTargets,
  pasteTime,
  wholePathKeys,
  type Gait,
  type Horse,
  type PathPoint,
  type Point,
} from '@zephyr/core'
import type { ArenaPointer } from './useDrawTools'

export interface PastePreview {
  color: string
  pts: PathPoint[]
  /** the connecting line from the previous section's end, if any */
  from: Point | null
}

/** Dragging the preview snaps the first point to the path end within 14 px (prototype). */
const SNAP_PX = 14

/**
 * Copy and paste (SPEC "Kopieren und Einfügen", prototype `copySel` / `doPaste`): copies exactly
 * the selection (or the active horse's whole path), pastes with a movable preview right after
 * the selection (without one at the playhead), as in SPEC "Umsortieren und Verbindungen".
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

  const ctx = () => ({ gaits: gaits.value })
  /** time part i is pasted at: parts of several horses keep their offsets */
  const partTime = (i: number) => {
    const clip = editor.clipboard
    const multi = (clip?.parts.length ?? 0) > 1
    return editor.paste.t + (multi ? (clip?.parts[i]?.tOff ?? 0) : 0)
  }
  /** where part i would continue: end of the section before it */
  const anchorOf = (i: number, h: Horse | null | undefined) =>
    h ? insertAnchor(h, partTime(i), ctx()) : null

  /** "An den Vorgänger": the first point onto the end of the previous section; or the original place */
  function setPosition(kind: 'end' | 'orig') {
    const first = editor.clipboard?.parts[0]?.pts[0]
    const end = anchorOf(0, targets.value[0])
    const off =
      kind === 'end' && end && first ? { x: end.x - first.x, y: end.y - first.y } : { x: 0, y: 0 }
    editor.paste = { ...editor.paste, off }
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
      t: pasteTime(horses.value, editor.selection, editor.time, ctx()),
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

  /** Enter: one undo step for all receiving horses; the pasted sections become the selection. */
  function confirm() {
    const clip = editor.clipboard
    if (!clip || !editor.paste.open) return
    const { link, off } = editor.paste
    const keys: string[] = []
    const into = targets.value
    planStore.editHorses((hs) => {
      let out = [...hs]
      clip.parts.forEach((part, i) => {
        const h = out.find((q) => q.id === into[i]?.id)
        if (!h) return
        const clips = partClips({ ...part, pts: partPoints(part, off) }, link)
        const res = insertClips(h, clips, partTime(i), editor.gapFill, ctx())
        out = out.map((q) => (q.id === h.id ? res.horse : q))
        keys.push(...res.keys)
      })
      return out
    })
    editor.selection = keys
    close()
  }

  const preview = computed<PastePreview[]>(() => {
    const clip = editor.clipboard
    if (!clip || !editor.paste.open) return []
    return clip.parts.flatMap((part, i) => {
      const h = targets.value[i]
      if (!h) return []
      const pts = partPoints(part, editor.paste.off)
      const end = anchorOf(i, h)
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
      const end = anchorOf(0, targets.value[0])
      if (first && end && dist(end, { x: first.x + off.x, y: first.y + off.y }) * e.scale < SNAP_PX)
        off = { x: end.x - first.x, y: end.y - first.y }
      editor.paste = { ...editor.paste, off }
    } else if (e.kind === 'up' || e.kind === 'cancel') drag = null
  }

  return { copy, open, close, confirm, setPosition, preview, label, targets, onPointer }
}
