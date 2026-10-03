import { problemCode } from './useProblem'

/** Response of `GET /api/files/:id`. */
interface FileInfo {
  id: string
  originalName: string
  durationS: number | string | null
  url: string
  peaks: { stepS: number; data: string } | null
}

export type MusicStatus = 'none' | 'loading' | 'ready' | 'error'

export interface Music {
  status: Readonly<Ref<MusicStatus>>
  /** file name shown in the music lane */
  name: Readonly<Ref<string>>
  /** waveform from the server: loudest sample per step (0–255) */
  peaks: Readonly<Ref<{ stepS: number; data: Uint8Array } | null>>
  /** decoded audio for playback; null until loaded */
  buffer: Readonly<Ref<AudioBuffer | null>>
  uploading: Readonly<Ref<boolean>>
  /** i18n key of the last upload error */
  uploadError: Readonly<Ref<string | null>>
  upload: (file: File) => Promise<void>
}

function fromBase64(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/**
 * The plan's music (SPEC "Dateien"): metadata and waveform from the API, the file itself from a
 * signed address, decoded for Web Audio. Decoding uses an `OfflineAudioContext`, so no audio
 * context starts before a user gesture (Safari); `usePlayback` creates the real one on play.
 */
export function useMusic(): Music {
  const planStore = usePlanStore()
  const editor = useEditorStore()
  const status = shallowRef<MusicStatus>('none')
  const name = shallowRef('')
  const peaks = shallowRef<{ stepS: number; data: Uint8Array } | null>(null)
  const buffer = shallowRef<AudioBuffer | null>(null)
  const uploading = shallowRef(false)
  const uploadError = shallowRef<string | null>(null)
  let seq = 0

  async function load(id: string | null) {
    const token = ++seq
    buffer.value = null
    peaks.value = null
    name.value = ''
    editor.musicDuration = 0
    if (!id) return void (status.value = 'none')
    status.value = 'loading'
    try {
      const f = await $fetch<FileInfo>(`/api/files/${id}`)
      if (token !== seq) return
      name.value = f.originalName
      peaks.value = f.peaks ? { stepS: f.peaks.stepS, data: fromBase64(f.peaks.data) } : null
      editor.musicDuration = Number(f.durationS) || 0
      const res = await fetch(f.url)
      if (!res.ok) throw new Error(`music download failed: ${res.status}`)
      const data = await res.arrayBuffer()
      const decoded = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(data)
      if (token !== seq) return
      buffer.value = decoded
      editor.musicDuration = decoded.duration
      status.value = 'ready'
    } catch (e) {
      if (token !== seq) return
      console.error('[music] loading failed', e)
      status.value = 'error'
    }
  }

  watch(() => planStore.plan?.timing.musicId ?? null, load, { immediate: true })
  onScopeDispose(() => {
    seq++
    editor.musicDuration = 0
  })

  async function upload(file: File) {
    uploadError.value = null
    uploading.value = true
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await $fetch<{ id: string }>('/api/files', { method: 'POST', body })
      planStore.setTiming({ musicId: res.id })
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      uploadError.value =
        status === 413
          ? 'music.tooLarge'
          : status === 415 || problemCode(e) === 'validation'
            ? 'music.unreadable'
            : 'music.uploadFailed'
    } finally {
      uploading.value = false
    }
  }

  return { status, name, peaks, buffer, uploading, uploadError, upload }
}
