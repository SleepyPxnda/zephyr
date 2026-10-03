import { and, eq, isNull } from 'drizzle-orm'
import { arena, files, plans } from '../../db/schema'
import { hasRole, planRoleOf } from '../../lib/access'
import { fileInfo } from '../../lib/info'

/**
 * Metadata, a signed address (5 min) and the waveform. Allowed for the owner, for the hall
 * image (everyone signed in) and for anyone who can read a plan that uses the file as music.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id') ?? ''
  const db = useDb()
  const [file] = /^[0-9a-f-]{36}$/i.test(id)
    ? await db.select().from(files).where(eq(files.id, id))
    : []
  if (!file) throw problem(404, 'not_found', 'Datei nicht gefunden.')

  let allowed = file.ownerId === user.id
  if (!allowed) allowed = (await db.select().from(arena).where(eq(arena.imageId, id))).length > 0
  if (!allowed) {
    const using = await db
      .select({ id: plans.id })
      .from(plans)
      .where(and(eq(plans.musicId, id), isNull(plans.deletedAt)))
    for (const p of using)
      if (hasRole(await planRoleOf(db, user.id, p.id), 'viewer')) allowed = true
  }
  if (!allowed) throw problem(404, 'not_found', 'Datei nicht gefunden.')

  return fileInfo(file)
})
