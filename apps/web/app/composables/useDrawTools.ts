import {
  dist,
  drawFigure,
  figure,
  figureStart,
  freehandBegin,
  freehandEnd,
  freehandExtend,
  nearestSegment,
  splitAt,
  type Figure,
  type FigureKind,
  type Gait,
  type Horse,
  type Point,
} from '@zephyr/core'

/** A pointer event on the arena, already converted to metres by the canvas. */
export interface ArenaPointer {
  kind: 'down' | 'move' | 'up' | 'cancel' | 'leave'
  /** position in metres (rounded to cm, kept on the arena) */
  m: Point
  /** position in CSS pixels on the canvas */
  screen: Point
  shift: boolean
  /** CSS pixels per metre */
  scale: number
  pointerId: number
}

export interface Ghost {
  start: Point
  figure: Figure
  color: string
  label: string
  /** pointer position (metres) for the label */
  at: Point
}

/** A click moves less than this (CSS px); then a figure is a "click without dragging". */
const CLICK_PX = 6
/** Hit radius for splitting (prototype: 14 px). */
const HIT_PX = 14
/** Splitting closer than this to an existing point uses that point (prototype: 4 px). */
const SNAP_PX = 4

type Gesture =
  | { kind: 'free'; pointerId: number; base: Horse }
  | { kind: 'figure'; pointerId: number; base: Horse; down: Point; downScreen: Point }

/**
 * The drawing tools on the arena (prototype pointer handlers): freehand, line, arc, volte and
 * split. The geometry comes from @zephyr/core; a running stroke is kept as a draft and only
 * written to the plan when the pointer is released.
 */
