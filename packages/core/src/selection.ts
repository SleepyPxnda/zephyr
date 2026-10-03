import { selectionGroups } from './edit'
import { sectionRange } from './path'
import type { GapType, Horse, Section } from './schemas'
import type { Timeline } from './timeline'

export type SectionPatch = Partial<Pick<Section, 'gaitId' | 'tack' | 'gap' | 'gapType'>>

/**
 * Sets gait, saddle or gap on every selected section (prototype `forSel`). The gap type only
 * applies to sections after the first (before the first section the gap is the start time).
 */
export function setSectionProps(
  horses: readonly Horse[],
  keys: Iterable<string>,
  patch: SectionPatch,
): Horse[] {
  const groups = selectionGroups(horses, keys)
  return horses.map((h) => {
    const g = groups.find((q) => q.horse === h)
    if (!g) return h
    const sections = h.path.sections.map((s, k) => {
      if (!g.ks.includes(k)) return s
      const { gapType, ...rest } = patch
      // an edited connecting line becomes a normal section (SPEC "Umsortieren und Verbindungen")
      const plain = { ...s }
      delete plain.link
      return {
        ...plain,
        ...rest,
        gap: rest.gap === undefined ? s.gap : Math.max(0, rest.gap),
        ...(gapType && k > 0 ? { gapType } : {}),
      }
    })
    return { ...h, path: { ...h.path, sections } }
  })
}

/** A value shared by all selected sections, or `mixed`. */
export type Shared<T> = { mixed: false; value: T } | { mixed: true }

export interface SelectionSummary {
  count: number
  horseIds: string[]
  /** ridden metres */
  dist: number
  /** from the start of the earliest to the end of the latest selected section (s) */
  from: number
  to: number
  /** metres tighter than the turning circle */
  tight: number
  /** smallest curvature radius, only for a single section (m) */
  minR: number | null
  gait: Shared<string>
  tack: Shared<boolean | null>
  gap: Shared<number>
  /** gap type of the selected sections after the first one; null if only first sections */
  gapType: Shared<GapType> | null
  /** only first sections are selected: the gap is the start time */
  onlyFirst: boolean
}

function shared<T>(values: T[]): Shared<T> {
  const first = values[0] as T
  return values.every((v) => v === first) ? { mixed: false, value: first } : { mixed: true }
}

/** What the selection panel shows (prototype `renderSelPanel`). */
export function selectionSummary(
  horses: readonly Horse[],
  keys: Iterable<string>,
  timelines: ReadonlyMap<string, Timeline>,
): SelectionSummary | null {
  const groups = selectionGroups(horses, keys)
  if (!groups.length) return null
  let dist = 0
  let tight = 0
  let from = Infinity
  let to = -Infinity
  const gaits: string[] = []
  const tacks: (boolean | null)[] = []
  const gaps: number[] = []
  const types: GapType[] = []
  let minR: number | null = null
  for (const { horse, ks } of groups) {
    const tl = timelines.get(horse.id)
    for (const k of ks) {
      const s = horse.path.sections[k] as Section
      gaits.push(s.gaitId)
      tacks.push(s.tack)
      gaps.push(Math.round(s.gap * 100) / 100)
      if (k > 0) types.push(s.gapType)
      if (!tl) continue
      const sec = tl.secs[k]
      dist += sec?.dist ?? 0
      tight += sec?.tight ?? 0
      from = Math.min(from, sec?.start ?? 0)
      to = Math.max(to, tl.ts[sectionRange(horse.path, k).e] ?? 0)
      if (sec && Number.isFinite(sec.minR)) minR = sec.minR
    }
  }
  const count = groups.reduce((n, g) => n + g.ks.length, 0)
  return {
    count,
    horseIds: groups.map((g) => g.horse.id),
    dist,
    from: Number.isFinite(from) ? from : 0,
    to: Number.isFinite(to) ? to : 0,
    tight,
    minR: count === 1 ? minR : null,
    gait: shared(gaits),
    tack: shared(tacks),
    gap: shared(gaps),
    gapType: types.length ? shared(types) : null,
    onlyFirst: types.length === 0,
  }
}
