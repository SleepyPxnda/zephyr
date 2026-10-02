import { describe, expect, it } from 'vitest'
import {
  arc3Points,
  figure,
  sampleLine,
  turnThenStraight,
  type FigureShape,
  type Hand,
  type Point,
} from '../src'
import { readFixture, type PocGait } from './helpers'

interface Case {
  fn: 'geometry' | 'turnThenStraight' | 'arc3Points'
  kind: 'line' | 'arc' | 'circle'
  S: Point
  hd: number | null
  E: Point
  M: Point
  R: number
  gait: string
  gaits: PocGait[]
  round: boolean
  hand: Hand
  half: boolean
  shift: boolean
  out:
    | null
    | 'inside'
    | {
        pts: Point[]
        label?: string
        end?: Point
        center?: Point
        R?: number | null
        tight?: boolean
        len?: number
      }
}

const cases = readFixture<Case[]>('geometry.json')
const TOL = 1e-9

function closePts(actual: Point[], expected: Point[], what: string) {
  expect(actual.length, `${what}: count`).toBe(expected.length)
  actual.forEach((q, i) => {
    const e = expected[i] as Point
    expect(Math.abs(q.x - e.x) + Math.abs(q.y - e.y), `${what}[${i}]`).toBeLessThan(TOL)
  })
}

/** What the prototype's label says about the figure (SPEC names: Volte 6/8/10, Zirkel 20, sonst Kreis). */
function shapeFromLabel(label: string): FigureShape | null {
  if (!label) return null
  if (label.startsWith('Gerade · zu nah')) return 'lineTooClose'
  if (label.startsWith('Wendung')) return 'turnLine'
  if (label.startsWith('Gerade')) return 'line'
  if (label.startsWith('Bogen')) return 'arc'
  if (label.startsWith('Halbe Volte')) return 'halfVolte'
  if (label.startsWith('Volte')) return 'volte'
  // the prototype also says "Zirkel (verkleinert)" for 15 m without direction; the SPEC says Kreis
  if (label.startsWith('Zirkel (verkleinert)')) return 'circle'
  if (label.startsWith('Zirkel')) return 'zirkel'
  if (label.startsWith('Kreis')) return 'circle'
  throw new Error('unknown label ' + label)
}
const parseNum = (s: string) => +s.replace(',', '.')

describe('golden: geometry tools', () => {
  const byFn = (fn: Case['fn']) => cases.filter((c) => c.fn === fn).map((c, i) => [i, c] as const)

  it.each(byFn('geometry'))('figure #%i', (_, c) => {
    const gait = c.gaits.find((g) => g.id === c.gait)
    const res = figure(c.kind, c.S, c.hd, c.E, {
      turnDiameter: gait?.md ?? 0,
      roundCorners: c.round,
      hand: c.hand,
      half: c.half,
      shift: c.shift,
    })
    const out = c.out
    if (!out || out === 'inside') throw new Error('unexpected fixture')
    closePts(res.pts, out.pts, 'pts')
    if (out.end) {
      expect(Math.abs(res.end.x - out.end.x) + Math.abs(res.end.y - out.end.y)).toBeLessThan(TOL)
    }
    if (out.R !== undefined)
      expect(Math.abs((res.R ?? NaN) - (out.R ?? Infinity))).toBeLessThan(TOL)
    if (out.center) {
      expect(
        Math.abs((res.center?.x ?? NaN) - out.center.x) +
          Math.abs((res.center?.y ?? NaN) - out.center.y),
      ).toBeLessThan(TOL)
    }
    expect(res.tight).toBe(!!out.tight)
    const label = out.label ?? ''
    expect(res.shape).toBe(shapeFromLabel(label))
    if (label.includes('linke Hand')) expect(res.hand).toBe('left')
    if (label.includes('rechte Hand')) expect(res.hand).toBe('right')
    // the label shows diameter and length rounded to 0.1 m; a warning may follow after " · zu "
    const main = label.split(' · zu ')[0] ?? ''
    const nums = [...main.matchAll(/(\d+,\d) m/g)].map((m) => parseNum(m[1] ?? ''))
    if (['arc', 'volte', 'halfVolte', 'zirkel', 'circle'].includes(res.shape ?? '')) {
      const dia = main.match(/Ø (\d+,\d) m/)?.[1] ?? 'NaN'
      expect(Math.abs((res.diameter ?? NaN) - parseNum(dia))).toBeLessThanOrEqual(0.051)
    }
    if (res.shape !== 'lineTooClose' && nums.length) {
      expect(Math.abs(res.length - (nums[nums.length - 1] ?? NaN))).toBeLessThanOrEqual(0.051)
    }
  })

  it.each(byFn('turnThenStraight'))('turnThenStraight #%i', (_, c) => {
    const res = turnThenStraight(c.S, c.hd ?? 0, c.E, c.R)
    if (c.out === null || c.out === 'inside') {
      expect(res).toBe(c.out)
      return
    }
    if (res === null || res === 'inside') throw new Error(`expected a turn, got ${res}`)
    closePts(res.pts, c.out.pts, 'pts')
    expect(Math.abs(res.length - (c.out.len ?? NaN))).toBeLessThan(TOL)
  })

  it.each(byFn('arc3Points'))('arc3Points #%i', (_, c) => {
    const res = arc3Points(c.S, c.M, c.E)
    if (!c.out || c.out === 'inside') throw new Error('unexpected fixture')
    closePts(res.pts, c.out.pts, 'pts')
    if (c.out.R === null) expect(res.R).toBe(Infinity)
    else expect(Math.abs(res.R - (c.out.R ?? NaN))).toBeLessThan(TOL)
  })
})

describe('geometry', () => {
  it('samples lines every 0.5 m without the start point', () => {
    const pts = sampleLine({ x: 0, y: 0 }, { x: 2, y: 0 })
    expect(pts.map((q) => q.x)).toEqual([0.5, 1, 1.5, 2])
    expect(sampleLine({ x: 0, y: 0 }, { x: 0, y: 0 })).toEqual([{ x: 0, y: 0 }])
  })
  it('names voltes by diameter (SPEC: Volte 6/8/10 m, Zirkel 20 m, sonst Kreis)', () => {
    const S = { x: 0, y: 0 }
    const opts = {
      turnDiameter: 0,
      roundCorners: true,
      hand: 'left' as const,
      half: false,
      shift: false,
    }
    const at = (d: number) => figure('circle', S, 0, { x: 1, y: -d }, opts)
    expect([6, 8, 10, 20, 15, 12].map((d) => at(d).shape)).toEqual([
      'volte',
      'volte',
      'volte',
      'zirkel',
      'circle',
      'circle',
    ])
    expect(figure('circle', S, null, { x: 15, y: 0 }, opts).shape).toBe('circle')
    expect(figure('circle', S, 0, { x: 1, y: -6 }, { ...opts, half: true }).shape).toBe('halfVolte')
  })
  it('snaps the volte diameter to 0.5 m', () => {
    const f = figure(
      'circle',
      { x: 0, y: 0 },
      0,
      { x: 3, y: -6.2 },
      { turnDiameter: 6, roundCorners: true, hand: 'auto', half: false, shift: false },
    )
    expect(f.diameter).toBe(6)
    expect(f.hand).toBe('left')
    expect(f.length).toBeCloseTo(6 * Math.PI, 10)
  })
})
