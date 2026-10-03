import { z } from 'zod'
import { normalize, type NormalizeOptions } from './path'
import {
  horseSchema,
  partSchema,
  pathSchema,
  pendingSchema,
  planContentSchema,
  planSettingsSchema,
  timingSchema,
  type Horse,
  type Part,
  type PlanContent,
} from './schemas'

/** Fields of a horse that change one by one (the path travels as a whole, see `horsePath`). */
const horseFieldsSchema = z
  .object({
    number: horseSchema.shape.number,
    name: horseSchema.shape.name,
    color: horseSchema.shape.color,
    tack: horseSchema.shape.tack,
  })
  .partial()
  .strict()

/**
 * One change of a plan document (SPEC "Speichern und Konflikte"). Last write wins per field; a
 * horse's path is replaced as a whole because its points have no ids. Every operation is
 * idempotent, so a resend after a reconnect is harmless.
 */
export const singleOpSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('title'), title: planContentSchema.shape.title }),
  z.object({ t: z.literal('timing'), patch: timingSchema.partial() }),
  z.object({ t: z.literal('settings'), patch: planSettingsSchema.partial() }),
  z.object({ t: z.literal('horseAdd'), horse: horseSchema }),
  z.object({ t: z.literal('horseRemove'), id: z.uuid() }),
  z.object({ t: z.literal('horse'), id: z.uuid(), patch: horseFieldsSchema }),
  z.object({
    t: z.literal('horsePath'),
    id: z.uuid(),
    path: pathSchema,
    pending: pendingSchema.nullable(),
  }),
  z.object({ t: z.literal('partSet'), part: partSchema }),
  z.object({ t: z.literal('partRemove'), id: z.uuid() }),
])

/** Several operations applied together; one undo step. */
export const batchOpSchema = z.object({
  t: z.literal('batch'),
  ops: z.array(singleOpSchema).min(1).max(100),
})

export const opSchema = z.union([singleOpSchema, batchOpSchema])

export type SingleOp = z.infer<typeof singleOpSchema>
export type PlanOp = z.infer<typeof opSchema>

function mapHorse(c: PlanContent, id: string, fn: (h: Horse) => Horse): PlanContent {
  if (!c.horses.some((h) => h.id === id)) return c
  return { ...c, horses: c.horses.map((h) => (h.id === id ? fn(h) : h)) }
}

function applySingle(c: PlanContent, op: SingleOp): PlanContent {
  switch (op.t) {
    case 'title':
      return { ...c, title: op.title }
    case 'timing':
      return { ...c, timing: { ...c.timing, ...op.patch } }
    case 'settings':
      return { ...c, settings: { ...c.settings, ...op.patch } }
    case 'horseAdd':
      return c.horses.some((h) => h.id === op.horse.id)
        ? c
        : { ...c, horses: [...c.horses, op.horse] }
    case 'horseRemove':
      return c.horses.some((h) => h.id === op.id)
        ? { ...c, horses: c.horses.filter((h) => h.id !== op.id) }
        : c
    case 'horse':
      return mapHorse(c, op.id, (h) => ({ ...h, ...op.patch }))
    case 'horsePath':
      return mapHorse(c, op.id, (h) => ({ ...h, path: op.path, pending: op.pending }))
    case 'partSet':
      return c.parts.some((p) => p.id === op.part.id)
        ? { ...c, parts: c.parts.map((p) => (p.id === op.part.id ? op.part : p)) }
        : { ...c, parts: [...c.parts, op.part] }
    case 'partRemove':
      return c.parts.some((p) => p.id === op.id)
        ? { ...c, parts: c.parts.filter((p) => p.id !== op.id) }
        : c
  }
}

/**
 * Applies an operation. Pure and structural: untouched horses and parts keep their object
 * identity, and an operation on something that no longer exists changes nothing.
 */
export function applyOp(c: PlanContent, op: PlanOp): PlanContent {
  if (op.t !== 'batch') return applySingle(c, op)
  let next = c
  for (const o of op.ops) next = applySingle(next, o)
  return next
}

export function applyOps(c: PlanContent, ops: readonly PlanOp[]): PlanContent {
  let next = c
  for (const o of ops) next = applyOp(next, o)
  return next
}

