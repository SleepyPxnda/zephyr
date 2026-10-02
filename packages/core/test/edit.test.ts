import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  canMerge,
  dragApex,
  dragEnd,
  dragStart,
  editHandles,
  midPoint,
  mirrorSelection,
  moveSelection,
  parseSelKey,
  rotateHandle,
  rotateSelection,
  sectionGeom,
  selectionGroups,
  selKey,
  wholePathKeys,
  type Gait,
  type Horse,
  type Path,
  type PathPoint,
} from '../src'
import { uuid } from './helpers'

const GAITS: Gait[] = [{ id: uuid(1), name: 'Trab', color: '#9CC5EA', speedTack: 3.6, speedBare: 3.9, turnDiameter: 6, archivedAt: null }]
const sec = (start: number) => ({ start, gaitId: uuid(1), gap: 0, gapType: 'halt' as const, tack: null })
const horse = (n: number, path: Path): Horse => ({ id: uuid(700 + n), number: n, name: '', color: '#c0392b', tack: true, path, pending: null })
// straight freehand-like path along x with two sections
const straight: Path = { v: 1, pts: Array.from({ length: 9 }, (_, i) => ({ x: i, y: 0 })), sections: [sec(0), sec(5)] }

describe('selection', () => {
  const a = horse(1, straight)
  const b = horse(2, straight)
  it('groups keys by horse in selection order and drops invalid ones', () => {
    const g = selectionGroups([a, b], [selKey(b.id, 1), selKey(a.id, 1), selKey(b.id, 0), selKey(b.id, 0), selKey(a.id, 7), 'x:1'])
    expect(g.map((q) => [q.horse.id, q.ks])).toEqual([
      [b.id, [0, 1]],
      [a.id, [1]],
    ])
    expect(parseSelKey(selKey(a.id, 3))).toEqual({ horseId: a.id, k: 3 })
    expect(wholePathKeys([a])).toEqual([selKey(a.id, 0), selKey(a.id, 1)])
  })
  it('merging needs adjacent sections of one horse', () => {
    expect(canMerge(selectionGroups([a, b], [selKey(a.id, 0), selKey(a.id, 1)]))).toBe(true)
    expect(canMerge(selectionGroups([a, b], [selKey(a.id, 0), selKey(b.id, 1)]))).toBe(false)
    expect(canMerge(selectionGroups([a], [selKey(a.id, 1)]))).toBe(false)
  })
})

describe('move and handles', () => {
  it('moves the selected section, with "follow" everything after it', () => {
    const h = horse(1, straight)
    const only = moveSelection([h], [selKey(h.id, 0)], 1, 2, false)[0]?.path.pts
    expect(only?.slice(0, 5).every((q, i) => q.x === i + 1 && q.y === 2)).toBe(true)
    expect(only?.[5]).toEqual({ x: 5, y: 0 })
    const all = moveSelection([h], [selKey(h.id, 0)], 1, 2, true)[0]?.path.pts
    expect(all?.every((q, i) => q.x === i + 1 && q.y === 2)).toBe(true)
  })
  it('offers end, start and apex handles', () => {
    expect(editHandles(straight, 0).map((q) => q.kind)).toEqual(['end', 'start', 'apex'])
    expect(editHandles(straight, 1)).toEqual([
      { kind: 'end', x: 8, y: 0 },
      { kind: 'apex', x: 6, y: 0 },
    ])
    expect(midPoint(straight, sectionGeom(straight, 0))).toEqual({ x: 2, y: 0 })
  })
  it('places the rotate handle beside the far end, away from the arena bottom', () => {
    const h = horse(1, straight)
    const r = rotateHandle(selectionGroups([h], [selKey(h.id, 1)]), 1.5)
    // pivot = start of section 1 (point 4); far end 4 m away along +x; offset to −y
    expect(r).toEqual({ x: 8, y: -1.5, pivot: { x: 4, y: 0 } })
    expect(rotateHandle([], 1)).toBeNull()
  })
})

