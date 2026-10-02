import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Gait, GapType, Path, PathPoint } from '../src'

const dir = join(import.meta.dirname, 'fixtures')

export interface PocGait {
  id: string
  name: string
  w: number
  o: number
  md: number
  c: string
}
export interface PocNormalized {
  tack: boolean
  pts: (PathPoint & { jump?: true })[]
  strokes: number[]
  sg: string[]
  gaps: number[]
  gt: GapType[]
  pendJump: boolean
  pendGap: { w: number; t: GapType } | null
}
export interface PocSection {
  dist: number
  time: number
  base: number
  minR: number | null
  tight: number
  start: number
}
export interface PocPos {
  t: number
  x?: number
  y?: number
  i?: number
  before?: boolean
  halt?: boolean
  gap?: boolean
  done?: boolean
}
export interface PocHorseResult {
  normalized: PocNormalized
  timeline: {
    ts: number[]
    t0s: number[]
    total: number
    dist: number
    secs: PocSection[]
    vs: number[]
    flag: number[]
  }
  radii: (number | null)[]
  heading: (number | null)[]
  pos: PocPos[]
}
export interface PlanFixture {
  name: string
  input: Record<string, unknown>
  gaits: PocGait[]
  drawGait: string
  horses: PocHorseResult[]
  exported: Record<string, unknown>
}

export const planFixtureNames = (): string[] =>
  readdirSync(join(dir, 'plans'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5))

export const planFixture = (name: string): PlanFixture =>
  JSON.parse(readFileSync(join(dir, 'plans', `${name}.json`), 'utf8')) as PlanFixture

export const readFixture = <T>(name: string): T =>
  JSON.parse(readFileSync(join(dir, name), 'utf8')) as T

/** Deterministic UUID for test ids. */
export const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

/** Global gaits with the same values as the prototype's gaits; ids are UUIDs keyed by PoC id. */
export function globalGaits(pocGaits: PocGait[]): { gaits: Gait[]; idOf: (pocId: string) => string } {
  const ids = new Map(pocGaits.map((g, i) => [g.id, uuid(100 + i)]))
  const gaits: Gait[] = pocGaits.map((g) => ({
    id: ids.get(g.id) ?? '',
    name: g.name,
    color: g.c,
    speedTack: g.w,
    speedBare: g.o,
    turnDiameter: g.md,
    archivedAt: null,
  }))
  return { gaits, idOf: (pocId) => ids.get(pocId) ?? `unknown:${pocId}` }
}

/** The path the prototype holds after loading, in the new document format. */
export function expectedPath(n: PocNormalized, idOf: (pocId: string) => string): Path {
  return {
    v: 1,
    pts: n.pts.map((q) => {
      const o: PathPoint = { x: q.x, y: q.y }
      if (q.jump) o.jump = true
      if (q.geo) o.geo = { ...q.geo }
      return o
    }),
    sections: n.strokes.map((start, k) => ({
      start,
      gaitId: idOf(n.sg[k] ?? ''),
      gap: n.gaps[k] ?? 0,
      gapType: n.gt[k] ?? 'halt',
      tack: null,
    })),
  }
}
