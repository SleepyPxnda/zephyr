import { eq } from 'drizzle-orm'
import { arena, files } from '../../db/schema'

/** The one hall: image (signed address, 5 min) and size in metres. */
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const db = useDb()
  const [hall] = await db.select().from(arena)
  if (!hall) throw problem(404, 'not_found', 'Die Halle ist noch nicht eingerichtet.')
  const [image] = hall.imageId
    ? await db.select().from(files).where(eq(files.id, hall.imageId))
    : []
  return {
    imageId: hall.imageId,
    widthM: hall.widthM,
    lengthM: hall.lengthM,
    placeholder: hall.placeholder,
    imageUrl: image ? await signedUrl(image.storageKey) : null,
  }
})
