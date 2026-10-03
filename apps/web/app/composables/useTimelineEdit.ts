import {
  addPart,
  beatLength,
  clampSpanStart,
  clampToRange,
  defaultPartLength,
  dragPart,
  dragTarget,
  fitZoom,
  laneBlocks,
  moveClips,
  moveSectionTime,
  parseSelKey,
  nextAnchorStart,
  playEnd,
  sectionTimes,
  selKey,
  setPartRange,
  snapTime,
  sortParts,
  timelineAnchors,
  timelineSpan,
  wholePathKeys,
  PART_MIN,
  type Anchor,
  type Gait,
  type Horse,
  type Part,
  type PartDragMode,
  type SnapHit,
  type Timing,
} from '@zephyr/core'

/** Width of the lane headers (px); the time axis starts right of them. */
export const LANE_HEADER_PX = 232
/** Drag threshold (prototype: 4 px) and magnet range (SPEC: 8 px). */
const DRAG_PX = 4
const MAGNET_PX = 8

/** What the pointer is on, read from the timeline's DOM by the component. */
export interface TimelineTarget {
  horseId?: string
  k?: number
  /** on the gap block before section k */
  gap?: boolean
  partId?: string
  /** a part's resize edge */
  edge?: 'start' | 'end'
  /** the empty parts lane (dragging there creates a part) */
  partsLane?: boolean
}

export interface TimelinePointer {
  kind: 'down' | 'move' | 'up' | 'cancel'
  /** time under the pointer (s, may be negative left of the axis) */
  t: number
  /** client x, for the drag threshold */
  x: number
  shift: boolean
  alt: boolean
  /** Ctrl or Cmd: copy instead of move */
  ctrl: boolean
  /** horse lane under the pointer (dragging a block into another lane) */
  lane?: string
  target: TimelineTarget
}

type Drag =
  | {
      kind: 'section'
      horseId: string
      k: number
      /** sections moved together: the pressed one, or the selection of that horse */
      ks: number[]
      /** automatic connecting lines are only selected, never dragged */
      link: boolean
      onGap: boolean
      x0: number
      start0: number
      len: number
      shift: boolean
      base: readonly Horse[]
      anchors: Anchor[]
      moved: boolean
      /** keys of the dropped sections in the preview */
      keys: string[]
    }
  | {
      kind: 'part'
      mode: PartDragMode | 'new'
      partId: string | null
      x0: number
      /** start (move, start edge), end (end edge) or the pressed time (new) */
      t0: number
      base: readonly Part[]
      anchors: Anchor[]
      moved: boolean
    }
  | { kind: 'seek' }

const NO_TIMING: Timing = { bpm: null, beat0: 0, meter: 4, musicId: null }

/**
 * The timeline (SPEC "Zeitleiste und Wiedergabe", prototype `onTrackDown/Move/Up`, part drag):
 * click seeks and selects; dragging moves sections like clips (SPEC "Umsortieren und
 * Verbindungen": reorder, into another lane, Shift keeps the hole, Ctrl copies, Esc cancels);
 * parts are drawn, moved and resized. Drags snap to edges (magnet), otherwise to the beat or
 * 0.1 s, preview on a copy and are saved when released.
 */
