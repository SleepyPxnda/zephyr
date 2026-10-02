import {
  effectiveTack,
  headingAt,
  isLightColor,
  posAt,
  scaleBarMetres,
  sectionOf,
  sectionRange,
  toScreen,
  type ArenaSize,
  type Gait,
  type Horse,
  type Part,
  type PathPoint,
  type Point,
  type Timeline,
  type ViewTransform,
  type Viewport,
} from '@zephyr/core'

// Canvas colours do not follow the UI theme: the hall image looks the same in light and dark.
/** SPEC: thin dark outline (#2E2A3D, 60 %) so pastel paths and horses stay readable on the hall. */
const OUTLINE = 'rgba(46, 42, 61, 0.6)'
const INK = '#2E2A3D'
const LABEL_BG = 'rgba(30, 26, 20, 0.78)'
const WHITE = '#FFFFFF'
const TIGHT = 'rgba(214, 40, 40, 0.75)'
const MARGIN_BG = '#2B2722'
const FONT = '"Inter Variable", system-ui, sans-serif'

const px = (t: ViewTransform, p: Point): [number, number] => {
  const s = toScreen(t, p)
  return [s.x, s.y]
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: 'center' | 'left' = 'center',
) {
  ctx.font = `600 12px ${FONT}`
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  const w = ctx.measureText(text).width
  ctx.fillStyle = LABEL_BG
  roundRect(ctx, align === 'center' ? x - w / 2 - 6 : x - 6, y - 9, w + 12, 18, 5)
  ctx.fill()
  ctx.fillStyle = WHITE
  ctx.fillText(text, x, y + 0.5)
}

/** Background layer: hall image stretched to length × width, dark margin, scale bar. */
export function drawField(
  ctx: CanvasRenderingContext2D,
  o: {
    arena: ArenaSize
    image: HTMLImageElement | null
    t: ViewTransform
    vp: Viewport
    dpr: number
  },
) {
  const { arena, image, t, vp, dpr } = o
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, vp.width, vp.height)
  ctx.fillStyle = MARGIN_BG
  ctx.fillRect(0, 0, vp.width, vp.height)
  const [x0, y0] = px(t, { x: 0, y: 0 })
  const w = arena.lengthM * t.scale
  const h = arena.widthM * t.scale
  if (image?.complete && image.naturalWidth) ctx.drawImage(image, x0, y0, w, h)
  else {
    ctx.fillStyle = '#3A342C'
    ctx.fillRect(x0, y0, w, h)
  }
  // scale bar, bottom left
  const len = scaleBarMetres(t.scale)
  const x = 12
  const y = vp.height - 10
  ctx.save()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x, y - 3)
  ctx.lineTo(x, y)
  ctx.lineTo(x + len * t.scale, y)
  ctx.lineTo(x + len * t.scale, y - 3)
  ctx.stroke()
  ctx.font = `600 11px ${FONT}`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(`${len} m`, x + len * t.scale + 6, y - 1)
  ctx.restore()
}

export interface SceneLabels {
  waiting: string
  halt: string
  pause: string
  /** label of an announced gap before the next line */
  pending: (kind: 'halt' | 'pause', seconds: number, jump: boolean) => string
}

export interface Scene {
  horses: readonly Horse[]
  timelines: ReadonlyMap<string, Timeline>
  gaits: readonly Gait[]
  parts: readonly Part[]
  activeId: string | null
  time: number
  showPaths: boolean
  showNames: boolean
  onlyHorses: boolean
  labels: SceneLabels
}

const gaitName = (gaits: readonly Gait[], id: string | undefined) =>
  gaits.find((g) => g.id === id)?.name ?? gaits[0]?.name ?? ''

