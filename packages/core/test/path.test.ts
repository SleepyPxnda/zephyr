import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  fromStrokes,
  mergeSections,
  normalize,
  sectionGeom,
  sectionOf,
  sectionRange,
  splitAt,
  toStrokes,
  type Path,
  type Section,
} from '../src'
import { uuid } from './helpers'

const G1 = uuid(1)
const G2 = uuid(2)
const sec = (start: number, extra: Partial<Section> = {}): Section => ({
  start,
  gaitId: G1,
  gap: 0,
  gapType: 'halt',
  tack: null,
  ...extra,
})
const line = (n: number, y = 0) => Array.from({ length: n }, (_, i) => ({ x: i, y }))

describe('sectionOf / sectionRange', () => {
  const path: Path = { v: 1, pts: line(10), sections: [sec(0), sec(4), sec(7)] }
  it('finds the section of a point', () => {
    expect([0, 3, 4, 6, 7, 9].map((i) => sectionOf(path, i))).toEqual([0, 0, 1, 1, 2, 2])
  })
  it('gives first and last point of a section', () => {
    expect(sectionRange(path, 0)).toEqual({ s: 0, e: 3 })
    expect(sectionRange(path, 2)).toEqual({ s: 7, e: 9 })
  })
  it('section geometry starts at the previous point unless the section owns its start', () => {
    expect(sectionGeom(path, 1)).toMatchObject({ s0: 4, e: 6, own: false, si: 3, geo: null })
    expect(sectionGeom(path, 0)).toMatchObject({ s0: 0, own: true, si: 0 })
    const jumped: Path = {
      ...path,
      pts: path.pts.map((q, i) => (i === 7 ? { ...q, jump: true } : q)),
    }
    expect(sectionGeom(jumped, 2)).toMatchObject({ own: true, si: 7 })
  })
})

describe('normalize', () => {
  it('empties sections of an empty path', () => {
    expect(normalize({ v: 1, pts: [], sections: [sec(0)] })).toEqual({
      v: 1,
      pts: [],
      sections: [],
    })
  })
  it('never lets the first point jump and inserts a first section', () => {
    const p = normalize({
      v: 1,
      pts: [{ x: 0, y: 0, jump: true }, ...line(3).slice(1)],
      sections: [sec(2, { gaitId: G2 })],
    })
    expect(p.pts[0]?.jump).toBeUndefined()
    expect(p.sections.map((s) => s.start)).toEqual([0, 2])
    expect(p.sections[0]?.gaitId).toBe(G2)
  })
  it('drops sections out of range or not increasing', () => {
    const p = normalize({ v: 1, pts: line(5), sections: [sec(0), sec(3), sec(3), sec(2), sec(9)] })
    expect(p.sections.map((s) => s.start)).toEqual([0, 3])
  })
  it('folds a section that only holds its jump start point into the next one', () => {
    const pts = [...line(3), { x: 9, y: 9, jump: true as const }, { x: 10, y: 9 }, { x: 11, y: 9 }]
    const p = normalize({
      v: 1,
      pts,
      sections: [
        sec(0),
        sec(3, { gap: 2, gapType: 'pause' }),
        sec(4, { gap: 1, gaitId: G2, tack: false }),
      ],
    })
    expect(p.sections).toEqual([
      sec(0),
      { start: 3, gaitId: G2, gap: 3, gapType: 'pause', tack: false },
    ])
  })
  it('folds a first section that only holds the first point', () => {
    const p = normalize({
      v: 1,
      pts: line(4),
      sections: [sec(0, { gap: 1.5 }), sec(1, { gap: 2, gaitId: G2 })],
    })
    expect(p.sections).toEqual([{ ...sec(0), gap: 3.5, gaitId: G2 }])
  })
  it('maps unknown gaits to the first known gait and clamps negative gaps', () => {
    const p = normalize(
      { v: 1, pts: line(4), sections: [sec(0, { gaitId: uuid(99), gap: -3 })] },
      { gaitIds: [G2, G1] },
    )
    expect(p.sections[0]).toMatchObject({ gaitId: G2, gap: 0 })
  })
  it('a section after a jump without explicit type would be a pause; with a type it keeps it', () => {
    const pts = [...line(3), { x: 9, y: 9, jump: true as const }, { x: 10, y: 9 }]
    expect(
      normalize({ v: 1, pts, sections: [sec(0), sec(3, { gapType: 'halt' })] }).sections[1]
        ?.gapType,
    ).toBe('halt')
  })
  it('rounds coordinates to centimetres', () => {
    const p = normalize({
      v: 1,
      pts: [
        { x: 1.23456, y: 2.005 },
        { x: 3.999, y: 0 },
      ],
      sections: [sec(0)],
    })
    expect(p.pts).toEqual([
      { x: 1.23, y: 2.0 },
      { x: 4, y: 0 },
    ])
  })

  const arbPath: fc.Arbitrary<Path> = fc
    .record({
      pts: fc.array(
        fc.record({
          x: fc.double({ min: -50, max: 50, noNaN: true }),
          y: fc.double({ min: -50, max: 50, noNaN: true }),
          jump: fc.boolean(),
        }),
        { maxLength: 30 },
      ),
      starts: fc.array(fc.nat(35), { maxLength: 8 }),
      gaps: fc.array(fc.double({ min: -5, max: 20, noNaN: true }), { maxLength: 8 }),
      types: fc.array(fc.constantFrom('halt' as const, 'pause' as const), { maxLength: 8 }),
    })
    .map(({ pts, starts, gaps, types }) => ({
      v: 1 as const,
      pts: pts.map(({ x, y, jump }) => (jump ? { x, y, jump: true as const } : { x, y })),
      sections: starts.map((start, k) =>
        sec(start, { gap: gaps[k] ?? 0, gapType: types[k] ?? 'halt', gaitId: k % 2 ? G2 : G1 }),
      ),
    }))

  it('is idempotent', () => {
    fc.assert(
      fc.property(arbPath, (p) => {
        const once = normalize(p)
        expect(normalize(once)).toEqual(once)
      }),
    )
  })
  it('produces structurally valid paths', () => {
    fc.assert(
      fc.property(arbPath, (p) => {
        const n = normalize(p)
        if (!n.pts.length) return n.sections.length === 0
        expect(n.sections[0]?.start).toBe(0)
        expect(n.pts[0]?.jump).toBeUndefined()
        n.sections.forEach((s, k) => {
          expect(s.start).toBeLessThan(n.pts.length)
          if (k) expect(s.start).toBeGreaterThan(n.sections[k - 1]?.start ?? -1)
          expect(s.gap).toBeGreaterThanOrEqual(0)
        })
        return true
      }),
    )
  })
  it('does not modify its input', () => {
    const p: Path = {
      v: 1,
      pts: [
        { x: 0, y: 0, jump: true },
        { x: 1.234, y: 0 },
      ],
      sections: [sec(1)],
    }
    const copy = structuredClone(p)
    normalize(p)
    expect(p).toEqual(copy)
  })
})

