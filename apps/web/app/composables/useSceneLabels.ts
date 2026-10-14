import type { SceneLabels } from '~/lib/arena/render'

/** Texts the arena draws on the canvas, shared by the editor canvas and the PDF export. */
export function useSceneLabels() {
  const { t, n } = useI18n()
  return computed<SceneLabels>(() => ({
    waiting: t('editor.arena.waiting'),
    halt: t('editor.arena.halt'),
    pause: t('editor.arena.pause'),
    pending: (kind, seconds, jump) =>
      t(jump ? 'editor.arena.pendingJump' : 'editor.arena.pending', {
        kind: t(`editor.arena.${kind}`),
        seconds: n(seconds, 'decimal'),
      }),
  }))
}
