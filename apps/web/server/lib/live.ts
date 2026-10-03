import {
  applyOp,
  clientMessageSchema,
  normalizeOp,
  type PeerInfo,
  type PlanOp,
  type ServerMessage,
} from '@zephyr/core'
import { eq } from 'drizzle-orm'
import type { Peer } from 'crossws'
import { plans } from '../db/schema'
import { hasRole, planRoleOf, type PlanRole } from './access'
import { log } from './log'
import { checkContent, loadGaits, loadPlan, writeContent } from './plans'

/** Set by the upgrade handler (`server/routes/ws/plans/[id].ts`) on `peer.context`. */
export interface LiveContext {
  planId: string
  userId: string
  name: string
  avatarUrl: string | null
  role: PlanRole
}

interface Member {
  peer: Peer
  userId: string
  name: string
  avatarUrl: string | null
  role: PlanRole
  activeHorseId: string | null
  selection: string[]
  /** times of the last operations, for the rate limit */
  recent: number[]
}

interface Room {
  planId: string
  members: Map<string, Member>
  /** operations of one plan run strictly one after another */
  queue: Promise<void>
}

/** One server instance only (decision of the user): rooms live in memory. */
const rooms = new Map<string, Room>()

const MAX_MESSAGE_CHARS = 5_000_000
const RATE_WINDOW_MS = 2000
const RATE_MAX = 40

const ctxOf = (peer: Peer) => peer.context as unknown as LiveContext
const send = (peer: Peer, msg: ServerMessage) => peer.send(JSON.stringify(msg))

function broadcast(room: Room, exceptPeerId: string, msg: ServerMessage) {
  const text = JSON.stringify(msg)
  for (const m of room.members.values()) if (m.peer.id !== exceptPeerId) m.peer.send(text)
}

const infoOf = (m: Member): PeerInfo => ({
  peerId: m.peer.id,
  userId: m.userId,
  name: m.name,
  avatarUrl: m.avatarUrl,
  activeHorseId: m.activeHorseId,
  selection: m.selection,
})

const peersOf = (room: Room, exceptPeerId: string): PeerInfo[] =>
  [...room.members.values()].filter((m) => m.peer.id !== exceptPeerId).map(infoOf)

export async function join(peer: Peer): Promise<void> {
  const ctx = ctxOf(peer)
  const plan = await loadPlan(useDb(), ctx.planId)
  if (!plan) {
    peer.close(1008, 'gone')
    return
  }
  let room = rooms.get(ctx.planId)
  if (!room) {
    room = { planId: ctx.planId, members: new Map(), queue: Promise.resolve() }
    rooms.set(ctx.planId, room)
  }
  const member: Member = {
    peer,
    userId: ctx.userId,
    name: ctx.name,
    avatarUrl: ctx.avatarUrl,
    role: ctx.role,
    activeHorseId: null,
    selection: [],
    recent: [],
  }
  room.members.set(peer.id, member)
  send(peer, {
    type: 'hello',
    you: peer.id,
    role: member.role,
    plan,
    peers: peersOf(room, peer.id),
  })
  broadcast(room, peer.id, { type: 'presence', peer: infoOf(member) })
}

export function leave(peer: Peer): void {
  const room = rooms.get(ctxOf(peer).planId)
  if (!room) return
  room.members.delete(peer.id)
  if (!room.members.size) rooms.delete(room.planId)
  else broadcast(room, peer.id, { type: 'leave', peerId: peer.id })
}

