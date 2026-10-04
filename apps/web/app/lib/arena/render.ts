import {
  effectiveTack,
  headingAt,
  isLightColor,
  posAt,
  scaleBarMetres,
  sectionGeom,
  sectionOf,
  sectionRange,
  toScreen,
  type ArenaSize,
  type Gait,
  type Horse,
  type Part,
  type PathPoint,
  type Point,
  type TimeRange,
  type Timeline,
  type ViewTransform,
  type Viewport,
  visiblePoints,
} from '@zephyr/core'

// Canvas colours do not follow the UI theme: the hall image looks the same in light and dark.
/** SPEC: thin dark outline (#2E2A3D, 60 %) so pastel paths and horses stay readable on the hall. */
const OUTLINE = 'rgba(46, 42, 61, 0.6)'
const INK = '#2E2A3D'
const LABEL_BG = 'rgba(30, 26, 20, 0.78)'
const WHITE = '#FFFFFF'
const TIGHT = 'rgba(214, 40, 40, 0.75)'
const TIGHT_SOLID = '#D62828'
const MARGIN_BG = '#16161D'
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
  /** preview of the line, arc or volte being drawn */
  ghost: {
    start: Point
    figure: { pts: readonly Point[]; tight: boolean; center?: Point; R?: number }
    color: string
    label: string
    at: Point
  } | null
  /** where a click with the split tool would cut */
  splitHover: Point | null
  /** selected sections as horseId:k */
  selection: readonly string[]
  /** colours of the other people who selected a section (horseId:k) */
  peerMarks?: ReadonlyMap<string, readonly string[]>
  handles: readonly { kind: string; x: number; y: number; pivot?: Point }[]
  overlay: { text: string; at: Point } | null
  /** parts about to be pasted */
  pastePreview: readonly { color: string; pts: readonly PathPoint[]; from: Point | null }[]
  /** focused part: only paths that touch this time range are drawn */
  range?: TimeRange | null
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
  /** segments (by end point) left out, e.g. connecting lines drawn on their own */
  skip?: ReadonlySet<number>,
  /** first point to draw (focus window) */
  from = 0,
) {
  const first = pts[from]
  if (!first) return
  ctx.beginPath()
  let [x, y] = px(t, first)
  ctx.moveTo(x, y)
  for (let i = from + 1; i <= to && i < pts.length; i++) {
    const q = pts[i] as PathPoint
    ;[x, y] = px(t, q)
    if (q.jump || skip?.has(i)) ctx.moveTo(x, y)
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
    const vis = visiblePoints(h.path, tl, s.range ?? null)
    const from = vis?.from ?? 0
    const to = vis?.to ?? -1
    const inWin = (i: number) => !!vis && i >= from && i <= to
    if (shown(h) && vis) {
      // planned path, dashed; automatic connecting lines thin and finely dashed
      const links = new Set(h.path.sections.flatMap((sec) => (sec.link ? [sec.start] : [])))
      ctx.save()
      ctx.globalAlpha = active ? 0.8 : 0.55
      ctx.setLineDash([6, 6])
      strokePath(ctx, t, pts, to, null, h.color, 2, links, from)
      ctx.setLineDash([2, 4])
      ctx.lineWidth = 1.5
      ctx.strokeStyle = h.color
      ctx.beginPath()
      for (const i of links) {
        if (i <= from || i > to) continue
        const a = pts[i - 1]
        const b = pts[i]
        if (!a || !b) continue
        ctx.moveTo(...px(t, a))
        ctx.lineTo(...px(t, b))
      }
      ctx.stroke()
      ctx.restore()
      const hd = headingAt(pts, pts.length - 1)
      const last = pts[pts.length - 1] as PathPoint
      if (hd !== null && to === pts.length - 1) {
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
        if (!at || !inWin(sec.start - 1)) return
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
    // selected sections: light band underneath; other people's selections in their colour
    h.path.sections.forEach((_, k) => {
      const key = `${h.id}:${k}`
      const bands: { color: string; width: number }[] = (s.peerMarks?.get(key) ?? []).map(
        (color, n) => ({ color, width: 16 - n * 3 }),
      )
      if (s.selection.includes(key)) bands.push({ color: WHITE, width: 12 })
      if (!bands.length) return
      const g = sectionGeom(h.path, k)
      for (const band of bands) {
        ctx.save()
        ctx.globalAlpha = 0.5
        ctx.lineWidth = band.width
        ctx.strokeStyle = band.color
        ctx.beginPath()
        let [hx, hy] = px(t, pts[g.si] as PathPoint)
        ctx.moveTo(hx, hy)
        for (let i = g.si + 1; i <= g.e; i++) {
          ;[hx, hy] = px(t, pts[i] as PathPoint)
          ctx.lineTo(hx, hy)
        }
        ctx.stroke()
        ctx.restore()
      }
    })
    // ridden so far, solid
    if (pos && pos.i > 0 && vis && pos.i - 1 >= from)
      strokePath(ctx, t, pts, pos.i - 1, pos.hidden ? null : pos, h.color, 3.5, undefined, from)
    if (shown(h)) {
      // section borders
      for (let k = 1; k < h.path.sections.length; k++) {
        if (!inWin((h.path.sections[k]?.start ?? 0) - 1)) continue
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
      const vis = visiblePoints(h.path, tl, s.range ?? null)
      ctx.beginPath()
      let open = false
      for (let i = 1; i < h.path.pts.length; i++) {
        if (!vis || i <= vis.from || i > vis.to) {
          open = false
          continue
        }
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
  const apTl = ap ? s.timelines.get(ap.id) : undefined
  const apVis = ap && apTl ? visiblePoints(ap.path, apTl, s.range ?? null) : null
  if (!s.onlyHorses && ap && ap.path.pts.length > 1) {
    ap.path.sections.forEach((sec, k) => {
      if (sec.link) return
      const { s: st, e } = sectionRange(ap.path, k)
      const from = Math.max(0, st - 1)
      if (e <= from) return
      if (!apVis || e <= apVis.from || st > apVis.to) return
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

  // paste preview: dashed in the colour of the receiving horse
  for (const part of s.pastePreview) {
    const first = part.pts[0]
    if (!first) continue
    ctx.save()
    ctx.setLineDash([8, 5])
    ctx.beginPath()
    let [qx, qy] = px(t, part.from ?? first)
    ctx.moveTo(qx, qy)
    part.pts.forEach((q, i) => {
      ;[qx, qy] = px(t, q)
      if (q.jump && i > 0) ctx.moveTo(qx, qy)
      else ctx.lineTo(qx, qy)
    })
    ctx.lineWidth = 6
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.stroke()
    ctx.lineWidth = 3
    ctx.strokeStyle = part.color
    ctx.stroke()
    ctx.restore()
  }

  // preview of the figure being drawn: dashed, red when tighter than the turning circle
  const g = s.ghost
  if (g && g.figure.pts.length) {
    ctx.save()
    if (g.figure.center && g.figure.R) {
      const [cx, cy] = px(t, g.figure.center)
      ctx.setLineDash([3, 4])
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.beginPath()
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.setLineDash([7, 5])
    ctx.beginPath()
    let [gx, gy] = px(t, g.start)
    ctx.moveTo(gx, gy)
    for (const q of g.figure.pts) {
      ;[gx, gy] = px(t, q)
      ctx.lineTo(gx, gy)
    }
    ctx.lineWidth = 5
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)'
    ctx.stroke()
    ctx.lineWidth = 2.5
    ctx.strokeStyle = g.figure.tight ? TIGHT_SOLID : g.color
    ctx.stroke()
    ctx.restore()
    if (g.label) {
      const [lx, ly] = px(t, g.at)
      ctx.font = `600 12px ${FONT}`
      const w = ctx.measureText(g.label).width
      const bx = Math.min(Math.max(4, lx + 14), vp.width - w - 16)
      label(ctx, g.label, bx + 6, Math.max(14, ly - 20), 'left')
    }
  }

  // split tool: where a click would cut
  if (s.splitHover) {
    const [hx, hy] = px(t, s.splitHover)
    const color = s.horses.find((h) => h.id === s.activeId)?.color ?? WHITE
    ctx.beginPath()
    ctx.arc(hx, hy, 7, 0, Math.PI * 2)
    ctx.fillStyle = WHITE
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = color
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(hx - 3, hy)
    ctx.lineTo(hx + 3, hy)
    ctx.moveTo(hx, hy - 3)
    ctx.lineTo(hx, hy + 3)
    ctx.lineWidth = 1.5
    ctx.strokeStyle = INK
    ctx.stroke()
  }

  // handles: end (circle), apex (diamond), start after a pause (square), rotate (⟳)
  if (s.handles.length) {
    const first = s.selection[0]?.split(':')[0]
    const col = s.horses.find((h) => h.id === first)?.color ?? WHITE
    for (const hd of s.handles) {
      const [hx, hy] = px(t, hd)
      ctx.save()
      ctx.lineWidth = 3
      ctx.strokeStyle = col
      if (hd.kind === 'rot' && hd.pivot) {
        const [pxv, pyv] = px(t, hd.pivot)
        ctx.save()
        ctx.setLineDash([3, 4])
        ctx.lineWidth = 1.2
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)'
        ctx.beginPath()
        ctx.moveTo(pxv, pyv)
        ctx.lineTo(hx, hy)
        ctx.stroke()
        ctx.restore()
        ctx.beginPath()
        ctx.arc(pxv, pyv, 3, 0, Math.PI * 2)
        ctx.fillStyle = WHITE
        ctx.fill()
      }
      ctx.beginPath()
      if (hd.kind === 'start') ctx.rect(hx - 6.5, hy - 6.5, 13, 13)
      else if (hd.kind === 'apex') {
        ctx.moveTo(hx, hy - 8)
        ctx.lineTo(hx + 8, hy)
        ctx.lineTo(hx, hy + 8)
        ctx.lineTo(hx - 8, hy)
        ctx.closePath()
      } else ctx.arc(hx, hy, hd.kind === 'rot' ? 9 : 7.5, 0, Math.PI * 2)
      ctx.fillStyle = WHITE
      ctx.fill()
      ctx.stroke()
      if (hd.kind === 'rot') {
        ctx.beginPath()
        ctx.lineWidth = 2
        ctx.arc(hx, hy, 4.5, -Math.PI * 0.9, Math.PI * 0.5)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(hx + 0.5, hy + 4.5)
        ctx.lineTo(hx - 3, hy + 2.5)
        ctx.lineTo(hx - 1, hy + 7)
        ctx.closePath()
        ctx.fillStyle = col
        ctx.fill()
      }
      ctx.restore()
    }
  }
  if (s.overlay) {
    const [lx, ly] = px(t, s.overlay.at)
    label(ctx, s.overlay.text, lx + 20, ly - 18, 'left')
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
