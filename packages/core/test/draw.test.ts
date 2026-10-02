import { describe, expect, it } from 'vitest'
import {
  announceGap,
  drawFigure,
  drawFreehand,
  figureStart,
  type FigureKind,
  type Gait,
  type Hand,
  type Horse,
  type Point,
} from '../src'
import { expectedPath, globalGaits, planFixture, uuid } from './helpers'

/**
 * Replays the drawing scenarios of tools/poc-harness/src/scenarios.js with @zephyr/core and
 * compares with what the prototype drew. Scale 20 px/m as in the harness.
 */
const SCALE = 20
const emptyHorse = (n: number, tack = true): Horse => ({
  id: uuid(900 + n),
  number: n,
  name: 'Pferd ' + n,
  color: '#c0392b',
  tack,
  path: { v: 1, pts: [], sections: [] },
  pending: null,
})

class Pen {
  gait: string
  round: boolean
  hand: Hand = 'auto'
  half = false
  constructor(
    private gaits: Gait[],
    private idOf: (pocId: string) => string,
    opts: { round?: boolean } = {},
  ) {
    this.gait = idOf('g2')
    this.round = opts.round !== false
  }
  setGait(pocId: string) {
    this.gait = this.idOf(pocId)
  }
  private md() {
    return this.gaits.find((g) => g.id === this.gait)?.turnDiameter ?? 0
  }
  start(h: Horse, pt: Point): Horse {
    return drawFigure(h, {
      kind: 'line',
      down: pt,
      up: pt,
      moved: false,
      gaitId: this.gait,
      turnDiameter: this.md(),
      roundCorners: this.round,
      hand: this.hand,
      half: this.half,
      shift: false,
    })
  }
  draw(h: Horse, kind: FigureKind, E: Point, shift = false, jumpTo?: Point): Horse {
    return drawFigure(h, {
      kind,
      down: jumpTo ?? E,
      up: E,
      moved: true,
      gaitId: this.gait,
      turnDiameter: this.md(),
      roundCorners: this.round,
      hand: this.hand,
      half: this.half,
      shift,
    })
  }
  free(h: Horse, raw: Point[]): Horse {
    return drawFreehand(h, raw, this.gait, 1 / SCALE)
  }
}
const wave = (x0: number, y0: number, len: number, amp: number, n: number): Point[] =>
  Array.from({ length: n + 1 }, (_, i) => ({
    x: x0 + (len * i) / n,
    y: y0 + amp * Math.sin((i / n) * Math.PI * 3),
  }))

const scenarios: Record<string, (pen: Pen) => Horse[]> = {
  'lines-corner': (pen) => {
    let p = pen.start(emptyHorse(1), { x: 2, y: 10 })
    p = pen.draw(p, 'line', { x: 20, y: 10 })
    p = pen.draw(p, 'line', { x: 20, y: 3 })
    return [pen.draw(p, 'line', { x: 35, y: 3 })]
  },
  'line-turn': (pen) => {
    let p = pen.start(emptyHorse(1), { x: 5, y: 10 })
    p = pen.draw(p, 'line', { x: 25, y: 10 })
    p = pen.draw(p, 'line', { x: 10, y: 4 })
    pen.setGait('g3')
    p = pen.draw(p, 'line', { x: 30, y: 16 })
    p = pen.draw(p, 'line', { x: 30.5, y: 13 })
    pen.setGait('g1')
    return [pen.draw(p, 'line', { x: 34, y: 18 }, true)]
  },
  'arc-tangent': (pen) => {
    let p = pen.start(emptyHorse(1), { x: 3, y: 15 })
    p = pen.draw(p, 'arc', { x: 10, y: 15 })
    p = pen.draw(p, 'arc', { x: 20, y: 8 })
    pen.setGait('g3')
    p = pen.draw(p, 'arc', { x: 30, y: 15 })
    return [pen.draw(p, 'arc', { x: 22, y: 18 })]
  },
  volte: (pen) => {
    let p = pen.start(emptyHorse(1), { x: 2, y: 10 })
    p = pen.draw(p, 'line', { x: 8, y: 10 })
    pen.hand = 'left'
    p = pen.draw(p, 'circle', { x: 9, y: 0 })
    pen.hand = 'right'
    p = pen.draw(p, 'circle', { x: 9, y: 16.2 })
    pen.hand = 'left'
    pen.half = true
    p = pen.draw(p, 'line', { x: 20, y: 10 })
    p = pen.draw(p, 'circle', { x: 20, y: 2 })
    pen.hand = 'right'
    pen.setGait('g3')
    p = pen.draw(p, 'circle', { x: 21, y: 25 })
    pen.hand = 'auto'
    pen.half = false
    pen.setGait('g1')
    return [pen.draw(p, 'circle', { x: 30, y: 4.3 })]
  },
  'volte-no-heading': (pen) => {
    let p = pen.start(emptyHorse(1), { x: 10, y: 10 })
    p = pen.draw(p, 'circle', { x: 30, y: 10 })
    let q = pen.start(emptyHorse(2), { x: 5, y: 5 })
    pen.hand = 'right'
    pen.half = true
    q = pen.draw(q, 'circle', { x: 9.2, y: 8.1 })
    let r = pen.start(emptyHorse(3), { x: 30, y: 5 })
    pen.hand = 'left'
    pen.half = false
    r = pen.draw(r, 'circle', { x: 30.2, y: 5.3 })
    r = pen.draw(r, 'circle', { x: 30, y: 20 }, true)
    return [p, q, r]
  },
  freehand: (pen) => {
    let p = pen.free(emptyHorse(1), wave(2, 10, 30, 3, 240))
    pen.setGait('g1')
    p = pen.free(p, [
      { x: 32.3, y: 10.1 },
      { x: 33, y: 12 },
      { x: 34, y: 15 },
      { x: 34.05, y: 15.02 },
      { x: 36, y: 16 },
    ])
    return [pen.free(p, wave(36, 18, -20, 1.5, 120))]
  },
  'halt-pause': (pen) => {
    let p = pen.start(emptyHorse(1), { x: 2, y: 5 })
    p = pen.draw(p, 'line', { x: 15, y: 5 })
    p = announceGap(p, 'halt')
    p = pen.draw(p, 'line', { x: 15, y: 15 })
    p = announceGap(p, 'pause')
    p = pen.draw(p, 'line', { x: 35, y: 15 }, false, { x: 25, y: 10 })
    p = announceGap(p, 'pause')
    p = pen.free(p, wave(5, 18, 10, 1, 60))
    p = announceGap(p, 'halt')
    const sections = p.path.sections.map((s, k) => (k === 0 ? { ...s, gap: 3.5 } : s))
    return [{ ...p, path: { ...p.path, sections } }]
  },
  'gaits-tack': (pen) =>
    [emptyHorse(1, true), emptyHorse(2, false)].map((h, i) => {
      const y = i === 0 ? 5 : 15
      let p = pen.start(h, { x: 2, y })
      pen.setGait('g1')
      p = pen.draw(p, 'line', { x: 12, y })
      pen.setGait('g2')
      p = pen.draw(p, 'line', { x: 24, y })
      pen.setGait('g3')
      return pen.draw(p, 'line', { x: 38, y })
    }),
}

