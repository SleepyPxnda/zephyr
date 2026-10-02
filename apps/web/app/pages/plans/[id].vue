<script setup lang="ts">
import { useEventListener } from '@vueuse/core'

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

// save before leaving (SPEC: autosave also when leaving the page)
onBeforeRouteLeave(async () => {
  if (planStore.dirty) await planStore.save()
})
useEventListener(window, 'beforeunload', (e: BeforeUnloadEvent) => {
  if (!planStore.dirty) return
  void planStore.save()
  e.preventDefault()
})
useHead({ title: () => (plan.value ? `${plan.value.title} · zephyr` : 'zephyr') })
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <EditorHeader
      :title="plan?.title ?? ''"
      :status="planStore.status"
      :role="planStore.role"
      :editable="planStore.canEdit"
      @rename="planStore.rename"
    />
    <main v-if="plan && arena" class="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4">
      <!-- zone 1: tools (M5) and arena -->
      <ArenaPanel
        v-model:options="options"
        v-model:round-corners="roundCorners"
        :arena="arena"
        :horses="horses"
        :gaits="gaits ?? []"
        :parts="plan.parts"
        :active-id="editor.activeHorseId"
        :time="editor.time"
      />
      <!-- zone 2: selection panel (M6) -->
      <!-- zone 3: timeline (M8); for now the horse lane headers -->
      <HorseLanes
        :horses="horses"
        :active-id="editor.activeHorseId"
        :editable="planStore.canEdit"
        @select="editor.activeHorseId = $event"
        @add="addHorse"
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