describe('strokes conversion', () => {
  it('round-trips', () => {
    const p: Path = {
      v: 1,
      pts: line(5),
      sections: [sec(0), sec(2, { gapType: 'pause', gap: 3, tack: true })],
    }
    expect(fromStrokes(toStrokes(p))).toEqual(p)
  })
})

describe('splitAt', () => {
  const path: Path = {
    v: 1,
    pts: [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      {
        x: 10,
        y: 0,
        geo: { kind: 'line', E: { x: 20, y: 0 }, hand: 'auto', half: false, round: true },
      },
      { x: 20, y: 0 },
    ],
    sections: [sec(0), sec(2, { gaitId: G2, gap: 2, tack: false })],
  }
  it('inserts a point inside a segment and starts a new section there', () => {
    const r = splitAt(path, 3, 0.5, 0.2)
    expect(r?.k).toBe(2)
    expect(r?.path.pts.map((q) => q.x)).toEqual([0, 5, 10, 15, 20])
    expect(r?.path.sections.map((s) => s.start)).toEqual([0, 2, 4])
    expect(r?.path.sections[2]).toEqual({
      start: 4,
      gaitId: G2,
      gap: 0,
      gapType: 'halt',
      tack: false,
    })
    // the remembered figure no longer describes the shortened section
    expect(r?.path.pts[2]?.geo).toBeUndefined()
    expect(path.pts[2]?.geo).toBeDefined()
  })
  it('snaps to an existing point when the click is close to it', () => {
    const r = splitAt({ ...path, sections: [sec(0)] }, 3, 0.01, 0.2)
    expect(r?.path.pts).toHaveLength(4)
    expect(r?.path.sections.map((s) => s.start)).toEqual([0, 3])
  })
  it('refuses to split at the very start or end or at an existing border', () => {
    expect(splitAt(path, 1, 0.001, 0.2)).toBeNull()
    expect(splitAt(path, 3, 0.999, 0.2)).toBeNull()
    expect(splitAt(path, 2, 0.001, 0.2)).toBeNull()
  })
})

describe('mergeSections', () => {
  const path: Path = {
    v: 1,
    pts: line(8),
    sections: [sec(0), sec(2, { gap: 1 }), sec(4, { gaitId: G2 }), sec(6)],
  }
  it('merges adjacent sections into the first one', () => {
    const r = mergeSections(path, [1, 2])
    expect(r?.sections).toEqual([sec(0), sec(2, { gap: 1 }), sec(6)])
  })
  it('rejects non-adjacent or single selections', () => {
    expect(mergeSections(path, [1, 3])).toBeNull()
    expect(mergeSections(path, [2])).toBeNull()
  })
})