function strokePath(
  ctx: CanvasRenderingContext2D,
  t: ViewTransform,
  pts: readonly PathPoint[],
  to: number,
  end: Point | null,
  color: string,
  width: number,
) {
  const first = pts[0]
  if (!first) return
  ctx.beginPath()
  let [x, y] = px(t, first)
  ctx.moveTo(x, y)
  for (let i = 1; i <= to && i < pts.length; i++) {
    const q = pts[i] as PathPoint
    ;[x, y] = px(t, q)
    if (q.jump) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  if (end) {
    ;[x, y] = px(t, end)
    ctx.lineTo(x, y)
  }
  ctx.strokeStyle = OUTLINE
  ctx.lineWidth = width + 2
  ctx.stroke()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.stroke()
}

/** Foreground layer: paths, tight stretches, section borders, horses, labels (prototype `render`). */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  s: Scene,
  t: ViewTransform,
  vp: Viewport,
  dpr: number,
) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, vp.width, vp.height)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const r = Math.max(9, Math.min(15, t.scale * 0.6))
  const shown = (h: Horse) => s.showPaths || h.id === s.activeId

  for (const h of s.horses) {
    const tl = s.timelines.get(h.id)
    if (s.onlyHorses || h.path.pts.length < 2 || !tl) continue
    const pts = h.path.pts
    const pos = posAt(h.path, tl, s.time, h.pending)
    const active = h.id === s.activeId
    if (shown(h)) {
      // planned path, dashed
      ctx.save()
      ctx.globalAlpha = active ? 0.8 : 0.55
      ctx.setLineDash([6, 6])
      strokePath(ctx, t, pts, pts.length - 1, null, h.color, 2)
      ctx.restore()
      const hd = headingAt(pts, pts.length - 1)
      const last = pts[pts.length - 1] as PathPoint
      if (hd !== null) {
        const [ex, ey] = px(t, last)
        ctx.save()
        ctx.globalAlpha = active ? 0.85 : 0.6
        ctx.translate(ex, ey)
        ctx.rotate(hd)
        ctx.fillStyle = h.color
        ctx.strokeStyle = OUTLINE
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(4, 0)
        ctx.lineTo(-8, -6)
        ctx.lineTo(-8, 6)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        ctx.restore()
      }
      // halts: dotted ring where the horse stands
      h.path.sections.forEach((sec, k) => {
        if (k === 0 || sec.gap < 0.05 || sec.gapType !== 'halt') return
        const at = pts[sec.start - 1]
        if (!at) return
        const [x, y] = px(t, at)
        ctx.save()
        ctx.strokeStyle = h.color
        ctx.lineWidth = 2
        ctx.setLineDash([2, 3])
        ctx.beginPath()
        ctx.arc(x, y, r + 5, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      })
    }
    // ridden so far, solid
    if (pos && pos.i > 0) strokePath(ctx, t, pts, pos.i - 1, pos.hidden ? null : pos, h.color, 3.5)
    if (shown(h)) {
      // section borders
      for (let k = 1; k < h.path.sections.length; k++) {
        const b = pts[(h.path.sections[k]?.start ?? 0) - 1]
        if (!b) continue
        const [bx, by] = px(t, b)
        ctx.beginPath()
        ctx.arc(bx, by, 4.5, 0, Math.PI * 2)
        ctx.fillStyle = WHITE
        ctx.fill()
        ctx.lineWidth = 2.5
        ctx.strokeStyle = h.color
        ctx.stroke()
        ctx.lineWidth = 1
        ctx.strokeStyle = OUTLINE
        ctx.stroke()
      }
    }
  }

  // stretches tighter than the turning circle (SPEC "Wendekreis-Prüfung"): red
  if (!s.onlyHorses) {
    for (const h of s.horses) {
      const tl = s.timelines.get(h.id)
      if (!tl || h.path.pts.length < 3 || !shown(h)) continue
      ctx.beginPath()
      let open = false
      for (let i = 1; i < h.path.pts.length; i++) {
        if (tl.tight[i]) {
          const [ax, ay] = px(t, h.path.pts[i - 1] as PathPoint)
          const [bx, by] = px(t, h.path.pts[i] as PathPoint)
          if (!open) ctx.moveTo(ax, ay)
          ctx.lineTo(bx, by)
          open = true
        } else open = false
      }
      ctx.lineWidth = 7
      ctx.strokeStyle = TIGHT
      ctx.stroke()
    }
  }

  // gait labels of the active horse
  const ap = s.horses.find((h) => h.id === s.activeId)
  if (!s.onlyHorses && ap && ap.path.pts.length > 1) {
    ap.path.sections.forEach((sec, k) => {
      const { s: st, e } = sectionRange(ap.path, k)
      const from = Math.max(0, st - 1)
      if (e <= from) return
      const [mx, my] = px(t, ap.path.pts[Math.round((from + e) / 2)] as PathPoint)
      label(ctx, `${k + 1} · ${gaitName(s.gaits, sec.gaitId)}`, mx, my - 14)
    })
  }

  // horses
  for (const h of s.horses) {
    const tl = s.timelines.get(h.id)
    if (!tl || !h.path.pts.length) continue
    const pos = posAt(h.path, tl, s.time, h.pending)
    if (!pos || pos.hidden) continue
    const [x, y] = px(t, pos)
    const light = isLightColor(h.color)
    const k = sectionOf(h.path, pos.i)
    const sec = h.path.sections[k]
    const tack = sec ? effectiveTack(sec, h.tack) : h.tack
    const hd = headingAt(h.path.pts, pos.i)
    if (hd !== null && h.path.pts.length > 1) {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(hd)
      ctx.fillStyle = h.color
      ctx.strokeStyle = OUTLINE
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(r + 7, 0)
      ctx.lineTo(r - 1, -6)
      ctx.lineTo(r - 1, 6)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
    ctx.shadowBlur = 6
    ctx.shadowOffsetY = 1
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = h.color
    ctx.fill()
    ctx.restore()
    // without saddle: dashed rim (per section)
    ctx.lineWidth = h.id === s.activeId ? 3 : 2
    ctx.strokeStyle = light ? OUTLINE : WHITE
    if (!tack) ctx.setLineDash([3, 2.5])
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = light ? INK : WHITE
    ctx.font = `700 ${Math.round(r * 1.05)}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(h.number), x, y + 1)
    if (s.showNames && h.name) {
      const state =
        pos.state === 'waiting'
          ? s.labels.waiting
          : pos.state === 'halt'
            ? s.labels.halt
            : h.path.pts.length > 1 && pos.state !== 'done'
              ? gaitName(s.gaits, sec?.gaitId)
              : ''
      label(ctx, state ? `${h.name} · ${state}` : h.name, x, y + r + 13)
    }
  }

  // announced halt/pause of the active horse
  if (!s.onlyHorses && ap?.pending && ap.path.pts.length) {
    const [lx, ly] = px(t, ap.path.pts[ap.path.pts.length - 1] as PathPoint)
    label(
      ctx,
      s.labels.pending(ap.pending.gapType, ap.pending.gap, ap.pending.jump),
      lx + 16,
      ly - 18,
      'left',
    )
  }

  // current part, top left
  const part = s.parts.find((q) => s.time >= q.start && s.time < q.end)
  if (part) {
    ctx.font = `700 13px ${FONT}`
    const w = ctx.measureText(part.name).width
    ctx.fillStyle = LABEL_BG
    roundRect(ctx, 10, 10, w + 30, 24, 6)
    ctx.fill()
    ctx.fillStyle = part.color
    ctx.beginPath()
    ctx.arc(21, 22, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = WHITE
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(part.name, 32, 22.5)
  }
}