function normalizeSingle(op: SingleOp, opts: NormalizeOptions): SingleOp {
  switch (op.t) {
    case 'horseAdd':
      return { ...op, horse: { ...op.horse, path: normalize(op.horse.path, opts) } }
    case 'horsePath':
      return { ...op, path: normalize(op.path, opts) }
    default:
      return op
  }
}

/** The server normalizes paths before applying and broadcasting (it never trusts the client). */
export function normalizeOp(op: PlanOp, opts: NormalizeOptions): PlanOp {
  if (op.t !== 'batch') return normalizeSingle(op, opts)
  return { t: 'batch', ops: op.ops.map((o) => normalizeSingle(o, opts)) }
}

function changedKeys<T extends object>(a: T, b: T): Partial<T> | null {
  const out: Partial<T> = {}
  let any = false
  for (const k of Object.keys(b) as (keyof T)[]) {
    if (a[k] !== b[k]) {
      out[k] = b[k]
      any = true
    }
  }
  return any ? out : null
}

const horseFields = (h: Horse) => ({ number: h.number, name: h.name, color: h.color, tack: h.tack })

/**
 * The operations that turn `before` into `after`. The plan document is replaced immutably on
 * every change, so unchanged horses and parts are recognized by object identity.
 */
export function diffOps(before: PlanContent, after: PlanContent): SingleOp[] {
  const ops: SingleOp[] = []
  if (before.title !== after.title) ops.push({ t: 'title', title: after.title })
  const timing = changedKeys(before.timing, after.timing)
  if (timing) ops.push({ t: 'timing', patch: timing })
  const settings = changedKeys(before.settings, after.settings)
  if (settings) ops.push({ t: 'settings', patch: settings })

  const oldHorses = new Map(before.horses.map((h) => [h.id, h]))
  const newHorseIds = new Set(after.horses.map((h) => h.id))
  for (const h of before.horses)
    if (!newHorseIds.has(h.id)) ops.push({ t: 'horseRemove', id: h.id })
  for (const h of after.horses) {
    const old = oldHorses.get(h.id)
    if (!old) {
      ops.push({ t: 'horseAdd', horse: h })
      continue
    }
    if (old === h) continue
    const patch = changedKeys(horseFields(old), horseFields(h))
    if (patch) ops.push({ t: 'horse', id: h.id, patch })
    if (old.path !== h.path || old.pending !== h.pending)
      ops.push({ t: 'horsePath', id: h.id, path: h.path, pending: h.pending })
  }

  const oldParts = new Map<string, Part>(before.parts.map((p) => [p.id, p]))
  const newPartIds = new Set(after.parts.map((p) => p.id))
  for (const p of before.parts) if (!newPartIds.has(p.id)) ops.push({ t: 'partRemove', id: p.id })
  for (const p of after.parts) if (oldParts.get(p.id) !== p) ops.push({ t: 'partSet', part: p })
  return ops
}

function mergeKey(op: SingleOp): string | null {
  switch (op.t) {
    case 'title':
    case 'timing':
    case 'settings':
      return op.t
    case 'horse':
      return `horse:${op.id}`
    case 'horsePath':
      return `path:${op.id}`
    case 'partSet':
      return `part:${op.part.id}`
    default:
      return null
  }
}

function merge(a: SingleOp, b: SingleOp): SingleOp {
  if (a.t === 'timing' && b.t === 'timing')
    return { t: 'timing', patch: { ...a.patch, ...b.patch } }
  if (a.t === 'settings' && b.t === 'settings')
    return { t: 'settings', patch: { ...a.patch, ...b.patch } }
  if (a.t === 'horse' && b.t === 'horse') return { ...b, patch: { ...a.patch, ...b.patch } }
  return b
}

/** Merges neighbouring operations on the same target (typing in a field sends one operation). */
export function coalesceOps(ops: readonly SingleOp[]): SingleOp[] {
  const out: SingleOp[] = []
  for (const op of ops) {
    const last = out.at(-1)
    const key = mergeKey(op)
    if (last && key !== null && mergeKey(last) === key) out[out.length - 1] = merge(last, op)
    else out.push(op)
  }
  return out
}

/** Horses whose path or existence an operation changes (their undo steps become void). */
export function pathTargets(op: PlanOp): string[] {
  switch (op.t) {
    case 'batch':
      return op.ops.flatMap((o) => pathTargets(o))
    case 'horsePath':
    case 'horseRemove':
      return [op.id]
    default:
      return []
  }
}
