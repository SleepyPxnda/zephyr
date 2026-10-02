import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  curveRadii,
  headingAt,
  isTooTight,
  posAt,
  sectionTimes,
  timeline,
  type Gait,
  type Path,
  type PositionState,
} from '../src'
import {
  expectedPath,
  globalGaits,
  planFixture,
  planFixtureNames,
  uuid,
  type PocPos,
} from './helpers'

const TOL = 1e-6
const num = (v: number | null): number => (v === null ? Infinity : v)
function close(actual: number, expected: number | null, what: string) {
  const e = num(expected)
  if (!Number.isFinite(e)) expect(actual, what).toBe(e)
  else expect(Math.abs(actual - e), `${what}: ${actual} vs ${e}`).toBeLessThanOrEqual(TOL)
}

function expectedState(q: PocPos, pts: number): PositionState {
  if (q.before) return 'waiting'
  if (q.done) return 'done'
  if (q.halt) return 'halt'
  if (q.gap) return 'pause'
  return pts === 1 ? 'done' : 'moving'
}

describe.each(planFixtureNames())('golden: %s', (name) => {
  const fx = planFixture(name)
  const { gaits, idOf } = globalGaits(fx.gaits)

  fx.horses.forEach((h, hi) => {
    const path = expectedPath(h.normalized, idOf)
    const ctx = { gaits, horseTack: h.normalized.tack }
    const pending =
      h.normalized.pendJump || h.normalized.pendGap
        ? {
            gap: h.normalized.pendGap?.w ?? 0,
            gapType: h.normalized.pendGap?.t ?? 'pause',
            jump: h.normalized.pendJump,
          }
        : null

    it(`horse ${hi}: radii`, () => {
      const R = curveRadii(path.pts)
      expect(R).toHaveLength(h.radii.length)
      R.forEach((r, i) => close(r, h.radii[i] ?? null, `R[${i}]`))
    })

    it(`horse ${hi}: arrival times, sections, tight segments`, () => {
      const tl = timeline(path, ctx)
      const ex = h.timeline
      expect(tl.ts).toHaveLength(ex.ts.length)
      tl.ts.forEach((t, i) => close(t, ex.ts[i] ?? NaN, `ts[${i}]`))
      tl.t0s.forEach((t, i) => close(t, ex.t0s[i] ?? NaN, `t0s[${i}]`))
      close(tl.total, ex.total, 'total')
      close(tl.dist, ex.dist, 'dist')
      expect(tl.secs).toHaveLength(ex.secs.length)
      tl.secs.forEach((s, k) => {
        const e = ex.secs[k]
        if (!e) throw new Error('missing section')
        close(s.dist, e.dist, `secs[${k}].dist`)
        close(s.time, e.time, `secs[${k}].time`)
        close(s.start, e.start, `secs[${k}].start`)
        close(s.tight, e.tight, `secs[${k}].tight`)
        close(s.minR, e.minR, `secs[${k}].minR`)
      })
      // the prototype keeps speeds in a Float32Array
      tl.vs.forEach((v, i) =>
        expect(Math.abs(v - (ex.vs[i] ?? NaN))).toBeLessThan(1e-6 * Math.max(1, v)),
      )
      expect(tl.tight.map((f) => (f ? 2 : 0))).toEqual(ex.flag)
    })

    it(`horse ${hi}: positions and headings`, () => {
      const tl = timeline(path, ctx)
      for (const q of h.pos) {
        const p = posAt(path, tl, q.t, pending)
        if (q.x === undefined) {
          expect(p).toBeNull()
          continue
        }
        if (!p) throw new Error(`no position at ${q.t}`)
        close(p.x, q.x, `x@${q.t}`)
        close(p.y, q.y ?? NaN, `y@${q.t}`)
        expect(p.i, `i@${q.t}`).toBe(q.i)
        expect(p.state, `state@${q.t}`).toBe(expectedState(q, path.pts.length))
        expect(p.hidden, `hidden@${q.t}`).toBe(!!q.gap)
      }
      path.pts.forEach((_, i) => {
        const hd = headingAt(path.pts, i)
        const e = h.heading[i] ?? null
        if (e === null) expect(hd).toBeNull()
        else close(hd ?? NaN, e, `heading[${i}]`)
      })
    })
  })
})

describe('reference cases (SPEC "Teststrategie")', () => {
  it('volte 10 m at trot: 31.4 m in 8.7 s', () => {
    const fx = planFixture('ref-volte-trot')
    const { gaits, idOf } = globalGaits(fx.gaits)
    const h = fx.horses[0]
    if (!h) throw new Error('fixture')
    const sec = timeline(expectedPath(h.normalized, idOf), { gaits, horseTack: true }).secs[1]
    expect(sec?.dist).toBeCloseTo(31.4, 1)
    expect(sec?.time).toBeCloseTo(8.7, 1)
    expect(sec?.tight).toBe(0)
  })
  it('galop volte 6 m is too tight for a turning circle of 8 m, not for 5 m', () => {
    for (const [name, flagged] of [
      ['ref-galop-volte-md8', true],
      ['ref-galop-volte-md5', false],
    ] as const) {
      const fx = planFixture(name)
      const { gaits, idOf } = globalGaits(fx.gaits)
      const h = fx.horses[0]
      if (!h) throw new Error('fixture')
      const sec = timeline(expectedPath(h.normalized, idOf), { gaits, horseTack: true }).secs[1]
      expect((sec?.tight ?? 0) > 0, name).toBe(flagged)
    }
  })
})

