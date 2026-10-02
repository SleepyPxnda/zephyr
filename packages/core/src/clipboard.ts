import { selectionGroups, type HorseContext } from './edit'
import { clonePoint, fromStrokes, normalizeStrokes, sectionGeom, sectionRange, toStrokes, type Strokes } from './path'
import type { Horse, PathPoint, Point } from './schemas'
import { timeline } from './timeline'
import { dist, r2 } from './vec'

/** Copied sections of one horse; non-adjacent runs are joined by a pause that keeps their timing. */
export interface ClipPart extends Strokes {
  /** horse the part was copied from */
  from: string
  /** start time of the first copied section */
  t0: number
  /** offset to the earliest copied part (s) */
  tOff: number
}

export interface Clipboard {
  parts: ClipPart[]
  /** number of copied sections (for the label) */
  sections: number
}

function copyPart(horse: Horse, ks: readonly number[], ctx: HorseContext): ClipPart {
  const path = horse.path
  const src = toStrokes(path)
  const tl = timeline(path, { gaits: ctx.gaits, horseTack: horse.tack })
  const out: Strokes = { pts: [], strokes: [], sg: [], gaps: [], gt: [], tack: [] }
  let prevEndT = 0
  const runs: number[][] = []
  ks.forEach((k) => {
    const r = runs[runs.length - 1]
    if (r && r[r.length - 1] === k - 1) r.push(k)
    else runs.push([k])
  })
  runs.forEach((run, ri) => {
    const k0 = run[0] as number
    const g0 = sectionGeom(path, k0)
    const e = sectionRange(path, run[run.length - 1] as number).e
    const base = out.pts.length
    src.pts.slice(g0.si, e + 1).forEach((q, i) => {
      const o = clonePoint(q)
      if (i === 0) {
        delete o.jump
        // a later run starts with a (hidden) jump to its start point
        if (ri > 0) o.jump = true
      }
      out.pts.push(o)
    })
    run.forEach((k, j) => {
      out.strokes.push(j === 0 ? (ri === 0 ? 0 : base) : (src.strokes[k] as number) - g0.si + base)
      out.sg.push(src.sg[k] as string)
      out.tack.push(src.tack[k] ?? null)
      if (j === 0) {
        out.gaps.push(ri === 0 ? 0 : Math.max(0, (tl.secs[k]?.start ?? 0) - prevEndT))
        out.gt.push(ri === 0 ? null : 'pause')
      } else {
        out.gaps.push(src.gaps[k] || 0)
        out.gt.push(src.gt[k] || null)
      }
    })
    prevEndT = tl.ts[e] ?? 0
  })
  return { ...out, from: horse.id, t0: tl.secs[ks[0] as number]?.start ?? 0, tOff: 0 }
}

/** Copies exactly the selected sections, also non-adjacent and across horses (Strg+C). */
export function copySelection(horses: readonly Horse[], keys: Iterable<string>, ctx: HorseContext): Clipboard | null {
  const groups = selectionGroups(horses, keys)
  const parts = groups.filter((g) => g.horse.path.pts.length > 1 && g.ks.length).map((g) => copyPart(g.horse, g.ks, ctx))
  if (!parts.length) return null
  const tMin = Math.min(...parts.map((q) => q.t0))
  parts.forEach((q) => (q.tOff = q.t0 - tMin))
  return { parts, sections: groups.reduce((m, g) => m + g.ks.length, 0) }
}

/** "Dieselben" = the horses the parts came from; "Ab gewähltem Pferd" = the active horse and the next ones. */
export type PasteTarget = 'same' | 'from'
/** How a pasted part joins the path end: straight line or pause (jump). */
export type PasteLink = 'line' | 'gap'

/** Which horse receives which part (null = no horse). A single part always goes to the active horse. */
export function pasteTargets(clip: Clipboard, horses: readonly Horse[], activeId: string | null, target: PasteTarget): (Horse | null)[] {
  if (clip.parts.length === 1) return horses.filter((h) => h.id === activeId).slice(0, 1)
  if (target === 'same') return clip.parts.map((q) => horses.find((h) => h.id === q.from) ?? null)
  const i0 = Math.max(0, horses.findIndex((h) => h.id === activeId))
  return clip.parts.map((_, i) => horses[i0 + i] ?? null)
}

