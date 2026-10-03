import { eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { arena, files } from '../db/schema'
import { PEAK_STEP_S } from './audio'
import { signedUrl } from '../utils/s3'

/** The one hall: image (signed address, 5 min) and size in metres; null before the seed ran. */
export async function arenaInfo(db: Db) {
  const [hall] = await db.select().from(arena)
  if (!hall) return null
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
}

/** Metadata, a signed address (5 min) and the waveform of a stored file. */
export async function fileInfo(file: typeof files.$inferSelect) {
  return {
    id: file.id,
    kind: file.kind,
    mime: file.mime,
    bytes: file.bytes,
    originalName: file.originalName,
    durationS: file.durationS,
    url: await signedUrl(file.storageKey),
    peaks: file.peaks ? { stepS: PEAK_STEP_S, data: file.peaks.toString('base64') } : null,
  }
}
