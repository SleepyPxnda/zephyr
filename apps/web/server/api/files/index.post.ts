import { randomUUID } from 'node:crypto'
import { files } from '../../db/schema'
import { analyzeAudio } from '../../lib/audio'
import { putObject } from '../../lib/storage'

const MB = 1024 * 1024
const LIMITS = { audio: 50 * MB, image: 15 * MB } as const
const AUDIO = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/ogg',
  'audio/flac',
  'audio/x-flac',
  'audio/aac',
  'audio/mp4',
  'audio/x-m4a',
  'audio/webm',
])
const IMAGE = new Set(['image/png', 'image/jpeg', 'image/webp'])

/** The image really is PNG, JPEG or WebP (magic bytes), whatever the browser claims. */
function isImage(b: Uint8Array): boolean {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to))
  return (
    (b[0] === 0x89 && ascii(1, 4) === 'PNG') ||
    (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) ||
    (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP')
  )
}

/**
 * Upload of music or an image (multipart field `file`). Type and size are checked; for audio
 * the duration and the waveform (20 ms steps) are measured with ffmpeg.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const declared = Number(getRequestHeader(event, 'content-length') ?? 0)
  if (declared > LIMITS.audio + MB) throw problem(413, 'validation', 'Die Datei ist zu groß.')
  const form = await readMultipartFormData(event)
  const part = form?.find((p) => p.name === 'file' && p.filename !== undefined)
  if (!part)
    throw problem(422, 'validation', 'Keine Datei gefunden.', {
      errors: [{ path: 'file', message: 'missing' }],
    })
  const mime = (part.type ?? '').toLowerCase()
  const kind = AUDIO.has(mime) ? 'audio' : IMAGE.has(mime) ? 'image' : null
  if (!kind) throw problem(415, 'validation', 'Dieser Dateityp wird nicht unterstützt.')
  if (part.data.byteLength > LIMITS[kind])
    throw problem(413, 'validation', 'Die Datei ist zu groß.')

  let durationS: number | null = null
  let peaks: Buffer | null = null
  if (kind === 'image' && !isImage(part.data))
    throw problem(415, 'validation', 'Die Datei ist kein Bild.')
  if (kind === 'audio') {
    const info = await analyzeAudio(part.data)
    if (!info) throw problem(415, 'validation', 'Die Datei lässt sich nicht als Musik lesen.')
    durationS = info.durationS
    peaks = info.peaks
  }

  const key = `${kind}/${randomUUID()}`
  const { s3, bucket } = useS3()
  await putObject(s3, bucket, key, part.data, mime)
  const [row] = await useDb()
    .insert(files)
    .values({
      ownerId: user.id,
      kind,
      mime,
      bytes: part.data.byteLength,
      storageKey: key,
      originalName: (part.filename ?? '').slice(0, 255),
      durationS,
      peaks,
    })
    .returning()
  setResponseStatus(event, 201)
  return { id: row?.id, kind, mime, bytes: row?.bytes, originalName: row?.originalName, durationS }
})