/** Where the path of a horse continues; none after an announced pause. */
export const pasteAnchor = (h: Horse | null): Point | null => {
  const l = h?.path.pts[h.path.pts.length - 1]
  return l && !h?.pending?.jump ? l : null
}

/** Offset for the paste preview: at the path end of the first target, or at the original place. */
export function pasteOffset(clip: Clipboard, firstTarget: Horse | null, kind: 'end' | 'orig'): Point {
  const end = pasteAnchor(firstTarget)
  const first = clip.parts[0]?.pts[0]
  return kind === 'end' && end && first ? { x: end.x - first.x, y: end.y - first.y } : { x: 0, y: 0 }
}

/** Points of a part moved by `off`, as the preview shows them. */
export function partPoints(part: ClipPart, off: Point): PathPoint[] {
  return part.pts.map((q) => {
    const o: PathPoint = { x: r2(q.x + off.x), y: r2(q.y + off.y) }
    if (q.jump) o.jump = true
    if (q.geo) {
      const g = clonePoint(q).geo
      if (g) {
        g.E = { x: q.geo.E.x + off.x, y: q.geo.E.y + off.y }
        if (q.geo.M) g.M = { x: q.geo.M.x + off.x, y: q.geo.M.y + off.y }
        o.geo = g
      }
    }
    return o
  })
}

export interface PasteOptions {
  activeId: string | null
  target: PasteTarget
  link: PasteLink
  off: Point
}

/**
 * Pastes the clipboard (prototype `doPaste`). Several parts keep their time offsets: they start
 * after the latest end of the receiving horses. A part continues at the path end (shared
 * point) or, when it starts elsewhere, with a straight line or a pause; an announced
 * halt/pause becomes the gap before it.
 */
export function paste(horses: readonly Horse[], clip: Clipboard, o: PasteOptions, ctx: HorseContext): Horse[] {
  const targets = pasteTargets(clip, horses, o.activeId, o.target)
  const used = targets.filter((h): h is Horse => !!h)
  if (!used.length) return [...horses]
  const total = (h: Horse) => timeline(h.path, { gaits: ctx.gaits, horseTack: h.tack }).total
  const base = Math.max(0, ...used.map((h) => (h.path.pts.length ? total(h) : 0)))
  const multi = clip.parts.length > 1
  const changed = new Map<string, Horse>()
  clip.parts.forEach((part, pi) => {
    const target = targets[pi]
    if (!target) return
    const h = changed.get(target.id) ?? target
    const pts = partPoints(part, o.off)
    if (!pts.length) return
    const startAt = multi ? base + part.tOff : 0
    const p = toStrokes(h.path)
    let pending = h.pending
    if (!p.pts.length) {
      p.pts = pts
      p.strokes = [...part.strokes]
      p.sg = [...part.sg]
      p.gaps = [...part.gaps]
      p.gt = [...part.gt]
      p.tack = [...part.tack]
      p.gaps[0] = startAt
    } else {
      const end = p.pts[p.pts.length - 1] as PathPoint
      const first = pts[0] as PathPoint
      const pendJump = !!pending?.jump
      const joined = dist(end, first) > 0.05
      const asJump = pendJump || (joined && o.link === 'gap')
      const off = p.pts.length
      const useAll = joined || pendJump
      const add = useAll ? pts.map(clonePoint) : pts.slice(1)
      const shift = useAll ? 0 : -1
      if (useAll && asJump && add[0]) add[0].jump = true
      const pg = pending && pending.gap > 0 ? pending : null
      const endT = total(h)
      part.strokes.forEach((st, i) => {
        p.strokes.push(Math.max(0, st + shift) + off)
        p.sg.push(part.sg[i] as string)
        p.tack.push(part.tack[i] ?? null)
        if (i === 0) {
          p.gaps.push(multi ? Math.max(0, startAt - endT) : pg ? pg.gap : 0)
          p.gt.push(pg ? pg.gapType : asJump ? 'pause' : 'halt')
        } else {
          p.gaps.push(part.gaps[i] || 0)
          p.gt.push(part.gt[i] || null)
        }
      })
      add.forEach((q) => p.pts.push(q))
      pending = null
    }
    normalizeStrokes(p)
    changed.set(h.id, { ...h, path: fromStrokes(p), pending })
  })
  return horses.map((h) => changed.get(h.id) ?? h)
}
