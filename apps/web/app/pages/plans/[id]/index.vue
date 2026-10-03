<script setup lang="ts">
import { announceGap, wholePathKeys } from '@zephyr/core'
import { useEventListener } from '@vueuse/core'
import type { ArenaPointer } from '~/composables/useDrawTools'

/**
 * Editor: three fixed zones (SPEC "Frontend"): tools + arena, selection panel (M6) directly
 * below, timeline with the horse lanes at the bottom.
 */
const route = useRoute()
const { t } = useI18n()
const planStore = usePlanStore()
const editor = useEditorStore()
const options = useDisplayOptions()
const { data: gaits } = await useGaits()
const { data: arena } = await useArenaInfo()

const planId = computed(() => String(route.params.id))
const { error } = await useAsyncData(`plan-${planId.value}`, () => planStore.load(planId.value), {
  server: false,
})

const plan = computed(() => planStore.plan)
const horses = computed(() => plan.value?.horses ?? [])
watch(
  horses,
  (hs) => {
    if (!hs.some((h) => h.id === editor.activeHorseId)) editor.activeHorseId = hs[0]?.id ?? null
  },
  { immediate: true },
)

const roundCorners = computed({
  get: () => plan.value?.settings.roundCorners ?? true,
  set: (v: boolean) => planStore.setSettings({ roundCorners: v }),
})

function addHorse() {
  editor.activeHorseId = planStore.addHorse((n) => t('horse.defaultName', { number: n }))
}

// ---------- drawing (M5), selecting and editing (M6) ----------
const gaitList = computed(() => gaits.value ?? [])
const arenaSize = computed(() =>
  arena.value ? { lengthM: arena.value.lengthM, widthM: arena.value.widthM } : null,
)
const tools = useDrawTools(gaitList)
const select = useSelectTool(gaitList)
const sel = useSelectionActions(gaitList, arenaSize)
const clip = useClipboardTools(gaitList)
const timeline = useTimelineEdit(gaitList)
// ---------- music and playback (M9) ----------
const music = useMusic()
const playback = usePlayback(timeline.end, music.buffer, timeline.focus, toRef(editor, 'loop'))
/** music name of a freshly imported prototype plan (SPEC "Übernahme aus dem PoC") */
const importedMusic = computed(() =>
  typeof route.query.music === 'string' && route.query.music ? route.query.music : null,
)
useEditorShortcuts({
  canEdit: () => planStore.canEdit,
  undo: () => planStore.undo(),
  selectAll: sel.selectAll,
  clearSelection: () => editor.clearSelection(),
  removeSelection: sel.remove,
  copy: clip.copy,
  openPaste: clip.open,
  pasteOpen: () => editor.paste.open,
  confirmPaste: clip.confirm,
  cancelPaste: clip.close,
  togglePlay: playback.toggle,
  toStart: () => timeline.seek(0),
})
/** a stroke being drawn or a drag (arena or timeline) being previewed replaces the stored horses until released */
const sceneHorses = computed(() => {
  if (select.preview.value) return select.preview.value
  if (timeline.preview.value) return timeline.preview.value
  const d = tools.draft.value
  return d ? horses.value.map((h) => (h.id === d.id ? d : h)) : horses.value
})
const activeHorse = computed(() => horses.value.find((h) => h.id === editor.activeHorseId) ?? null)
const cursor = computed(() =>
  editor.paste.open ? 'move' : editor.tool === 'select' ? select.cursor.value : 'crosshair',
)
/** while pasting, the arena moves the preview; otherwise the current tool gets the pointer */
function onPointer(e: ArenaPointer) {
  if (editor.paste.open) clip.onPointer(e)
  else if (editor.tool === 'select') select.onPointer(e)
  else tools.onPointer(e)
}
const hint = computed(() => (editor.paste.open ? t('paste.hint') : t(`tools.hint.${editor.tool}`)))
function announce(kind: 'halt' | 'pause') {
  if (activeHorse.value) planStore.replaceHorse(announceGap(activeHorse.value, kind))
}
function selectWhole(id: string) {
  const h = horses.value.find((q) => q.id === id)
  if (!h) return
  editor.activeHorseId = id
  editor.selection = wholePathKeys([h])
}

