<script setup lang="ts">
import { canvasSize, type Gait, type Horse, type Part, type Point } from '@zephyr/core'
import { useElementSize, useEventListener, useWindowSize } from '@vueuse/core'
import { isTyping } from '~/composables/useEditorShortcuts'
import type { ArenaInfo } from '~/composables/useCatalog'
import type { ArenaPointer, Ghost } from '~/composables/useDrawTools'
import type { DisplayOptions } from '~/composables/useDisplayOptions'
import type { HandleView, OverlayLabel } from '~/composables/useSelectTool'
import type { PastePreview } from '~/composables/useClipboardTools'
import { arenaViewKey } from '~/composables/arenaViewContext'

const props = defineProps<{
  arena: ArenaInfo
  horses: readonly Horse[]
  gaits: readonly Gait[]
  parts: readonly Part[]
  activeId: string | null
  time: number
  ghost: Ghost | null
  splitHover: Point | null
  selection: readonly string[]
  handles: readonly HandleView[]
  overlay: OverlayLabel | null
  pastePreview: readonly PastePreview[]
  cursor: string
  hint: string
}>()
const emit = defineEmits<{ pointer: [e: ArenaPointer] }>()
const options = defineModel<DisplayOptions>('options', { required: true })
const roundCorners = defineModel<boolean>('roundCorners', { required: true })

// canvas height: arena aspect, at most 72 % of the window height (SPEC "Frontend")
const wrap = useTemplateRef<HTMLElement>('wrap')
const { width } = useElementSize(wrap)
const { height: windowHeight } = useWindowSize()
const arenaSize = computed(() => ({ lengthM: props.arena.lengthM, widthM: props.arena.widthM }))
// the canvas spans the full width; the arena is centred in it (viewTransform fits by the smaller side)
const viewport = computed(() => {
  const w = Math.max(1, width.value)
  return {
    width: w,
    height: canvasSize(arenaSize.value, w, Math.max(320, windowHeight.value * 0.72)).height,
  }
})
const view = useArenaView(arenaSize, viewport)
provide(arenaViewKey, view)

// + − 0: zoom in, out, fit; W: "Nur Pferde" (SPEC "Interaktionen und Tastenkürzel")
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.defaultPrevented || isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
  if (e.key === '+') view.zoomIn()
  else if (e.key === '-') view.zoomOut()
  else if (e.key === '0') view.fit()
  else if (e.key.toLowerCase() === 'w')
    options.value = { ...options.value, onlyHorses: !options.value.onlyHorses }
  else return
  e.preventDefault()
})

// timelines of what is shown (incl. a stroke being drawn)
const timelines = useTimelines(
  toRef(() => props.horses),
  toRef(() => props.gaits),
)
</script>

<template>
  <section :aria-label="$t('editor.arena.label')">
    <div ref="wrap">
      <ArenaCanvas
        :arena="arena"
        :viewport="viewport"
        :horses="horses"
        :timelines="timelines"
        :gaits="gaits"
        :parts="parts"
        :active-id="activeId"
        :time="time"
        :options="options"
        :ghost="ghost"
        :split-hover="splitHover"
        :selection="selection"
        :handles="handles"
        :overlay="overlay"
        :paste-preview="pastePreview"
        :cursor="cursor"
        @pointer="emit('pointer', $event)"
      />
    </div>
    <ArenaViewControls
      v-model:options="options"
      v-model:round-corners="roundCorners"
      :hint="hint"
    />
  </section>
</template>
