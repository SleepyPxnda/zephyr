import { playbackTime } from '@zephyr/core'

export interface Playback {
  playing: Readonly<Ref<boolean>>
  /** tempo 0.5–2×; the pitch changes with it (SPEC, as in the prototype) */
  rate: Readonly<Ref<number>>
  setRate: (r: number) => void
  play: () => void
  pause: () => void
  toggle: () => void
}

/**
 * Playback (SPEC `usePlayback`): the clock is `AudioContext.currentTime` while music plays,
 * otherwise `requestAnimationFrame`. The current time lives in the editor store; when someone
 * else moves it while playing (click on the timeline, Pos1), the music jumps along.
 * The audio context is created and resumed inside the play gesture (Safari).
 */
export function usePlayback(
  end: Readonly<Ref<number>>,
  buffer: Readonly<Ref<AudioBuffer | null>>,
): Playback {
  const editor = useEditorStore()
  const playing = shallowRef(false)
  const rate = shallowRef(1)

  let ctx: AudioContext | null = null
  let src: AudioBufferSourceNode | null = null
  /** music position and context time when the source started */
  let from = 0
  let ctxStart = 0
  let lastFrame = 0
  let frame = 0
  /** the time this composable wrote last; anything else is a seek */
  let written = Number.NaN

  function stopAudio() {
    if (!src) return
    src.onended = null
    try {
      src.stop()
    } catch {
      // already stopped
    }
    src.disconnect()
    src = null
  }

  function startAudio(t: number) {
    stopAudio()
    const buf = buffer.value
    if (!ctx || !buf || t >= buf.duration) return
    const node = ctx.createBufferSource()
    node.buffer = buf
    node.playbackRate.value = rate.value
    node.connect(ctx.destination)
    node.onended = () => {
      if (src === node) src = null
    }
    node.start(0, t)
    src = node
    from = t
    ctxStart = ctx.currentTime
  }

  /** what the listener hears now lags the context clock by the output latency */
  const latency = () => (ctx ? (ctx.outputLatency || 0) + (ctx.baseLatency || 0) : 0)

  function tick(now: number) {
    if (!playing.value) return
    const dt = (now - lastFrame) / 1000
    lastFrame = now
    if (editor.time !== written) startAudio(editor.time)
    const e = end.value
    const t =
      src && ctx
        ? playbackTime(from, ctx.currentTime - ctxStart - latency(), rate.value, e)
        : playbackTime(editor.time, dt, rate.value, e)
    editor.time = written = t
    if (t >= e) return pause()
    frame = requestAnimationFrame(tick)
  }

  function play() {
    const e = end.value
    if (playing.value || e <= 0) return
    if (editor.time >= e - 0.01) editor.time = 0
    if (buffer.value) {
      ctx ??= new AudioContext()
      void ctx.resume()
    }
    playing.value = true
    startAudio(editor.time)
    written = editor.time
    lastFrame = performance.now()
    frame = requestAnimationFrame(tick)
  }

  function pause() {
    playing.value = false
    cancelAnimationFrame(frame)
    stopAudio()
  }

  const toggle = () => (playing.value ? pause() : play())

  // a new tempo restarts the music at the current position; new music stops playback
  watch(rate, () => {
    if (playing.value) startAudio(editor.time)
  })
  watch(buffer, pause)
  onScopeDispose(() => {
    pause()
    void ctx?.close()
  })

  const setRate = (r: number) => (rate.value = r)

  return { playing, rate, setRate, play, pause, toggle }
}
