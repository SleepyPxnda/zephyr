import type { Path } from './schemas'

/** Length of one beat in seconds; 0 without BPM. */
export const beatLength = (bpm: number | null): number => (bpm && bpm > 0 ? 60 / bpm : 0)

/** Duration in bars ("Dauer in Takten"); null without BPM. */
export function barsOf(seconds: number, bpm: number | null, meter: number): number | null {
  const b = beatLength(bpm)
  return b ? seconds / b / meter : null
}

export interface SnapOptions {
  bpm: number | null
  /** time of the first beat (s) */
  beat0: number
  /** snap to beats (otherwise 0.1 s) */
  toBeat: boolean
}

/** Snaps to the nearest beat `beat0 + round((t − beat0)/b)·b`, without BPM to 0.1 s. */
export function snapTime(t: number, o: SnapOptions): number {
  const b = beatLength(o.bpm)
  if (o.toBeat && b) return o.beat0 + Math.round((t - o.beat0) / b) * b
  return Math.round(t * 10) / 10
}

/**
 * Moves section k so that it starts at `target` instead of `start0` (SPEC "Zeitliches
 * Verschieben", prototype `onTrackMove`): gap[k] += Δ (at least 0). Without `ripple` the next
 * gap shrinks by Δ (at least 0), so following sections are only pushed; with `ripple` (Shift)
 * gap[k+1] stays and everything after moves along.
 */
export function moveSectionTime(
  path: Path,
  k: number,
  start0: number,
  target: number,
  ripple: boolean,
): Path {
  const g0 = path.sections.map((s) => s.gap)
  let delta = Math.max(0, target) - start0
  let gk = (g0[k] ?? 0) + delta
  if (gk < 0) {
    delta -= gk
    gk = 0
  }
  const gaps = [...g0]
  if (!ripple && k + 1 < gaps.length) gaps[k + 1] = Math.max(0, (g0[k + 1] ?? 0) - delta)
  gaps[k] = Math.max(0, gk)
  return { ...path, sections: path.sections.map((s, j) => ({ ...s, gap: gaps[j] ?? s.gap })) }
}