// send what is still collected when leaving the page (SPEC "Speichern und Konflikte")
onBeforeRouteLeave(() => planStore.flush())
onBeforeUnmount(() => planStore.close())
useEventListener(window, 'beforeunload', (e: BeforeUnloadEvent) => {
  planStore.flush()
  if (planStore.dirty) e.preventDefault()
})
useHead({ title: () => (plan.value ? `${plan.value.title} · zephyr` : 'zephyr') })
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <EditorHeader
      :plan-id="planId"
      :title="plan?.title ?? ''"
      :status="planStore.status"
      :role="planStore.role"
      :editable="planStore.canEdit"
      :peers="planStore.peers"
      @rename="planStore.rename"
    />
    <main v-if="plan && arena" class="flex w-full flex-col gap-4 p-4 pb-12">
      <!-- zones 1 and 2 form one surface: tool bar, then arena with the details sidebar (SPEC) -->
      <div class="overflow-hidden rounded-lg border bg-card">
        <ToolPanel
          v-model:tool="editor.tool"
          v-model:circle="editor.circle"
          :gaits="gaitList"
          :draw-gait-id="tools.drawGait.value?.id ?? null"
          :editable="planStore.canEdit"
          :can-announce="!!activeHorse?.path.pts.length"
          :can-undo="planStore.canUndo"
          :can-copy="editor.selection.length > 0 || !!activeHorse?.path.pts.length"
          :can-paste="!!editor.clipboard"
          @draw-gait="planStore.setSettings({ drawGaitId: $event })"
          @announce="announce"
          @undo="planStore.undo()"
          @copy="clip.copy"
          @paste="clip.open"
        >
          <!-- while pasting, the bar shows the paste options instead of the tools -->
          <template v-if="editor.paste.open" #paste>
            <PasteBar
              v-model:link="editor.paste.link"
              v-model:target="editor.paste.target"
              :title="clip.label.value"
              :multi="(editor.clipboard?.parts.length ?? 0) > 1"
              @position="clip.setPosition"
              @confirm="clip.confirm"
              @cancel="clip.close"
            />
          </template>
        </ToolPanel>
        <div class="flex flex-col border-t lg:flex-row">
          <ArenaPanel
            class="min-w-0 flex-1"
            v-model:options="options"
            v-model:round-corners="roundCorners"
            :arena="arena"
            :horses="sceneHorses"
            :gaits="gaitList"
            :parts="timeline.parts.value"
            :active-id="editor.activeHorseId"
            :time="editor.time"
            :ghost="tools.ghost.value"
            :split-hover="tools.splitHover.value"
            :selection="editor.selection"
            :peer-marks="planStore.marks.sections"
            :handles="select.handles.value"
            :overlay="select.overlay.value"
            :paste-preview="clip.preview.value"
            :cursor="cursor"
            :hint="hint"
            @pointer="onPointer"
          />
          <!-- details sidebar: always there, so the timeline below never moves -->
          <aside
            class="relative h-80 shrink-0 border-t lg:h-auto lg:w-80 lg:border-t-0 lg:border-l"
            :aria-label="$t('selection.details')"
            data-testid="details-sidebar"
          >
            <div class="absolute inset-0 flex flex-col overflow-y-auto p-4">
              <SelectionPanel
                v-if="sel.summary.value && !editor.paste.open"
                v-model:follow="editor.follow"
                v-model:multi-select="editor.multiSelect"
                v-model:fine-rotate="editor.fineRotate"
                :summary="sel.summary.value"
                :title="sel.title.value"
                :gaits="gaitList"
                :editable="planStore.canEdit"
                :can-merge="sel.canMerge.value"
                @gait="sel.setGait"
                @tack="sel.setTack"
                @gap="sel.setGap"
                @gap-type="sel.setGapType"
                @rotate="sel.rotate"
                @mirror="sel.mirror"
                @whole="sel.whole"
                @merge="sel.merge"
                @remove="sel.remove"
                @clear="editor.clearSelection()"
              />
              <template v-else>
                <h2 class="font-semibold">{{ $t('selection.details') }}</h2>
                <p class="mt-1 text-sm text-muted-foreground" data-testid="details-empty">
                  {{ editor.paste.open ? $t('paste.hint') : $t('selection.empty') }}
                </p>
              </template>
            </div>
          </aside>
        </div>
      </div>
      <!-- zone 3: timeline -->
      <TimelinePanel
        :ctl="timeline"
        :playback="playback"
        :music="music"
        :imported-music="importedMusic"
        :gaits="gaitList"
        :editable="planStore.canEdit"
        @add-horse="addHorse"
        @select-whole="selectWhole"
        @update="planStore.updateHorse"
        @clear="planStore.clearPath"
        @remove="planStore.removeHorse"
      />
    </main>
    <main v-else-if="error" class="p-8">
      <p role="alert">{{ $t('editor.loadError') }}</p>
      <NuxtLink to="/" class="underline">{{ $t('editor.back') }}</NuxtLink>
    </main>
    <main v-else class="p-8 text-muted-foreground">{{ $t('common.loading') }}</main>
  </div>
</template>