export function handle(peer: Peer, text: string): void {
  const room = rooms.get(ctxOf(peer).planId)
  const member = room?.members.get(peer.id)
  if (!room || !member) return
  if (text.length > MAX_MESSAGE_CHARS) {
    peer.close(1009, 'too big')
    return
  }
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    peer.close(1003, 'bad message')
    return
  }
  const parsed = clientMessageSchema.safeParse(json)
  if (!parsed.success) {
    peer.close(1003, 'bad message')
    return
  }
  const m = parsed.data
  if (m.type === 'ping') {
    send(peer, { type: 'pong' })
    return
  }
  if (m.type === 'presence') {
    member.activeHorseId = m.activeHorseId
    member.selection = m.selection
    broadcast(room, peer.id, { type: 'presence', peer: infoOf(member) })
    return
  }
  if (!hasRole(member.role, 'editor')) {
    send(peer, { type: 'reject', seq: m.seq, reason: 'forbidden' })
    return
  }
  const now = Date.now()
  member.recent = member.recent.filter((t) => now - t < RATE_WINDOW_MS)
  member.recent.push(now)
  if (member.recent.length > RATE_MAX) {
    peer.close(1008, 'rate limit')
    return
  }
  room.queue = room.queue
    .then(() => processOp(room, member, m.seq, m.op))
    .catch((e) => log.error('live operation failed', { err: e }))
}

type Outcome = { ok: true; revision: number; op: PlanOp } | { ok: false; reason: string }

/**
 * One operation: lock the plan row, apply, check and normalize like a `PUT`, write
 * `revision + 1`, then confirm to the sender and broadcast to everyone else.
 */
async function processOp(room: Room, member: Member, seq: number, op: PlanOp): Promise<void> {
  let outcome: Outcome
  try {
    outcome = await useDb().transaction(async (tx): Promise<Outcome> => {
      const [row] = await tx.select().from(plans).where(eq(plans.id, room.planId)).for('update')
      if (!row || row.deletedAt) return { ok: false, reason: 'gone' }
      const current = await loadPlan(tx, room.planId)
      if (!current) return { ok: false, reason: 'gone' }
      const gaitIds = (await loadGaits(tx)).map((g) => g.id)
      const normalized = normalizeOp(op, { gaitIds })
      const { id: _id, revision: _revision, ...content } = current
      const check = await checkContent(tx, applyOp(content, normalized), {
        userId: member.userId,
        currentMusicId: row.musicId,
      })
      if (!check.ok) return { ok: false, reason: 'invalid' }
      await writeContent(tx, room.planId, check.content, row.revision + 1)
      return { ok: true, revision: row.revision + 1, op: normalized }
    })
  } catch (e) {
    log.error('live transaction failed', { err: e })
    outcome = { ok: false, reason: 'error' }
  }
  if (!outcome.ok) {
    send(member.peer, { type: 'reject', seq, reason: outcome.reason })
    return
  }
  const changed = JSON.stringify(outcome.op) !== JSON.stringify(op)
  send(member.peer, {
    type: 'ack',
    seq,
    revision: outcome.revision,
    ...(changed ? { op: outcome.op } : {}),
  })
  broadcast(room, member.peer.id, { type: 'op', revision: outcome.revision, op: outcome.op })
}

/**
 * After a change outside the socket (PUT, PATCH, delete, sharing): everyone gets a fresh
 * `hello`; people who lost access (or whose plan is gone) are disconnected.
 */
export function refresh(planId: string): Promise<void> {
  const room = rooms.get(planId)
  if (!room) return Promise.resolve()
  room.queue = room.queue
    .then(async () => {
      const db = useDb()
      const plan = await loadPlan(db, planId)
      for (const m of [...room.members.values()]) {
        const role = plan ? await planRoleOf(db, m.userId, planId) : null
        if (!plan || !role) {
          m.peer.close(1008, 'no access')
          continue
        }
        m.role = role
        send(m.peer, {
          type: 'hello',
          you: m.peer.id,
          role,
          plan,
          peers: peersOf(room, m.peer.id),
        })
      }
    })
    .catch((e) => log.error('live refresh failed', { err: e }))
  return room.queue
}

/** A blocked account loses its connections at once. */
export function dropUser(userId: string): void {
  for (const room of rooms.values())
    for (const m of room.members.values())
      if (m.userId === userId) m.peer.close(1008, 'account blocked')
}
