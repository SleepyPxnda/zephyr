import { newHorse, type Horse, type Plan, type PlanContent, type PlanSettings } from '@zephyr/core'
import { useDebounceFn } from '@vueuse/core'

export type PlanRole = 'viewer' | 'editor' | 'owner'
export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'conflict' | 'error'

/** Autosave 1.5 s after the last change (SPEC "Speichern und Konflikte"). */
const AUTOSAVE_MS = 1500

/**
 * The open plan document: loading, changes, autosave with `If-Match`. The document is replaced
 * immutably on every change, so derived values (timelines) can be cached per horse object.
 */
export const usePlanStore = defineStore('plan', () => {
  const plan = shallowRef<Plan | null>(null)
  const role = shallowRef<PlanRole | null>(null)
  const status = shallowRef<SaveStatus>('saved')
  const dirty = shallowRef(false)
  let saving: Promise<void> | null = null

  const canEdit = computed(() => role.value === 'editor' || role.value === 'owner')

  async function load(id: string) {
    const res = await $fetch<Plan & { role: PlanRole }>(`/api/plans/${id}`)
    const { role: r, ...doc } = res
    plan.value = doc
    role.value = r
    dirty.value = false
    status.value = 'saved'
  }

  const content = (p: Plan): PlanContent => {
    const { id: _id, revision: _rev, ...c } = p
    return c
  }

  /** Applies a change to the document and schedules saving. */
  function update(fn: (c: PlanContent) => PlanContent) {
    const p = plan.value
    if (!p || !canEdit.value) return
    plan.value = { ...p, ...fn(content(p)) }
    dirty.value = true
    if (status.value !== 'conflict') status.value = 'unsaved'
    scheduleSave()
  }

  async function saveOnce() {
    const sent = plan.value
    if (!sent || !dirty.value || status.value === 'conflict') return
    status.value = 'saving'
    try {
      const saved = await $fetch<Plan>(`/api/plans/${sent.id}`, {
        method: 'PUT',
        body: content(sent),
        headers: { 'If-Match': `"${sent.revision}"` },
      })
      // keep changes made while saving; otherwise take the server's normalized document
      if (plan.value === sent) {
        plan.value = saved
        dirty.value = false
        status.value = 'saved'
      } else if (plan.value) {
        plan.value = { ...plan.value, revision: saved.revision }
        status.value = 'unsaved'
        scheduleSave()
      }
    } catch (e) {
      status.value = (e as { statusCode?: number }).statusCode === 412 ? 'conflict' : 'error'
    }
  }

  /** Saves now; waits for a running save first. */
  async function save() {
    while (saving) await saving
    saving = saveOnce().finally(() => (saving = null))
    await saving
  }
  const scheduleSave = useDebounceFn(save, AUTOSAVE_MS)

  // ---------- plan-level changes ----------

  const rename = (title: string) => update((c) => ({ ...c, title }))
  const setSettings = (patch: Partial<PlanSettings>) =>
    update((c) => ({ ...c, settings: { ...c.settings, ...patch } }))

  // ---------- horses ----------

  const mapHorse = (id: string, fn: (h: Horse) => Horse) =>
    update((c) => ({ ...c, horses: c.horses.map((h) => (h.id === id ? fn(h) : h)) }))

  function addHorse(name: (n: number) => string): string {
    const id = crypto.randomUUID()
    update((c) => ({ ...c, horses: [...c.horses, newHorse(c.horses, id, name)] }))
    return id
  }
  const updateHorse = (id: string, patch: Partial<Pick<Horse, 'name' | 'color' | 'tack'>>) =>
    mapHorse(id, (h) => ({ ...h, ...patch }))
  const clearPath = (id: string) =>
    mapHorse(id, (h) => ({ ...h, path: { v: 1, pts: [], sections: [] }, pending: null }))
  /** Puts a changed horse (path, pending gap) back into the plan. */
  const replaceHorse = (horse: Horse) => mapHorse(horse.id, () => horse)
  const removeHorse = (id: string) =>
    update((c) => ({ ...c, horses: c.horses.filter((h) => h.id !== id) }))

  return {
    // read-only views; changes only go through the actions below
    plan: computed(() => plan.value),
    role: computed(() => role.value),
    status: computed(() => status.value),
    dirty: computed(() => dirty.value),
    canEdit,
    load,
    update,
    save,
    rename,
    setSettings,
    addHorse,
    updateHorse,
    clearPath,
    replaceHorse,
    removeHorse,
  }
})
