/** Speeds, turning circle and colour of prototype gaits, for creating them globally. */
export function pocGaitValues(poc: unknown, names: readonly string[]) {
  const list =
    typeof poc === 'object' && poc !== null && 'gaits' in poc && Array.isArray(poc.gaits)
      ? poc.gaits
      : []
  const num = (v: unknown, fallback: number, max = 20) => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 && n <= max ? n : fallback
  }
  return names.map((name) => {
    const g: Record<string, unknown> =
      list.find(
        (q: unknown) =>
          typeof q === 'object' &&
          q !== null &&
          'name' in q &&
          String(q.name).trim() === name.trim(),
      ) ?? {}
    const color = typeof g.c === 'string' && /^#[0-9a-f]{6}$/i.test(g.c) ? g.c : '#C9C3DD'
    return {
      name: name.trim().slice(0, 60) || 'Gangart',
      color,
      speedTack: num(g.w, 3),
      speedBare: num(g.o, 3),
      turnDiameterM: Number(g.md) >= 0 && Number(g.md) <= 100 ? Number(g.md) : 4,
    }
  })
}
