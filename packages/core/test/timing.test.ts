import { describe, expect, it } from 'vitest'
import { barsOf, beatLength, moveSectionTime, snapTime, type Path } from '../src'
import { uuid } from './helpers'

const path = (gaps: number[]): Path => ({
  v: 1,
  pts: Array.from({ length: gaps.length * 2 }, (_, i) => ({ x: i, y: 0 })),
  sections: gaps.map((gap, k) => ({ start: k * 2, gaitId: uuid(1), gap, gapType: 'halt' as const, tack: null })),
})
const gapsOf = (p: Path) => p.sections.map((s) => s.gap)

describe('moveSectionTime (SPEC "Zeitliches Verschieben")', () => {
  it('pushes only: gap[k] += Δ, gap[k+1] = max(0, gap[k+1] − Δ)', () => {
    // section 1 starts at 10 s; drag it 2 s later
    expect(gapsOf(moveSectionTime(path([1, 3, 5]), 1, 10, 12, false))).toEqual([1, 5, 3])
    // the next gap can not get negative: following sections get pushed
    expect(gapsOf(moveSectionTime(path([1, 3, 1]), 1, 10, 14, false))).toEqual([1, 7, 0])
  })
  it('with Shift all following sections move along (gap[k+1] stays)', () => {
    expect(gapsOf(moveSectionTime(path([1, 3, 5]), 1, 10, 12, true))).toEqual([1, 5, 5])
  })
  it('can not move a section before the end of the previous one', () => {
    // gap 3 s: dragging 5 s earlier stops at the previous end; the next gap grows by the real shift
    expect(gapsOf(moveSectionTime(path([1, 3, 5]), 1, 10, 5, false))).toEqual([1, 0, 8])
  })
  it('the last section has no following gap', () => {
    expect(gapsOf(moveSectionTime(path([1, 3]), 1, 10, 11, false))).toEqual([1, 4])
  })
  it('the first section moves the start time, never below 0', () => {
    expect(gapsOf(moveSectionTime(path([1, 3]), 0, 1, -4, false))).toEqual([0, 4])
  })
  it('does not modify the input', () => {
    const p = path([1, 3, 5])
    moveSectionTime(p, 1, 10, 12, false)
    expect(gapsOf(p)).toEqual([1, 3, 5])
  })
})

describe('snapTime', () => {
  it('snaps to the nearest beat: beat0 + round((t − beat0) / b) · b', () => {
    // 120 BPM → b = 0.5 s, first beat at 0.2 s
    expect(snapTime(1.3, { bpm: 120, beat0: 0.2, toBeat: true })).toBeCloseTo(1.2, 10)
    expect(snapTime(1.46, { bpm: 120, beat0: 0.2, toBeat: true })).toBeCloseTo(1.7, 10)
  })
  it('without BPM (or beat snapping off) to 0.1 s', () => {
    expect(snapTime(1.46, { bpm: null, beat0: 0.2, toBeat: true })).toBeCloseTo(1.5, 10)
    expect(snapTime(1.44, { bpm: 120, beat0: 0.2, toBeat: false })).toBeCloseTo(1.4, 10)
  })
})

describe('beats and bars', () => {
  it('converts durations into bars', () => {
    expect(beatLength(100)).toBeCloseTo(0.6, 10)
    expect(beatLength(null)).toBe(0)
    expect(barsOf(4.8, 100, 4)).toBeCloseTo(2, 10)
    expect(barsOf(4.8, null, 4)).toBeNull()
  })
})
