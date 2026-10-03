import { eq } from 'drizzle-orm'
import { files, plans, users } from '../../db/schema'
import { dropUser, refresh as refreshLive } from '../../lib/live'
import { deleteObjects } from '../../lib/storage'

/**
 * Deletes the signed-in account for good: its plans, files and shares go with it (cascade), the
 * stored objects are removed afterwards. The admin account cannot be deleted.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (isAdmin(user))
    throw problem(403, 'forbidden', 'Das Konto des Administrators lässt sich nicht löschen.')

  const db = useDb()
  const { keys, planIds } = await db.transaction(async (tx) => {
    const owned = await tx
      .select({ key: files.storageKey })
      .from(files)
      .where(eq(files.ownerId, user.id))
    const ownPlans = await tx.select({ id: plans.id }).from(plans).where(eq(plans.ownerId, user.id))
    await tx.delete(users).where(eq(users.id, user.id))
    return { keys: owned.map((f) => f.key), planIds: ownPlans.map((p) => p.id) }
  })

  dropUser(user.id)
  await Promise.all(planIds.map((id) => refreshLive(id)))
  await clearUserSession(event)
  try {
    const { s3, bucket } = useS3()
    await deleteObjects(s3, bucket, keys)
  } catch (e) {
    // the rows are gone; orphaned objects are unreachable and only cost space
    console.error('[account] deleting stored files failed', e)
  }
  setResponseStatus(event, 204)
  return null
})