describe('shape drags (own reference cases)', () => {
  it('rubber band: the end moves fully, points follow by distance, the start stays', () => {
    const p = dragEnd(straight, 1, { x: 8, y: 4 }, false, { gaits: GAITS })
    // section 1 runs from point 4 (S) to point 8; weights 1/4, 2/4, 3/4, 1
    expect(p?.pts.slice(4).map((q) => q.y)).toEqual([0, 1, 2, 3, 4])
  })
  it('with "follow" the rest of the path moves with the end', () => {
    const p = dragEnd(straight, 0, { x: 4, y: 2 }, true, { gaits: GAITS })
    expect(p?.pts.slice(4).map((q) => q.y)).toEqual([2, 2, 2, 2, 2])
  })
  it('a remembered line is rebuilt to the new end', () => {
    const line: Path = {
      v: 1,
      pts: [{ x: 0, y: 0, geo: { kind: 'line', E: { x: 2, y: 0 }, hand: 'auto', half: false, round: true } }, { x: 0.5, y: 0 }, { x: 1, y: 0 }, { x: 1.5, y: 0 }, { x: 2, y: 0 }],
      sections: [sec(0)],
    }
    const p = dragEnd(line, 0, { x: 3, y: 0 }, false, { gaits: GAITS })
    expect(p?.pts.map((q) => q.x)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3])
    expect(p?.pts[0]?.geo?.E).toEqual({ x: 3, y: 0 })
  })
  it('apex on a figure makes an arc through start, apex and end', () => {
    const line: Path = {
      v: 1,
      pts: [{ x: 0, y: 0, geo: { kind: 'line', E: { x: 4, y: 0 }, hand: 'auto', half: false, round: true } }, { x: 2, y: 0 }, { x: 4, y: 0 }],
      sections: [sec(0)],
    }
    const p = dragApex(line, 0, { x: 2, y: 0 }, { x: 2, y: -2 })
    expect(p.pts[0]?.geo).toEqual({ kind: 'arc3', E: { x: 4, y: 0 }, M: { x: 2, y: -2 }, hand: 'auto', half: false, round: true })
    // semicircle of radius 2 around (2, 0): all points 2 m from the centre
    p.pts.forEach((q) => expect(Math.hypot(q.x - 2, q.y)).toBeCloseTo(2, 1))
    expect(p.pts.at(-1)).toEqual({ x: 4, y: 0 })
  })
  it('apex on freehand bends with a sine weight, ends fixed', () => {
    const p = dragApex(straight, 1, { x: 6, y: 0 }, { x: 6, y: 2 })
    // section 1: S = point 4, points 5..7 inner, 8 fixed; weights sin(π·1/4), sin(π·2/4), sin(π·3/4)
    const w = [0, Math.sin(Math.PI / 4), 1, Math.sin((3 * Math.PI) / 4), 0].map((v) => +(2 * v).toFixed(2))
    expect(p.pts.slice(4).map((q) => q.y)).toEqual(w)
  })
  it('dragging the start after a pause moves it fully and fades out to the end', () => {
    const jumped: Path = { ...straight, pts: straight.pts.map((q, i) => (i === 5 ? { ...q, jump: true } : q)) }
    const p = dragStart(jumped, 1, 0, 3)
    // section 1 = points 5..8 (3 m): weights 1, 2/3, 1/3, 0
    expect(p.pts.slice(5).map((q) => q.y)).toEqual([3, 2, 1, 0])
  })
})

describe('properties', () => {
  const arbPath = fc
    .array(fc.record({ x: fc.integer({ min: 0, max: 4000 }), y: fc.integer({ min: 0, max: 2000 }) }), { minLength: 3, maxLength: 25 })
    .chain((raw) =>
      fc.record({
        pts: fc.constant(raw.map((q) => ({ x: q.x / 100, y: q.y / 100 }) as PathPoint)),
        cut: fc.integer({ min: 1, max: raw.length - 1 }),
      }),
    )
    .map(({ pts, cut }): Path => ({ v: 1, pts, sections: cut > 1 ? [sec(0), sec(cut)] : [sec(0)] }))
  const close = (a: Path, b: Path, tol: number) =>
    a.pts.forEach((q, i) => {
      expect(Math.abs(q.x - (b.pts[i]?.x ?? NaN))).toBeLessThanOrEqual(tol)
      expect(Math.abs(q.y - (b.pts[i]?.y ?? NaN))).toBeLessThanOrEqual(tol)
    })

  it('mirroring twice gives the original (all modes)', () => {
    fc.assert(
      fc.property(arbPath, fc.constantFrom('hand' as const, 'ac' as const, 'eb' as const), fc.boolean(), (path, mode, follow) => {
        const h = horse(1, path)
        const keys = wholePathKeys([h])
        const once = mirrorSelection([h], keys, mode, follow, { lengthM: 40, widthM: 22.5 })
        const twice = mirrorSelection(once, keys, mode, follow, { lengthM: 40, widthM: 22.5 })
        // coordinates are stored in cm: allow one rounding step per mirror
        close(twice[0]?.path ?? path, path, 0.011)
      }),
    )
  })
  it('rotating by a and −a gives the original', () => {
    fc.assert(
      fc.property(arbPath, fc.double({ min: -Math.PI, max: Math.PI, noNaN: true }), fc.boolean(), (path, a, follow) => {
        const h = horse(1, path)
        const keys = [selKey(h.id, 0)]
        const back = rotateSelection(rotateSelection([h], keys, a, follow), keys, -a, follow)
        close(back[0]?.path ?? path, path, 0.011)
      }),
    )
  })
})

describe('architecture', () => {
  it('core imports nothing but its own modules and zod (no Vue, Nuxt or DOM)', () => {
    const dir = join(import.meta.dirname, '../src')
    for (const f of readdirSync(dir)) {
      const src = readFileSync(join(dir, f), 'utf8')
      const specs = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1])
      specs.forEach((s) => expect(s === 'zod' || s?.startsWith('./'), `${f} imports ${s}`).toBe(true))
      expect(src).not.toMatch(/\b(window|document|localStorage|navigator)\.[a-zA-Z]/)
    }
  })
})
