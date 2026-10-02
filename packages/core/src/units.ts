/** Converts a speed in m/s to km/h (shown next to gait speeds in the UI). */
export function msToKmh(ms: number): number {
  return ms * 3.6
}
