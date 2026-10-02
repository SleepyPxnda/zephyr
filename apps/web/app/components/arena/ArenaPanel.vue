<script setup lang="ts">
import { canvasSize, type Gait, type Horse, type Part, type Point } from '@zephyr/core'
import { useElementSize, useEventListener, useWindowSize } from '@vueuse/core'
import { isTyping } from '~/composables/useEditorShortcuts'
import type { ArenaInfo } from '~/composables/useCatalog'
import type { ArenaPointer, Ghost } from '~/composables/useDrawTools'
import type { DisplayOptions } from '~/composables/useDisplayOptions'
import type { HandleView, OverlayLabel } from '~/composables/useSelectTool'
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
  cursor: string
}>()
const emit = defineEmits<{ pointer: [e: ArenaPointer] }>()
const options = defineModel<DisplayOptions>('options', { required: true })
const roundCorners = defineModel<boolean>('roundCorners', { required: true })

// canvas size: full width, arena aspect, at most 58 % of the window height (as in the prototype)
const wrap = useTemplateRef<HTMLElement>('wrap')
const { width } = useElementSize(wrap)
const { height: windowHeight } = useWindowSize()
const arenaSize = computed(() => ({ lengthM: props.arena.lengthM, widthM: props.arena.widthM }))
const viewport = computed(() =>
  canvasSize(arenaSize.value, Math.max(1, width.value), Math.max(260, windowHeight.value * 0.58)),
)
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
  <section ref="wrap" class="flex flex-col gap-2" :aria-label="$t('editor.arena.label')">
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
      :cursor="cursor"
      @pointer="emit('pointer', $event)"
    />
    <ArenaViewControls v-model:options="options" v-model:round-corners="roundCorners" />
  </section>
</template>
