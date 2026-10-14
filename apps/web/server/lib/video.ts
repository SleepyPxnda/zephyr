import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ffmpegPath } from './audio'

/**
 * Rewrites a browser recording (MediaRecorder writes it as a stream, without duration and index)
 * into a seekable file of the same format, without re-encoding; MP4 with the index up front.
 * Both files only live in the temp folder for the duration of the call. Null if ffmpeg fails.
 */
export async function remuxVideo(data: Uint8Array, ext: 'mp4' | 'webm'): Promise<Buffer | null> {
  const base = join(tmpdir(), `zephyr-${randomUUID()}`)
  const input = `${base}-in.${ext}`
  const output = `${base}-out.${ext}`
  await writeFile(input, data)
  try {
    const args = ['-v', 'error', '-i', input, '-c', 'copy']
    if (ext === 'mp4') args.push('-movflags', '+faststart')
    const ok = await new Promise<boolean>((resolve) => {
      const proc = spawn(ffmpegPath(), [...args, output])
      proc.stdout.resume()
      proc.stderr.resume()
      proc.on('error', () => resolve(false))
      proc.on('close', (code) => resolve(code === 0))
    })
    return ok ? await readFile(output) : null
  } finally {
    await Promise.all([rm(input, { force: true }), rm(output, { force: true })])
  }
}
