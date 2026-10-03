import { barsOf, type Timing } from '@zephyr/core'
import { formatClock } from '~/lib/format'

/**
 * Shared number texts in the locale: "12,3 s" (Intl writes "Sek." for German seconds, even
 * narrow), clock "m:ss,s" and durations with bars ("12,3 s · 4,5 Takte").
 */
export function useFormat() {
  const { t, n } = useI18n()
  const dec1 = (v: number) => n(v, { maximumFractionDigits: 1, minimumFractionDigits: 1 })
  const seconds = (v: number) => t('units.seconds', { n: n(v, { maximumFractionDigits: 1 }) })
  const clock = (v: number) => formatClock(v, dec1)
  function duration(v: number, timing: Pick<Timing, 'bpm' | 'meter'>) {
    const bars = barsOf(v, timing.bpm, timing.meter)
    return bars === null
      ? seconds(v)
      : `${seconds(v)} · ${t('timeline.bars', { n: n(bars, { maximumFractionDigits: 1 }) })}`
  }
  return { seconds, clock, duration }
}
