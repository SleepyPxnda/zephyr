import { z } from 'zod'
import type { Gait, Horse, Point } from './schemas'
import { sectionOf } from './path'
import { posAt, timeline } from './timeline'
import { dist } from './vec'

export const CHAT_MAX_CHARS = 1000

const refName = z.string().max(60)

/** A spot in the plan attached to a chat message; the colour is looked up by id, not stored. */
export const chatRefSchema = z
  .object({
    t: z.number().min(0).max(1_000_000).nullable(),
    pos: z
      .object({ x: z.number().min(-100).max(1000), y: z.number().min(-100).max(1000) })
      .nullable(),
    horse: z
      .object({ id: z.uuid(), name: refName, k: z.int().min(0).max(999_999).nullable() })
      .nullable(),
    part: z.object({ id: z.uuid(), name: refName }).nullable(),
  })
  .refine((r) => r.t !== null || r.pos !== null || r.horse !== null || r.part !== null, {
    message: 'empty ref',
  })

export type ChatRef = z.infer<typeof chatRefSchema>

/** Narrows a ref to its time or position only ("Zeit senden", "Position senden"). */
export function refPick(ref: ChatRef, only: 'all' | 't' | 'pos'): ChatRef {
  if (only === 't') return { t: ref.t, pos: null, horse: null, part: null }
  if (only === 'pos') return { t: null, pos: ref.pos, horse: null, part: null }
  return ref
}

export type ChatToken =
  | { kind: 'text'; s: string }
  | { kind: 'horse' | 'part'; id: string; s: string }
  | { kind: 'time'; s: string }

interface Named {
  id: string
  name: string
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Splits chat text into plain text, horse and part names (whole words, case-insensitive, the
 * longer name wins) and clock times like `1:23` or `1:23,5`.
 */
export function chatTokens(
  text: string,
  names: { horses: readonly Named[]; parts: readonly Named[] },
): ChatToken[] {
  const all = [...names.horses, ...names.parts].filter((n) => n.name.trim() !== '')
  const alts = [...new Set(all.map((n) => n.name))]
    .sort((a, b) => b.length - a.length)
    .map(escapeRe)
  const time = '\\d{1,3}:[0-5]\\d(?:[.,]\\d{1,2})?'
  const body = alts.length ? `(?<time>${time})|(?<name>${alts.join('|')})` : `(?<time>${time})`
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, 'giu')
  const find = (list: readonly Named[], s: string) =>
    list.find((n) => n.name.toLowerCase() === s.toLowerCase())
  const out: ChatToken[] = []
  let last = 0
  for (const m of text.matchAll(re)) {
    const s = m[0]
    const at = m.index
    if (m.groups?.time) {
      if (at > last) out.push({ kind: 'text', s: text.slice(last, at) })
      out.push({ kind: 'time', s })
    } else {
      const horse = find(names.horses, s)
      const part = horse ? undefined : find(names.parts, s)
      const hit = horse ?? part
      if (!hit) continue
      if (at > last) out.push({ kind: 'text', s: text.slice(last, at) })
      out.push({ kind: horse ? 'horse' : 'part', id: hit.id, s })
    }
    last = at + s.length
  }
  if (last < text.length) out.push({ kind: 'text', s: text.slice(last) })
  return out
}

/** The visible horse nearest to `p` at time `t` (within `tol` metres), with its current section. */
export function horseNear(
  horses: readonly Horse[],
  gaits: readonly Gait[],
  t: number,
  p: Point,
  tol = 1,
): { id: string; name: string; k: number } | null {
  let best: { id: string; name: string; k: number } | null = null
  let bestD = tol
  for (const h of horses) {
    if (!h.path.pts.length) continue
    const pos = posAt(h.path, timeline(h.path, { gaits, horseTack: h.tack }), t, h.pending)
    if (!pos || pos.hidden) continue
    const d = dist(pos, p)
    if (d <= bestD) {
      bestD = d
      best = { id: h.id, name: h.name, k: sectionOf(h.path, pos.i) }
    }
  }
  return best
}
