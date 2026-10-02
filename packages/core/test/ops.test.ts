import { describe, expect, it } from 'vitest'
import {
  copySelection,
  deleteSelection,
  dragEnd,
  fromPoc,
  mergeSelection,
  mirrorSelection,
  paste,
  pasteOffset,
  pasteTargets,
  rotateSelection,
  selKey,
  splitAt,
  type Arena,
  type Horse,
  type PasteLink,
  type PasteTarget,
  type Point,
} from '../src'
import { globalGaits, readFixture, uuid, type PocGait } from './helpers'

interface OpFixture {
  name: string
  before: Record<string, unknown> & { gaits?: PocGait[] }
  after: Record<string, unknown>
  info: {
    picks?: [number, number][]
    follow?: boolean
    angle?: number
    mode?: 'hand' | 'ac' | 'eb'
    horse?: number
    i?: number
    f?: number
    scale?: number
    ok?: boolean
    k?: number
    E?: Point
    active?: number
    target?: 'same' | 'from'
    link?: PasteLink
    off?: Point
    targets?: (number | null)[]
  }
  field: { w: number; h: number }
}

const ops = readFixture<OpFixture[]>('ops.json')
const DEFAULT_GAITS: PocGait[] = [
  { id: 'g1', name: 'Schritt', w: 1.6, o: 1.7, md: 2, c: '#A8DCC4' },
  { id: 'g2', name: 'Trab', w: 3.6, o: 3.9, md: 6, c: '#9CC5EA' },
  { id: 'g3', name: 'Galopp', w: 5.5, o: 6.0, md: 8, c: '#F6C1A0' },
]
const { gaits } = globalGaits(DEFAULT_GAITS)

function load(data: Record<string, unknown>): Horse[] {
  let n = 0
  const res = fromPoc(data, { gaits, newId: () => uuid(5000 + n++), title: 'x' })
  if (!res.ok) throw new Error('import')
  return res.plan.horses
}
// compare only what the prototype knows (ids are generated on import)
const strip = (hs: Horse[]) => hs.map(({ path, pending, tack }) => ({ path, pending, tack }))

describe.each(ops.map((o) => [o.name, o] as const))('golden op: %s', (_, op) => {
  it('matches the prototype', () => {
    const horses = load(op.before)
    const expected = strip(load(op.after))
    const keys = (op.info.picks ?? []).map(([h, k]) => selKey(horses[h]?.id ?? '', k))
    const arena: Arena = { imageId: null, lengthM: op.field.w, widthM: op.field.h }
    const ctx = { gaits }
    const kind = op.name.split('-')[0]
    let result: Horse[]
    if (kind === 'rotate')
      result = rotateSelection(horses, keys, op.info.angle ?? 0, !!op.info.follow)
    else if (kind === 'mirror')
      result = mirrorSelection(horses, keys, op.info.mode ?? 'hand', !!op.info.follow, arena)
    else if (kind === 'delete') result = deleteSelection(horses, keys, ctx)
    else if (kind === 'merge') result = mergeSelection(horses, keys)
    else if (kind === 'split') {
      const h = horses[op.info.horse ?? -1] as Horse
      const r = splitAt(h.path, op.info.i ?? 0, op.info.f ?? 0, 4 / (op.info.scale ?? 1))
      expect(!!r).toBe(op.info.ok)
      result = horses.map((q) => (q === h && r ? { ...q, path: r.path } : q))
    } else if (kind === 'regenerate') {
      const h = horses[op.info.horse ?? -1] as Horse
      const path = dragEnd(h.path, op.info.k ?? 0, op.info.E ?? { x: 0, y: 0 }, false, { gaits })
      result = horses.map((q) => (q === h && path ? { ...q, path } : q))
    } else if (kind === 'paste') {
      const clip = copySelection(horses, keys, ctx)
      if (!clip) throw new Error('nothing copied')
      const activeId = horses[op.info.active ?? 0]?.id ?? null
      const target: PasteTarget = op.info.target ?? 'same'
      const targets = pasteTargets(clip, horses, activeId, target)
      expect(targets.map((t) => (t ? horses.indexOf(t) : null))).toEqual(op.info.targets)
      const off = op.info.off ?? { x: 0, y: 0 }
      result = paste(horses, clip, { activeId, target, link: op.info.link ?? 'line', off }, ctx)
    } else throw new Error('unknown op ' + op.name)
    expect(strip(result)).toEqual(expected)
  })
})

describe('paste position', () => {
  const horses = load(ops.find((o) => o.name === 'paste-single-end-line')?.before ?? {})
  it('puts a single part at the end of the active horse, several parts at their place', () => {
    const one = copySelection(horses, [selKey(horses[0]?.id ?? '', 2)], { gaits })
    if (!one) throw new Error('copy')
    expect(pasteOffset(one, horses[2] ?? null, 'end')).toEqual({ x: 13, y: 5 })
    expect(pasteOffset(one, horses[2] ?? null, 'orig')).toEqual({ x: 0, y: 0 })
    expect(pasteOffset(one, horses[3] ?? null, 'end')).toEqual({ x: 0, y: 0 }) // empty path
  })
})
