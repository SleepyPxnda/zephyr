import { describe, expect, it } from 'vitest'
import { fromPoc, planContentSchema, toPoc, type Gait } from '../src'
import { expectedPath, globalGaits, planFixture, planFixtureNames, uuid } from './helpers'

const idGen = () => {
  let n = 1000
  return () => uuid(n++)
}

describe.each(planFixtureNames())('golden import/export: %s', (name) => {
  const fx = planFixture(name)
  const { gaits, idOf } = globalGaits(fx.gaits)

  it('imports into what the prototype holds after loading', () => {
    const res = fromPoc(fx.input, { gaits, newId: idGen(), title: name })
    if (!res.ok) throw new Error('unknown gaits ' + res.unknownGaits.join())
    const plan = res.plan
    expect(planContentSchema.safeParse(plan).success).toBe(true)
    expect(plan.horses).toHaveLength(fx.horses.length)
    plan.horses.forEach((h, i) => {
      const ex = fx.horses[i]?.normalized
      if (!ex) throw new Error('fixture')
      expect(h.path).toEqual(expectedPath(ex, idOf))
      expect(h.tack).toBe(ex.tack)
      const pending =
        ex.pendJump || ex.pendGap
          ? { gap: ex.pendGap?.w ?? 0, gapType: ex.pendGap?.t ?? 'pause', jump: ex.pendJump }
          : null
      expect(h.pending).toEqual(pending)
    })
    expect(plan.settings.drawGaitId).toBe(idOf(fx.drawGait))
  })

  it('exports what the prototype would serialize', () => {
    const res = fromPoc(fx.input, { gaits, newId: idGen(), title: name })
    if (!res.ok) throw new Error('import')
    const out = toPoc(res.plan, gaits) as {
      horses: Record<string, unknown>[]
      drawGait: string
      bpm: number
      parts: unknown[]
    }
    const ex = fx.exported as {
      horses: Record<string, unknown>[]
      bpm: number
      beat0: number
      meter: number
      zoom: number
      parts: unknown[]
    }
    const pocIdOfGlobal = new Map(fx.gaits.map((g) => [idOf(g.id), g.id]))
    expect(out.horses.length).toBe(ex.horses.length)
    out.horses.forEach((h, i) => {
      const e = ex.horses[i] ?? {}
      const ids = (h.gaits as string[]).map((id) => pocIdOfGlobal.get(id))
      expect({ ...h, gaits: ids }).toEqual(e)
    })
    expect(out.bpm).toBe(ex.bpm)
    expect(out.parts).toEqual(ex.parts)
    expect(pocIdOfGlobal.get(out.drawGait)).toBe(fx.drawGait)
  })

  it('import → export → import gives the same document', () => {
    const a = fromPoc(fx.input, { gaits, newId: idGen(), title: name })
    if (!a.ok) throw new Error('import')
    const b = fromPoc(toPoc(a.plan, gaits), { gaits, newId: idGen(), title: name })
    if (!b.ok) throw new Error('re-import')
    expect(b.plan).toEqual(a.plan)
  })
})

describe('fromPoc', () => {
  const gaits: Gait[] = [
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
  const plan = {
    drawGait: 'a',
    gaits: [
      { id: 'a', name: 'trab ', w: 3, o: 3, md: 6 },
      { id: 'b', name: 'Piaffe', w: 0.5, o: 0.5, md: 1 },
    ],
    bpm: 300,
    beat0: -1,
    meter: 3,
    zoom: 200,
    musicName: 'Bolero.mp3',
    parts: [
      { name: 'A', a: 2, b: 1 },
      { name: 'B', a: 0, b: 4, c: 'nope' },
    ],
    horses: [
      {
        name: 'X',
        num: 2,
        pts: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 8, y: 0 },
        ],
        strokes: [0, 2],
        gaits: ['a', 'b'],
      },
    ],
  }
  it('asks for gaits it cannot match by name', () => {
    const res = fromPoc(plan, { gaits, newId: idGen(), title: 't' })
    expect(res).toEqual({ ok: false, unknownGaits: ['Piaffe'] })
  })
  it('uses an explicit mapping and clamps timing values', () => {
    const res = fromPoc(plan, { gaits, newId: idGen(), title: 't', gaitMap: { Piaffe: uuid(1) } })
    if (!res.ok) throw new Error('import')
    // names match without case and surrounding spaces
    expect(res.plan.horses[0]?.path.sections.map((s) => s.gaitId)).toEqual([uuid(2), uuid(1)])
    expect(res.plan.timing).toEqual({ bpm: 260, beat0: 0, meter: 3, musicId: null })
    expect(res.plan.settings).toEqual({ timelineZoom: 90, drawGaitId: uuid(2), roundCorners: true })
    expect(res.plan.parts).toEqual([
      { id: expect.any(String), name: 'B', start: 0, end: 4, color: '#7c6fd6' },
    ])
    expect(res.musicName).toBe('Bolero.mp3')
  })
  it('rejects data without horses', () => {
    expect(() => fromPoc({ gaits: [] }, { gaits, newId: idGen(), title: 't' })).toThrow()
    expect(() => fromPoc('nope', { gaits, newId: idGen(), title: 't' })).toThrow()
  })
  it('accepts the old "players" key and default gaits', () => {
    const res = fromPoc(
      {
        players: [
          {
            pts: [
              { x: 1, y: 1 },
              { x: 2, y: 1 },
            ],
            strokes: [0],
            gaits: ['g2'],
          },
        ],
      },
      { gaits, newId: idGen(), title: 't' },
    )
    if (!res.ok) throw new Error('import')
    expect(res.plan.horses[0]).toMatchObject({ name: '', number: 1, color: '#c0392b', tack: true })
    expect(res.plan.horses[0]?.path.sections[0]?.gaitId).toBe(uuid(2))
  })
})