export function useDrawTools(gaits: Ref<readonly Gait[]>) {
  const planStore = usePlanStore()
  const editor = useEditorStore()
  const { t, n } = useI18n()

  const draft = shallowRef<Horse | null>(null)
  const ghost = shallowRef<Ghost | null>(null)
  const splitHover = shallowRef<Point | null>(null)
  let gesture: Gesture | null = null

  const horses = computed(() => planStore.plan?.horses ?? [])
  const active = () => horses.value.find((h) => h.id === editor.activeHorseId) ?? null
  const drawGait = computed(() => {
    const id = planStore.plan?.settings.drawGaitId
    return gaits.value.find((g) => g.id === id) ?? gaits.value.find((g) => !g.archivedAt) ?? null
  })
  const options = (shift: boolean) => ({
    turnDiameter: drawGait.value?.turnDiameter ?? 0,
    roundCorners: planStore.plan?.settings.roundCorners ?? true,
    hand: editor.circle.hand,
    half: editor.circle.half,
    snapDiameter: editor.circle.snapDiameter,
    shift,
  })
  const isFigureTool = (): FigureKind | null =>
    editor.tool === 'line' || editor.tool === 'arc' || editor.tool === 'circle' ? editor.tool : null

  // ---------- preview label (SPEC: length, diameter and turning-circle warning) ----------
  const m1 = (v: number) => n(v, 'metres')
  function label(kind: FigureKind, f: Figure): string {
    const gait = drawGait.value?.name ?? ''
    const md = drawGait.value?.turnDiameter ?? 0
    const shape = f.shape
    if (!shape) return ''
    let text: string
    if (shape === 'lineTooClose') return t('draw.label.tooClose', { gait, d: m1(md) })
    if (shape === 'line')
      text = t(kind === 'arc' ? 'draw.label.lineNoHeading' : 'draw.label.line', {
        len: m1(f.length),
        gait,
      })
    else if (shape === 'turnLine')
      text = t('draw.label.turnLine', { d: m1(md), len: m1(f.length), gait })
    else if (shape === 'arc')
      text = t('draw.label.arc', { d: m1(f.diameter ?? 0), len: m1(f.length), gait })
    else
      text = t('draw.label.circle', {
        name: t(`draw.shape.${shape}`),
        hand: f.hand ? t(`draw.hand.${f.hand}`) : '',
        d: m1(f.diameter ?? 0),
        len: m1(f.length),
        gait,
      })
    return f.tight ? `${text} · ${t('draw.label.tight', { gait, d: m1(md) })}` : text
  }

  function previewFrom(base: Horse, down: Point | null, at: Point, shift: boolean) {
    const kind = isFigureTool()
    if (!kind) return (ghost.value = null)
    let { S, hd } = figureStart(base)
    if (!S) {
      // empty path or after "+ Pause": the press sets the start
      if (!down) return (ghost.value = null)
      S = down
      hd = null
    }
    const f = figure(kind, S, hd, at, options(shift))
    ghost.value = f.pts.length
      ? { start: S, figure: f, color: base.color, label: label(kind, f), at }
      : null
  }

  // ---------- pointer handling ----------
  function onDown(e: ArenaPointer) {
    if (!planStore.canEdit) return
    if (editor.tool === 'split') {
      const hit = nearestSegment(horses.value, editor.activeHorseId, e.m, HIT_PX / e.scale)
      const horse = hit && horses.value.find((h) => h.id === hit.horseId)
      if (!hit || !horse) return
      const res = splitAt(horse.path, hit.i, hit.f, SNAP_PX / e.scale)
      editor.activeHorseId = horse.id
      if (res) planStore.replaceHorse({ ...horse, path: res.path })
      splitHover.value = null
      return
    }
    const horse = active()
    if (!horse || editor.tool === 'select') return
    if (editor.tool === 'free') {
      gesture = { kind: 'free', pointerId: e.pointerId, base: horse }
      draft.value = freehandBegin(horse, e.m, drawGait.value?.id ?? '', 1 / e.scale)
      return
    }
    gesture = {
      kind: 'figure',
      pointerId: e.pointerId,
      base: horse,
      down: e.m,
      downScreen: e.screen,
    }
    previewFrom(horse, e.m, e.m, e.shift)
  }

  function onMove(e: ArenaPointer) {
    if (gesture?.kind === 'free' && draft.value) {
      if (e.pointerId === gesture.pointerId)
        draft.value = freehandExtend(draft.value, e.m, 1 / e.scale)
      return
    }
    if (gesture?.kind === 'figure') return previewFrom(gesture.base, gesture.down, e.m, e.shift)
    // hover
    if (editor.tool === 'split') {
      const hit = nearestSegment(horses.value, editor.activeHorseId, e.m, HIT_PX / e.scale)
      splitHover.value = hit ? { x: hit.x, y: hit.y } : null
      return
    }
    const horse = active()
    if (horse && planStore.canEdit) previewFrom(horse, null, e.m, e.shift)
    else ghost.value = null
  }

  function onUp(e: ArenaPointer) {
    const g = gesture
    if (!g || e.pointerId !== g.pointerId) return
    gesture = null
    if (g.kind === 'free') {
      const done = draft.value ? freehandEnd(draft.value) : null
      draft.value = null
      // a click without movement still uses up an announced halt/pause (as in the prototype)
      if (
        done &&
        (done.path.pts.length !== g.base.path.pts.length || done.pending !== g.base.pending)
      )
        planStore.replaceHorse(done)
      return
    }
    const kind = isFigureTool()
    ghost.value = null
    if (!kind) return
    const result = drawFigure(g.base, {
      kind,
      down: g.down,
      up: e.m,
      moved: dist(e.screen, g.downScreen) > CLICK_PX,
      gaitId: drawGait.value?.id ?? '',
      ...options(e.shift),
    })
    if (result !== g.base) planStore.replaceHorse(result)
  }

  /** A second finger or a lost pointer aborts the stroke; nothing is written. */
  function cancel() {
    gesture = null
    draft.value = null
    ghost.value = null
  }

  function onPointer(e: ArenaPointer) {
    if (e.kind === 'down') onDown(e)
    else if (e.kind === 'move') onMove(e)
    else if (e.kind === 'up') onUp(e)
    else if (e.kind === 'cancel') cancel()
    else if (!gesture) {
      ghost.value = null
      splitHover.value = null
    }
  }

  // switching tools ends previews
  watch(
    () => editor.tool,
    () => {
      cancel()
      splitHover.value = null
    },
  )

  return { draft, ghost, splitHover, onPointer, cancel, drawGait }
}
