import type { Gait } from '@zephyr/core'

export interface ArenaInfo {
  imageId: string | null
  widthM: number
  lengthM: number
  placeholder: boolean
  /** signed address, valid for 5 minutes */
  imageUrl: string | null
}

/** Global gait table (shared by all plans). */
export const useGaits = () => useFetch<Gait[]>('/api/gaits', { key: 'gaits', default: () => [] })

/** The one hall: size and image. */
export const useArenaInfo = () => useFetch<ArenaInfo>('/api/arena', { key: 'arena' })