describe.each(Object.entries(scenarios))('golden drawing: %s', (name, run) => {
  it('draws what the prototype drew', () => {
    const fx = planFixture(name)
    const { gaits, idOf } = globalGaits(fx.gaits)
    const pen = new Pen(gaits, idOf, { round: name !== 'lines-corner' })
    const horses = run(pen)
    horses.forEach((h, i) => {
      const ex = fx.horses[i]?.normalized
      if (!ex) throw new Error('fixture')
      expect(h.path).toEqual(expectedPath(ex, idOf))
      const pending =
        ex.pendJump || ex.pendGap
          ? { gap: ex.pendGap?.w ?? 0, gapType: ex.pendGap?.t ?? 'pause', jump: ex.pendJump }
          : null
      expect(h.pending).toEqual(pending)
    })
  })
})

describe('drawing', () => {
  const gaits: Gait[] = [
    {
      id: uuid(1),
      name: 'Trab',
      color: '#9CC5EA',
      speedTack: 3.6,
      speedBare: 3.9,
      turnDiameter: 6,
      archivedAt: null,
    },
  ]
  const style = {
    gaitId: uuid(1),
    turnDiameter: 6,
    roundCorners: true,
    hand: 'auto' as const,
    half: false,
    shift: false,
  }
  it('a click without dragging on an empty path only sets the start point', () => {
    const h = drawFigure(emptyHorse(1), {
      ...style,
      kind: 'circle',
      down: { x: 1, y: 1 },
      up: { x: 1.1, y: 1 },
      moved: false,
    })
    expect(h.path.pts).toEqual([{ x: 1, y: 1 }])
    expect(figureStart(h)).toEqual({ S: { x: 1, y: 1 }, hd: null })
  })
  it('a click without dragging on a path draws the figure up to the click', () => {
    let h = drawFigure(emptyHorse(1), {
      ...style,
      kind: 'line',
      down: { x: 0, y: 0 },
      up: { x: 0, y: 0 },
      moved: false,
    })
    h = drawFigure(h, {
      ...style,
      kind: 'line',
      down: { x: 4, y: 0 },
      up: { x: 4, y: 0 },
      moved: false,
    })
    expect(h.path.pts.at(-1)).toEqual({ x: 4, y: 0 })
    // the figure is remembered on the first point of its section (here: the start point)
    expect(h.path.pts[0]?.geo).toEqual({
      kind: 'line',
      E: { x: 4, y: 0 },
      hand: 'auto',
      half: false,
      round: true,
    })
    expect(h.path.sections).toHaveLength(1)
    expect(gaits).toHaveLength(1)
  })
  it('after "+ Pause" there is no start for the next figure', () => {
    let h = drawFigure(emptyHorse(1), {
      ...style,
      kind: 'line',
      down: { x: 0, y: 0 },
      up: { x: 0, y: 0 },
      moved: false,
    })
    h = drawFigure(h, {
      ...style,
      kind: 'line',
      down: { x: 4, y: 0 },
      up: { x: 4, y: 0 },
      moved: true,
    })
    expect(announceGap(h, 'pause').pending).toEqual({ gap: 4, gapType: 'pause', jump: true })
    expect(announceGap(h, 'halt').pending).toEqual({ gap: 2, gapType: 'halt', jump: false })
    expect(figureStart(announceGap(h, 'pause')).S).toBeNull()
    expect(announceGap(emptyHorse(2), 'halt').pending).toBeNull()
  })
})
