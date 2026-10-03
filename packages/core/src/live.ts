import { z } from 'zod'
import { opSchema } from './ops'
import { planSchema } from './schemas'

/** Selected section as `horseId:k` (same keys as the editor selection). */
const selectionKey = z.string().regex(/^[0-9a-f-]{36}:\d{1,6}$/i)

export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('op'), seq: z.int().min(0), op: opSchema }),
  z.object({
    type: z.literal('presence'),
    activeHorseId: z.uuid().nullable(),
    selection: z.array(selectionKey).max(2000),
  }),
  z.object({ type: z.literal('ping') }),
])

/** Someone in the plan (one entry per connection). */
export const peerSchema = z.object({
  peerId: z.string(),
  userId: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  activeHorseId: z.uuid().nullable(),
  selection: z.array(selectionKey),
})

export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('hello'),
    you: z.string(),
    role: z.enum(['viewer', 'editor', 'owner']),
    plan: planSchema,
    peers: z.array(peerSchema),
  }),
  z.object({
    type: z.literal('ack'),
    seq: z.int().min(0),
    revision: z.int().min(0),
    op: opSchema.optional(),
  }),
  z.object({ type: z.literal('reject'), seq: z.int().min(0), reason: z.string() }),
  z.object({ type: z.literal('op'), revision: z.int().min(0), op: opSchema }),
  z.object({ type: z.literal('presence'), peer: peerSchema }),
  z.object({ type: z.literal('leave'), peerId: z.string() }),
  z.object({ type: z.literal('pong') }),
])

export type ClientMessage = z.infer<typeof clientMessageSchema>
export type ServerMessage = z.infer<typeof serverMessageSchema>
export type PeerInfo = z.infer<typeof peerSchema>

/** Stable colour per user (hue from a hash of the id); presence markers only. */
export function peerColor(userId: string): string {
  let h = 0
  for (const ch of userId) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return `hsl(${h % 360} 70% 45%)`
}

/** Colours of the people who selected a section (`horseId:k`) or work on a horse. */
export function peerMarks(peers: readonly PeerInfo[]): {
  sections: Map<string, string[]>
  horses: Map<string, string[]>
} {
  const sections = new Map<string, string[]>()
  const horses = new Map<string, string[]>()
  const add = (m: Map<string, string[]>, key: string, color: string) => {
    const list = m.get(key)
    if (!list) m.set(key, [color])
    else if (!list.includes(color)) list.push(color)
  }
  for (const p of peers) {
    const color = peerColor(p.userId)
    if (p.activeHorseId) add(horses, p.activeHorseId, color)
    for (const key of p.selection) add(sections, key, color)
  }
  return { sections, horses }
}
