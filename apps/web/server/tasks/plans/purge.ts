import { and, isNotNull, lt } from 'drizzle-orm'
import { plans } from '../../db/schema'

/** Deletes plans for good 30 days after they were (softly) deleted; children follow by cascade. */
export default defineTask({
  meta: { name: 'plans:purge', description: 'Delete soft-deleted plans after 30 days' },
  async run() {
    const before = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const gone = await useDb()
      .delete(plans)
      .where(and(isNotNull(plans.deletedAt), lt(plans.deletedAt, before)))
      .returning({ id: plans.id })
    return { result: { purged: gone.length } }
  },
})
