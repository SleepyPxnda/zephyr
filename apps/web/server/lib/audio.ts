import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ffmpegStatic from 'ffmpeg-static'

/** Decoding rate for the analysis; 20 ms = 160 samples. */
const RATE = 8000
export const PEAK_STEP_S = 0.02
const PER_PEAK = RATE * PEAK_STEP_S

const ffmpegPath = (): string => {
  const p = process.env.FFMPEG_PATH || (ffmpegStatic as unknown as string | null)
  if (!p) throw new Error('ffmpeg not found (set FFMPEG_PATH)')
  return p
}

export interface AudioInfo {
  durationS: number
  /** loudest amplitude per 20 ms, 0–255 */
  peaks: Buffer
}

/** Decodes the file with ffmpeg (mono, 8 kHz) and measures duration and waveform; null if it is no audio. */
export async function analyzeAudio(data: Uint8Array): Promise<AudioInfo | null> {
  const file = join(tmpdir(), `zephyr-${randomUUID()}`)
  await writeFile(file, data)
  try {
    const pcm = await new Promise<Buffer | null>((resolve) => {
      const proc = spawn(ffmpegPath(), [
        '-v',
        'error',
        '-i',
        file,
        '-vn',
        '-ac',
        '1',
        '-ar',
        String(RATE),
        '-f',
        's16le',
        'pipe:1',
      ])
      const chunks: Buffer[] = []
      proc.stdout.on('data', (c: Buffer) => chunks.push(c))
      proc.stderr.resume()
      proc.on('error', () => resolve(null))
      proc.on('close', (code) => resolve(code === 0 ? Buffer.concat(chunks) : null))
    })
    if (!pcm || pcm.length < 2) return null
    const samples = Math.floor(pcm.length / 2)
    const peaks = Buffer.alloc(Math.ceil(samples / PER_PEAK))
    for (let p = 0; p < peaks.length; p++) {
      let max = 0
      const end = Math.min(samples, (p + 1) * PER_PEAK)
      for (let i = p * PER_PEAK; i < end; i++) max = Math.max(max, Math.abs(pcm.readInt16LE(i * 2)))
      peaks[p] = Math.min(255, Math.round((max / 32768) * 255))
    }
    return { durationS: samples / RATE, peaks }
  } finally {
    await rm(file, { force: true })
  }
}