export function useTimelineEdit(gaits: Ref<readonly Gait[]>) {
  const planStore = usePlanStore()
  const editor = useEditorStore()
  const { t } = useI18n()

  const previewHorses = shallowRef<readonly Horse[] | null>(null)
  const previewParts = shallowRef<readonly Part[] | null>(null)
  /** vertical guide line with a hint while the magnet holds */
  const guide = shallowRef<{ t: number; text: string } | null>(null)
  let drag: Drag | null = null

  const horses = computed<readonly Horse[]>(
    () => previewHorses.value ?? planStore.plan?.horses ?? [],
  )
  const parts = computed<readonly Part[]>(() => previewParts.value ?? planStore.plan?.parts ?? [])
  const timelines = useTimelines(horses, gaits)
  const timing = computed(() => planStore.plan?.timing ?? NO_TIMING)
  const focus = useFocusRange()
  /**
   * pixels per second: the local focus zoom while focused, otherwise the plan setting. While
   * focused the whole axis must stay within the 30000 px of the ruler and waveform canvases,
   * because the window sits at `start * pps`.
   */
  const pps = computed(() =>
    focus.value && editor.focusZoom
      ? Math.min(editor.focusZoom, 30000 / span.value)
      : (planStore.plan?.settings.timelineZoom ?? 24),
  )
  const planEnd = computed(() => {
    let m = 0
    for (const tl of timelines.value.values()) m = Math.max(m, tl.total)
    return m
  })
  const end = computed(() => playEnd(planEnd.value, editor.musicDuration, parts.value))
  const span = computed(() => timelineSpan(planEnd.value, editor.musicDuration, parts.value))
  const snapOpts = computed(() => ({
    bpm: timing.value.bpm,
    beat0: timing.value.beat0,
    toBeat: editor.snapBeat,
  }))
  const blocks = computed(
    () =>
      new Map(
        horses.value.map((h) => {
          const tl = timelines.value.get(h.id)
          return [h.id, tl ? laneBlocks(h.path, tl) : []] as const
        }),
      ),
  )

  const horseName = (id: string | null) => {
    const h = horses.value.find((q) => q.id === id)
    return h ? h.name || t('horse.defaultName', { number: h.number }) : ''
  }

  function seek(time: number) {
    editor.time = clampToRange(Math.max(0, Math.min(end.value, time)), focus.value)
  }

  function anchors(exclude: { horseId?: string; partId?: string }): Anchor[] {
    const list = horses.value.flatMap((horse) => {
      const tl = timelines.value.get(horse.id)
      return tl ? [{ horse, tl }] : []
    })
    return timelineAnchors(list, parts.value, editor.time, exclude)
  }

  /** "gleicher Start wie Luna", "Ende an Beginn von Part „Einritt“", … */
  function describe(hit: SnapHit): string {
    const a = hit.anchor
    const name = horseName(a.ownerId)
    const k = (a.k ?? 0) + 1
    if (a.kind === 'start' && hit.edge === 'start') return t('timeline.snap.sameStart', { name })
    if (a.kind === 'end' && hit.edge === 'end') return t('timeline.snap.sameEnd', { name })
    const part = parts.value.find((p) => p.id === a.ownerId)?.name ?? ''
    const target =
      a.kind === 'playhead'
        ? t('timeline.snap.playhead')
        : a.kind === 'partStart' || a.kind === 'partEnd'
          ? t(`timeline.snap.${a.kind}`, { name: part })
          : t(`timeline.snap.${a.kind}`, { name, k })
    return t(`timeline.snap.${hit.edge}At`, { target })
  }

  /** magnet range in seconds, or null when it is off (switch, or Alt while dragging) */
  const magnetRange = (alt: boolean) => (editor.magnet && !alt ? MAGNET_PX / pps.value : null)

  // ---------- pointer ----------

  function onPointer(e: TimelinePointer) {
    if (e.kind === 'down') return down(e)
    if (!drag) return
    if (e.kind === 'move') return move(drag, e)
    const d = drag
    if (e.kind === 'up') up(d, e)
    cancelDrag()
  }

  /** Esc while dragging: nothing is saved. */
  function cancelDrag() {
    const was = !!drag
    drag = null
    previewHorses.value = null
    previewParts.value = null
    guide.value = null
    return was
  }

  function down(e: TimelinePointer) {
    const { horseId, k, partId } = e.target
    if (horseId !== undefined && k !== undefined) {
      const h = horses.value.find((q) => q.id === horseId)
      const tl = timelines.value.get(horseId)
      if (!h || !tl) return
      // a selected section takes the other selected sections of its horse along
      const key = selKey(horseId, k)
      const ks = editor.isSelected(key)
        ? editor.selection.flatMap((s) => {
            const p = parseSelKey(s)
            return p.horseId === horseId && !h.path.sections[p.k]?.link ? [p.k] : []
          })
        : [k]
      ks.sort((x, y) => x - y)
      const a = sectionTimes(h.path, tl, ks[0] ?? k).a
      const b = sectionTimes(h.path, tl, ks[ks.length - 1] ?? k).b
      drag = {
        kind: 'section',
        horseId,
        k,
        ks: ks.length ? ks : [k],
        link: !!h.path.sections[k]?.link,
        onGap: !!e.target.gap,
        x0: e.x,
        start0: a,
        len: b - a,
        shift: e.shift,
        base: horses.value,
        anchors: anchors({}),
        moved: false,
        keys: [],
      }
      return
    }
    if (partId !== undefined || e.target.partsLane) {
      const part = parts.value.find((p) => p.id === partId)
      const mode: PartDragMode | 'new' = part ? (e.target.edge ?? 'move') : 'new'
      drag = {
        kind: 'part',
        mode,
        partId: part?.id ?? null,
        x0: e.x,
        t0: part
          ? mode === 'end'
            ? part.end
            : part.start
          : Math.max(0, snapTime(Math.max(0, e.t), snapOpts.value)),
        base: parts.value,
        anchors: anchors(part ? { partId: part.id } : {}),
        moved: false,
      }
      return
    }
    drag = { kind: 'seek' }
    seek(e.t)
  }

  function move(d: Drag, e: TimelinePointer) {
    if (d.kind === 'seek') return seek(e.t)
    const dx = e.x - d.x0
    if (!d.moved && Math.abs(dx) < DRAG_PX) return
    if (!planStore.canEdit) return
    if (d.kind === 'section' && d.link) return
    d.moved = true
    if (d.kind === 'section') return moveSection(d, dx, e)
    movePart(d, e, dx)
  }

  function moveSection(d: Extract<Drag, { kind: 'section' }>, dx: number, e: TimelinePointer) {
    const toId = e.lane ?? d.horseId
    // the dragged sections themselves are no snap targets
    const own = new Set(d.ks.map((k) => selKey(d.horseId, k)))
    const targets = d.anchors.filter(
      (a) => !(a.ownerId === d.horseId && a.k !== null && own.has(selKey(d.horseId, a.k))),
    )
    const { start, hit } = dragTarget(
      d.start0 + dx / pps.value,
      d.len,
      targets,
      magnetRange(e.alt),
      snapOpts.value,
    )
    const res = moveClips(
      d.base,
      {
        fromId: d.horseId,
        ks: d.ks,
        toId,
        t: clampSpanStart(start, d.len, focus.value, d.start0),
        copy: e.ctrl,
        keepHole: e.shift,
        fill: editor.gapFill,
      },
      { gaits: gaits.value },
    )
    previewHorses.value = res.horses
    d.keys = res.keys
    guide.value = hit ? { t: hit.anchor.t, text: describe(hit) } : null
  }

  function movePart(d: Extract<Drag, { kind: 'part' }>, e: TimelinePointer, dx: number) {
    if (d.mode === 'new') {
      const t1 = Math.max(0, snapTime(Math.max(0, e.t), snapOpts.value))
      const a = Math.min(d.t0, t1)
      const b = Math.max(d.t0, t1)
      if (!d.partId) {
        if (b - a < PART_MIN) return
        d.partId = crypto.randomUUID()
        const name = t('timeline.parts.defaultName', { number: d.base.length + 1 })
        previewParts.value = addPart(d.base, { id: d.partId, name, start: a, end: b })
        return
      }
      const id = d.partId
      previewParts.value = (previewParts.value ?? d.base).map((p) =>
        p.id === id ? { ...p, start: a, end: Math.max(a + PART_MIN, b) } : p,
      )
      return
    }
    const part = d.base.find((p) => p.id === d.partId)
    if (!part) return
    const len = d.mode === 'move' ? part.end - part.start : 0
    const { start, hit } = dragTarget(
      d.t0 + dx / pps.value,
      len,
      d.anchors,
      magnetRange(e.alt),
      snapOpts.value,
    )
    previewParts.value = d.base.map((p) =>
      p.id === part.id ? dragPart(p, d.mode as PartDragMode, start) : p,
    )
    guide.value = hit ? { t: hit.anchor.t, text: describe(hit) } : null
  }

  function up(d: Drag, e: TimelinePointer) {
    if (d.kind === 'seek') return
    if (d.kind === 'section') {
      const moved = previewHorses.value
      if (d.moved) {
        // one undo step, also when two horses changed
        if (moved)
          planStore.editHorses((hs) => hs.map((h) => moved.find((q) => q.id === h.id) ?? h))
        const first = d.keys[0]
        if (first) {
          editor.activeHorseId = parseSelKey(first).horseId
          editor.selection = d.keys
        }
        return
      }
      // click: select the section (Shift or the touch switch adds) and jump to its start
      const key = selKey(d.horseId, d.k)
      editor.activeHorseId = d.horseId
      if (d.shift || editor.multiSelect) return editor.toggle(key)
      editor.selectOnly(key)
      const gap = d.base.find((h) => h.id === d.horseId)?.path.sections[d.k]?.gap ?? 0
      return seek(d.onGap ? d.start0 - gap : d.start0)
    }
    if (d.moved && previewParts.value) {
      const next = sortParts(previewParts.value)
      planStore.setParts(() => next)
      editor.partId = d.partId
      return
    }
    if (d.mode === 'new') {
      editor.partId = null
      return seek(d.t0)
    }
    editor.partId = d.partId
    const part = d.base.find((p) => p.id === d.partId)
    if (part && e.kind === 'up') seek(part.start)
  }

  /** Double click on a block: the whole path of that horse (SPEC). */
  function selectWhole(horseId: string) {
    const h = horses.value.find((q) => q.id === horseId)
    if (!h) return
    editor.activeHorseId = horseId
    editor.selection = wholePathKeys([h])
  }

  // ---------- keyboard (SPEC: blocks can be moved with the arrow keys) ----------

  /** One beat (with "Am Takt einrasten" and BPM), otherwise 0.1 s. */
  const step = () => (editor.snapBeat && beatLength(timing.value.bpm)) || 0.1

  /** Arrow keys move a section; Shift moves all following, Alt jumps to the next edge. */
  function sectionKey(horseId: string, k: number, key: string, shift: boolean, alt: boolean) {
    const dir = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0
    const h = horses.value.find((q) => q.id === horseId)
    const tl = timelines.value.get(horseId)
    if (!dir || !h || !tl || !planStore.canEdit) return false
    const { a, b } = sectionTimes(h.path, tl, k)
    const target = alt
      ? nextAnchorStart(a, b - a, anchors({ horseId }), dir)
      : snapTime(a + dir * step(), snapOpts.value)
    if (target !== null) {
      const path = moveSectionTime(
        h.path,
        k,
        a,
        clampSpanStart(Math.max(0, target), b - a, focus.value, a),
        shift,
      )
      planStore.editHorses((hs) => hs.map((q) => (q.id === horseId ? { ...q, path } : q)))
    }
    return true
  }

  /** Arrow keys move a part; Alt jumps to the next edge. */
  function partKey(partId: string, key: string, alt: boolean) {
    const dir = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0
    const part = parts.value.find((p) => p.id === partId)
    if (!dir || !part || !planStore.canEdit) return false
    const target = alt
      ? nextAnchorStart(part.start, part.end - part.start, anchors({ partId }), dir)
      : snapTime(part.start + dir * step(), snapOpts.value)
    if (target !== null)
      planStore.setParts((ps) =>
        sortParts(ps.map((p) => (p.id === partId ? dragPart(p, 'move', target) : p))),
      )
    return true
  }

  // ---------- parts (part editor, "+ Part") ----------

  function addPartAtPlayhead() {
    const start = Math.max(0, snapTime(editor.time, snapOpts.value))
    const len = defaultPartLength(timing.value.bpm, timing.value.meter)
    const id = crypto.randomUUID()
    const name = t('timeline.parts.defaultName', { number: parts.value.length + 1 })
    planStore.setParts((ps) => addPart(ps, { id, name, start, end: start + len }))
    editor.partId = id
  }
  function updatePart(id: string, patch: Partial<Pick<Part, 'name' | 'color'>>) {
    planStore.setParts((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }
  function setPartTimes(id: string, start: number, end: number) {
    planStore.setParts((ps) =>
      sortParts(ps.map((p) => (p.id === id ? setPartRange(p, start, end) : p))),
    )
  }
  function removePart(id: string) {
    planStore.setParts((ps) => ps.filter((p) => p.id !== id))
    if (editor.partId === id) editor.partId = null
  }

  // ---------- focus ----------
  function enterFocus(id: string, widthPx: number) {
    const part = parts.value.find((p) => p.id === id)
    if (!part) return
    editor.focusPartId = id
    editor.focusZoom = fitZoom(part, widthPx)
    editor.time = part.start
  }
  function leaveFocus() {
    editor.focusPartId = null
    editor.focusZoom = null
  }
  // the part is gone (deleted, other plan): back to the whole timeline
  watch(
    () => editor.focusPartId !== null && focus.value === null,
    (gone) => {
      if (gone) leaveFocus()
    },
    { immediate: true },
  )

  return {
    horses,
    parts,
    timelines,
    blocks,
    timing,
    pps,
    end,
    span,
    guide,
    preview: computed(() => previewHorses.value),
    cancelDrag,
    previewParts: computed(() => previewParts.value),
    horseName,
    seek,
    onPointer,
    selectWhole,
    sectionKey,
    partKey,
    addPartAtPlayhead,
    updatePart,
    setPartTimes,
    removePart,
    focus,
    enterFocus,
    leaveFocus,
  }
}

export type TimelineEdit = ReturnType<typeof useTimelineEdit>
