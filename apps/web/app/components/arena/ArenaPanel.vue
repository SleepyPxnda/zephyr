<script setup lang="ts">
import {
  canvasSize,
  timeline,
  type Gait,
  type Horse,
  type Part,
  type Point,
  type Timeline,
} from '@zephyr/core'
import { useElementSize, useWindowSize } from '@vueuse/core'
import type { ArenaInfo } from '~/composables/useCatalog'
import type { ArenaPointer, Ghost } from '~/composables/useDrawTools'
import type { DisplayOptions } from '~/composables/useDisplayOptions'
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

// timelines per horse; horses are replaced immutably, so the object is the cache key
const cache = shallowRef(new WeakMap<Horse, Timeline>())
watch(
  () => props.gaits,
  () => (cache.value = new WeakMap()),
)
const timelines = computed(() => {
  const map = new Map<string, Timeline>()
  if (!props.gaits.length) return map
  for (const h of props.horses) {
    let tl = cache.value.get(h)
    if (!tl) {
      tl = timeline(h.path, { gaits: props.gaits, horseTack: h.tack })
      cache.value.set(h, tl)
    }
    map.set(h.id, tl)
  }
  return map
})
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
      :cursor="cursor"
      @pointer="emit('pointer', $event)"
    />
    <ArenaViewControls v-model:options="options" v-model:round-corners="roundCorners" />
  </section>
</template>
