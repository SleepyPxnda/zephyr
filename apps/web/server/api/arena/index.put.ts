import { arenaInputSchema } from '@zephyr/core'
import { eq } from 'drizzle-orm'
import { arena, files } from '../../db/schema'

/** Hall image and size (admins). Paths stay in metres, so existing plans keep their shape. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const input = await parseBody(event, arenaInputSchema)
  const db = useDb()
  if (input.imageId) {
    const [f] = await db.select().from(files).where(eq(files.id, input.imageId))
    if (!f || f.kind !== 'image')
      throw problem(422, 'validation', 'Unbekanntes Bild.', {
        errors: [{ path: 'imageId', message: 'unknown image' }],
      })
  }
  const values = {
    imageId: input.imageId,
    widthM: input.widthM,
    lengthM: input.lengthM,
    placeholder: false,
    updatedAt: new Date(),
  }
  await db
    .insert(arena)
    .values({ id: 1, ...values })
    .onConflictDoUpdate({ target: arena.id, set: values })
  return { ...values, updatedAt: values.updatedAt.toISOString() }
})