const GAITS: Gait[] = [
  {
    id: uuid(1),
    name: 'Schritt',
    color: '#A8DCC4',
    speedTack: 1.6,
    speedBare: 1.7,
    turnDiameter: 2,
    archivedAt: null,
  },
  {
    id: uuid(2),
    name: 'Trab',
    color: '#9CC5EA',
    speedTack: 3.6,
    speedBare: 3.9,
    turnDiameter: 6,
    archivedAt: null,
  },
]
const straight: Path = {
  v: 1,
  pts: [
    { x: 0, y: 0 },
    { x: 3.6, y: 0 },
    { x: 7.2, y: 0 },
  ],
  sections: [
    { start: 0, gaitId: uuid(2), gap: 1, gapType: 'halt', tack: null },
    { start: 2, gaitId: uuid(2), gap: 2, gapType: 'pause', tack: false },
  ],
}

describe('timeline', () => {
  it('uses the horse default saddle unless a section overrides it', () => {
    const tl = timeline(straight, { gaits: GAITS, horseTack: true })
    expect(tl.secs[0]?.time).toBeCloseTo(1, 10) // 3.6 m at 3.6 m/s
    expect(tl.secs[1]?.time).toBeCloseTo(3.6 / 3.9, 10) // section without saddle
    const bare = timeline(straight, { gaits: GAITS, horseTack: false })
    expect(bare.secs[0]?.time).toBeCloseTo(3.6 / 3.9, 10)
    expect(sectionTimes(straight, tl, 1)).toEqual({ a: 4, b: 4 + 3.6 / 3.9 })
  })
  it('falls back to the first gait for unknown ids', () => {
    const p: Path = {
      ...straight,
      sections: [{ start: 0, gaitId: uuid(9), gap: 1, gapType: 'halt', tack: null }],
    }
    expect(timeline(p, { gaits: GAITS, horseTack: true }).total).toBeCloseTo(1 + 7.2 / 1.6, 10)
  })
  it('needs at least one gait', () => {
    expect(() => timeline(straight, { gaits: [], horseTack: true })).toThrow()
  })
  it('empty path has no time', () => {
    const tl = timeline({ v: 1, pts: [], sections: [] }, { gaits: GAITS, horseTack: true })
    expect(tl.total).toBe(0)
    expect(posAt({ v: 1, pts: [], sections: [] }, tl, 0, null)).toBeNull()
  })
  it('isTooTight follows the SPEC threshold 2·r < 0.97·Ø − 0.05', () => {
    // Ø 6 m: threshold 0.97 · 6 − 0.05 = 5.77 m
    expect(isTooTight(2.9, 6)).toBe(false) // 5.80 m
    expect(isTooTight(2.88, 6)).toBe(true) // 5.76 m
    expect(isTooTight(0, 6)).toBe(true) // corner
    expect(isTooTight(Infinity, 6)).toBe(false) // straight
    expect(isTooTight(0, 0)).toBe(false) // gait without turning circle
  })
  it('arrival times never decrease', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            x: fc.double({ min: 0, max: 40, noNaN: true }),
            y: fc.double({ min: 0, max: 20, noNaN: true }),
            jump: fc.boolean(),
          }),
          { minLength: 1, maxLength: 40 },
        ),
        fc.array(
          fc.record({ start: fc.nat(40), gap: fc.double({ min: 0, max: 10, noNaN: true }) }),
          { maxLength: 6 },
        ),
        (raw, secs) => {
          const pts = raw.map(({ x, y, jump }, i) =>
            jump && i ? { x, y, jump: true as const } : { x, y },
          )
          const starts = [...new Set([0, ...secs.map((s) => s.start % pts.length)])].sort(
            (a, b) => a - b,
          )
          const path: Path = {
            v: 1,
            pts,
            sections: starts.map((start, k) => ({
              start,
              gaitId: uuid(1 + (k % 2)),
              gap: secs[k]?.gap ?? 0,
              gapType: 'halt',
              tack: null,
            })),
          }
          const tl = timeline(path, { gaits: GAITS, horseTack: k(raw.length) })
          for (let i = 1; i < tl.ts.length; i++) {
            expect(tl.ts[i]).toBeGreaterThanOrEqual(tl.ts[i - 1] ?? 0)
            expect(tl.t0s[i]).toBeGreaterThanOrEqual(tl.ts[i - 1] ?? 0)
          }
        },
      ),
    )
  })
})
const k = (n: number) => n % 2 === 0
