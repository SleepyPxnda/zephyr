// Deterministic inputs for the geometry tools (line, arc, circle, turnThenStraight, arc3Points).
interface Pt {
  x: number
  y: number
}
interface PocGait {
  id: string
  name: string
  w: number
  o: number
  md: number
  c: string
}

const GAITS: PocGait[] = [
  { id: 'g1', name: 'Schritt', w: 1.6, o: 1.7, md: 2, c: '#A8DCC4' },
  { id: 'g2', name: 'Trab', w: 3.6, o: 3.9, md: 6, c: '#9CC5EA' },
  { id: 'g3', name: 'Galopp', w: 5.5, o: 6.0, md: 8, c: '#F6C1A0' },
  { id: 'g0', name: 'Ohne', w: 2, o: 2, md: 0, c: '#C9C3DD' },
]

const base = {
  gaits: GAITS,
  gait: 'g2',
  round: true,
  hand: 'auto',
  half: false,
  shift: false,
}

export function geometryCases() {
  const out: Record<string, unknown>[] = []
  const S: Pt = { x: 20, y: 10 }
  const headings = [null, 0, Math.PI / 2, -2.3, 0.7, Math.PI]
  const targets: Pt[] = [
    { x: 30, y: 10 },
    { x: 20, y: 18 },
    { x: 12, y: 4 },
    { x: 21, y: 11.2 },
    { x: 20.1, y: 10.1 },
    { x: 5, y: 12 },
    { x: 27.3, y: 3.9 },
    { x: 20, y: 7.5 },
  ]
  for (const hd of headings) {
    for (const E of targets) {
      for (const gait of ['g1', 'g2', 'g3', 'g0']) {
        out.push({ ...base, fn: 'geometry', kind: 'line', S, hd, E, gait })
        out.push({ ...base, fn: 'geometry', kind: 'line', S, hd, E, gait, round: false, shift: true })
        out.push({ ...base, fn: 'geometry', kind: 'arc', S, hd, E, gait })
      }
      for (const hand of ['auto', 'left', 'right']) {
        for (const half of [false, true]) {
          out.push({ ...base, fn: 'geometry', kind: 'circle', S, hd, E, hand, half, gait: 'g3' })
          out.push({ ...base, fn: 'geometry', kind: 'circle', S, hd, E, hand, half, shift: true })
        }
      }
    }
  }
  for (const hd of [0, 1, -1.5, 2.8]) {
    for (const E of targets) {
      for (const R of [1, 3, 4]) out.push({ ...base, fn: 'turnThenStraight', S, hd, E, R })
    }
  }
  const mids: Pt[] = [
    { x: 25, y: 5 },
    { x: 25, y: 15 },
    { x: 25, y: 10 },
    { x: 18, y: 2 },
  ]
  for (const M of mids) {
    for (const E of targets) out.push({ ...base, fn: 'arc3Points', S, M, E })
  }
  return out
}
