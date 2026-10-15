import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * `close-auto-focus` of a menu: it returns the focus to its trigger once closed, unless an entry
 * already moved the focus elsewhere on purpose (e.g. into the chat input), then it stays there.
 */
export function keepMovedFocus(e: Event) {
  const a = document.activeElement
  if (a && a !== document.body && e.target instanceof Node && !e.target.contains(a))
    e.preventDefault()
}
