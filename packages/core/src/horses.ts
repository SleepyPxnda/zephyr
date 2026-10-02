import type { Horse } from './schemas'

/** Pastel horse colours in fixed order (SPEC "Name und Farbthema"). */
export const HORSE_COLORS = [
  '#F4A6B7',
  '#9CC5EA',
  '#A8DCC4',
  '#F6C1A0',
  '#C7B8EA',
  '#F3E1A0',
  '#B5E3E8',
  '#E3B5D9',
  '#C9DDA6',
  '#F7D6E0',
] as const

/** A new horse with the next free number and the first unused colour (prototype `addPlayer`). */
export function newHorse(horses: readonly Horse[], id: string, name: (n: number) => string): Horse {
  const used = new Set(horses.map((h) => h.color.toUpperCase()))
  const color =
    HORSE_COLORS.find((c) => !used.has(c)) ??
    HORSE_COLORS[horses.length % HORSE_COLORS.length] ??
    HORSE_COLORS[0]
  const number = Math.min(999, horses.reduce((m, h) => Math.max(m, h.number), 0) + 1)
  return {
    id,
    number,
    name: name(number),
    color,
    tack: true,
    path: { v: 1, pts: [], sections: [] },
    pending: null,
  }
}

/** Relative luminance (0–1) as the prototype uses it to choose dark or light text on a colour. */
export function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const c = (i: number) => parseInt(h.slice(i, i + 2), 16)
  return (0.2126 * c(0) + 0.7152 * c(2) + 0.0722 * c(4)) / 255
}

export const isLightColor = (hex: string): boolean => luminance(hex) > 0.6
