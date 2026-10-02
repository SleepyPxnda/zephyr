import { describe, expect, it } from 'vitest'
import {
  geoSchema,
  loginSchema,
  MAX_PATH_POINTS,
  partSchema,
  pathSchema,
  planContentSchema,
  registerSchema,
  type PlanContent,
} from '../src'
import { uuid } from './helpers'

const sec = (start: number) => ({
  start,
  gaitId: uuid(1),
  gap: 0,
  gapType: 'halt' as const,
  tack: null,
})
const plan = (): PlanContent => ({
  title: 'Kür Luna 2027',
  timing: { bpm: 96, beat0: 0.5, meter: 4, musicId: null },
  settings: { timelineZoom: 24, drawGaitId: uuid(1), roundCorners: true },
  horses: [
    {
      id: uuid(10),
      number: 1,
      name: 'Luna',
      color: '#c0392b',
      tack: true,
      path: {
        v: 1,
        pts: [
          { x: 1.5, y: 10 },
          { x: 30, y: 10 },
          { x: 40, y: 5, jump: true },
        ],
        sections: [sec(0), { ...sec(2), gapType: 'pause', gap: 3, tack: false }],
      },
      pending: null,
    },
  ],
  parts: [{ id: uuid(20), name: 'Einritt', start: 0, end: 14, color: '#7c6fd6' }],
})

describe('plan schema', () => {
  it('accepts the SPEC example document', () => {
    expect(planContentSchema.safeParse(plan()).success).toBe(true)
  })
  it.each([
    ['meter 5', (p: PlanContent) => ({ ...p, timing: { ...p.timing, meter: 5 } })],
    ['bpm 300', (p: PlanContent) => ({ ...p, timing: { ...p.timing, bpm: 300 } })],
    ['empty title', (p: PlanContent) => ({ ...p, title: '' })],
    [
      'bad colour',
      (p: PlanContent) => ({ ...p, horses: p.horses.map((h) => ({ ...h, color: 'red' })) }),
    ],
    [
      'gait id not a uuid',
      (p: PlanContent) => ({
        ...p,
        horses: p.horses.map((h) => ({
          ...h,
          path: { ...h.path, sections: [{ ...sec(0), gaitId: 'g1' }] },
        })),
      }),
    ],
  ])('rejects %s', (_, change) => {
    expect(planContentSchema.safeParse(change(plan())).success).toBe(false)
  })
})

describe('auth inputs', () => {
  it('normalizes e-mail addresses and requires 10 characters of password', () => {
    expect(
      registerSchema.parse({ email: ' Anna@Example.DE ', name: ' Anna ', password: '0123456789' }),
    ).toEqual({
      email: 'anna@example.de',
      name: 'Anna',
      password: '0123456789',
    })
    expect(
      registerSchema.safeParse({ email: 'anna@example.de', name: 'A', password: 'short' }).success,
    ).toBe(false)
    expect(
      registerSchema.safeParse({ email: 'nope', name: 'A', password: '0123456789' }).success,
    ).toBe(false)
    expect(loginSchema.safeParse({ email: 'anna@example.de', password: '' }).success).toBe(false)
  })
})

describe('path schema', () => {
  const pts = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ]
  it.each([
    ['sections without points', { v: 1, pts: [], sections: [sec(0)] }],
    ['first section not at 0', { v: 1, pts, sections: [sec(1)] }],
    ['no sections', { v: 1, pts, sections: [] }],
    ['start out of range', { v: 1, pts, sections: [sec(0), sec(3)] }],
    ['starts not increasing', { v: 1, pts, sections: [sec(0), sec(2), sec(1)] }],
    ['negative gap', { v: 1, pts, sections: [{ ...sec(0), gap: -1 }] }],
    [
      'too many points',
      {
        v: 1,
        pts: Array.from({ length: MAX_PATH_POINTS + 1 }, () => ({ x: 0, y: 0 })),
        sections: [sec(0)],
      },
    ],
    ['NaN coordinate', { v: 1, pts: [{ x: Number.NaN, y: 0 }], sections: [sec(0)] }],
  ])('rejects %s', (_, path) => {
    expect(pathSchema.safeParse(path).success).toBe(false)
  })
  it('accepts an empty path', () => {
    expect(pathSchema.safeParse({ v: 1, pts: [], sections: [] }).success).toBe(true)
  })
  it('requires the apex for arc3 and fills geo defaults', () => {
    expect(geoSchema.safeParse({ kind: 'arc3', E: { x: 1, y: 1 } }).success).toBe(false)
    expect(geoSchema.parse({ kind: 'line', E: { x: 1, y: 1 } })).toEqual({
      kind: 'line',
      E: { x: 1, y: 1 },
      hand: 'auto',
      half: false,
      round: true,
    })
  })
  it('parts end after they start', () => {
    expect(
      partSchema.safeParse({ id: uuid(1), name: '', start: 3, end: 3, color: '#000000' }).success,
    ).toBe(false)
  })
})
