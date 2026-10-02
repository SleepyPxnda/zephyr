import { timeline, type Gait, type Horse, type Timeline } from '@zephyr/core'

/**
 * Timeline per horse, cached until the horse (path, gait, saddle) changes: the plan document is
 * replaced immutably, so the horse object is the cache key (SPEC "Zustand").
 */
export function useTimelines(horses: Ref<readonly Horse[]>, gaits: Ref<readonly Gait[]>) {
  const cache = shallowRef(new WeakMap<Horse, Timeline>())
  watch(gaits, () => (cache.value = new WeakMap()))
  return computed(() => {
    const map = new Map<string, Timeline>()
    if (!gaits.value.length) return map
    for (const h of horses.value) {
      let tl = cache.value.get(h)
      if (!tl) {
        tl = timeline(h.path, { gaits: gaits.value, horseTack: h.tack })
        cache.value.set(h, tl)
      }
      map.set(h.id, tl)
    }
    return map
  })
}
