import { remuxVideo } from '../../lib/video'

const MB = 1024 * 1024
/** a 10-minute recording at 4 Mbit/s is about 300 MB */
const LIMIT = 400 * MB
const TYPES = { 'video/mp4': 'mp4', 'video/webm': 'webm' } as const

/**
 * Makes a video recorded in the browser seekable (plan M15). The body is the raw file; the answer
 * is the same video with duration and index. Nothing is stored: ffmpeg works on temp files that
 * are deleted right after.
 */
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const type = (getRequestHeader(event, 'content-type') ?? '').split(';')[0]?.trim().toLowerCase()
  const ext = type && type in TYPES ? TYPES[type as keyof typeof TYPES] : null
  if (!ext) throw problem(415, 'validation', 'Nur MP4- oder WebM-Videos.')
  if (Number(getRequestHeader(event, 'content-length') ?? 0) > LIMIT)
    throw problem(413, 'validation', 'Das Video ist zu groß.')
  const body = await readRawBody(event, false)
  if (!body?.byteLength) throw problem(422, 'validation', 'Kein Video gefunden.')
  if (body.byteLength > LIMIT) throw problem(413, 'validation', 'Das Video ist zu groß.')

  const out = await remuxVideo(body, ext)
  if (!out) throw problem(422, 'validation', 'Das Video ließ sich nicht verarbeiten.')
  setResponseHeaders(event, { 'Content-Type': type, 'Cache-Control': 'no-store' })
  return out
})
