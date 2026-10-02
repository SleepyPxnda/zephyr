import type { InjectionKey } from 'vue'

/** Shared zoom/pan state between the canvas and its controls (provided by `ArenaPanel`). */
export type ArenaViewContext = ReturnType<typeof useArenaView>
export const arenaViewKey: InjectionKey<ArenaViewContext> = Symbol('arena-view')

export function injectArenaView(): ArenaViewContext {
  const ctx = inject(arenaViewKey)
  if (!ctx) throw new Error('ArenaPanel missing')
  return ctx
}
