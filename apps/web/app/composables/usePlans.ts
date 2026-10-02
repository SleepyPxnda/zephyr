export interface PlanListItem {
  id: string
  title: string
  updatedAt: string
  role: 'viewer' | 'editor' | 'owner'
}

export type ImportResult =
  | { ok: true; id: string; musicName: string }
  | { ok: false; unknownGaits: string[]; canCreate: boolean }

/** Own and shared plans, and the actions of the start page. */
export function usePlans() {
  const list = useFetch<PlanListItem[]>('/api/plans', { key: 'plans', default: () => [] })

  async function create(title: string): Promise<string> {
    const { id } = await $fetch<{ id: string }>('/api/plans', { method: 'POST', body: { title } })
    return id
  }

  async function duplicate(id: string) {
    await $fetch(`/api/plans/${id}/duplicate`, { method: 'POST' })
    await list.refresh()
  }

  async function remove(id: string) {
    await $fetch(`/api/plans/${id}`, { method: 'DELETE' })
    await list.refresh()
  }

  /** Imports prototype JSON; unknown gaits come back for mapping. */
  async function importPoc(
    poc: unknown,
    title: string,
    answers: { gaitMap?: Record<string, string>; createGaits?: boolean } = {},
  ): Promise<ImportResult> {
    try {
      const res = await $fetch<{ id: string; musicName: string }>('/api/plans', {
        method: 'POST',
        body: { poc, title, ...answers },
      })
      return { ok: true, id: res.id, musicName: res.musicName }
    } catch (e) {
      const data = (e as { data?: { code?: string; unknownGaits?: string[]; canCreate?: boolean } })
        .data
      if (data?.code !== 'unknown_gaits') throw e
      return { ok: false, unknownGaits: data.unknownGaits ?? [], canCreate: !!data.canCreate }
    }
  }

  return { list, create, duplicate, remove, importPoc }
}
