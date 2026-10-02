/** Clock time m:ss,s as in the prototype (`fmtTime`), with the locale's decimal sign. */
export function formatClock(seconds: number, decimal: (v: number) => string): string {
  const t = Math.max(0, seconds)
  const m = Math.floor(t / 60)
  const s = Math.floor((t - m * 60) * 10) / 10
  const text = decimal(s)
  return `${m}:${s < 10 ? '0' : ''}${text}`
}
