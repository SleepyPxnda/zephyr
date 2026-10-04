<script setup lang="ts">
import { playEnd, type Gait, type Plan } from '@zephyr/core'
import { useEventListener } from '@vueuse/core'
import type { ArenaInfo } from '~/composables/useCatalog'
import { isTyping } from '~/composables/useEditorShortcuts'
import { decodeAudio } from '~/composables/useMusic'

/**
 * Read-only view (SPEC "Seiten"): arena, playback and music, nothing to edit. Opens with a read
 * link (`?t=<token>`, no account needed) or with read access to the plan.
 */
interface PlayData {
  plan: Plan
  gaits: Gait[]
  arena: ArenaInfo | null
  music: { url: string } | null
}

const route = useRoute()
const editor = useEditorStore()
const options = useDisplayOptions()
const { loggedIn } = useUserSession()

const { data, error } = await useFetch<PlayData>(
  () => `/api/plans/${String(route.params.id)}/play`,
  { query: { t: route.query.t }, server: false },
)
const plan = computed(() => data.value?.plan ?? null)
const horses = computed(() => plan.value?.horses ?? [])
const gaits = computed(() => data.value?.gaits ?? [])
const parts = computed(() => plan.value?.parts ?? [])

// ---------- music and playback ----------
const buffer = shallowRef<AudioBuffer | null>(null)
const musicStatus = shallowRef<'none' | 'loading' | 'ready' | 'error'>('none')
watch(
  () => data.value?.music?.url ?? null,
  async (url) => {
    buffer.value = null
    editor.musicDuration = 0
    if (!url) return void (musicStatus.value = 'none')
    musicStatus.value = 'loading'
    try {
      buffer.value = await decodeAudio(url)
      editor.musicDuration = buffer.value.duration
      musicStatus.value = 'ready'
    } catch (e) {
      console.error('[music] loading failed', e)
      musicStatus.value = 'error'
    }
  },
  { immediate: true },
)
const timelines = useTimelines(horses, gaits)
const end = computed(() => {
  let m = 0
  for (const tl of timelines.value.values()) m = Math.max(m, tl.total)
  return playEnd(m, editor.musicDuration, parts.value)
})
const playback = usePlayback(end, buffer)
const seek = (t: number) => (editor.time = Math.max(0, Math.min(t, end.value)))

editor.time = 0
onBeforeUnmount(() => {
  editor.time = 0
  editor.musicDuration = 0
})
// Space: play/pause, Pos1: start (SPEC "Interaktionen und Tastenkürzel")
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.defaultPrevented || isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
  if (e.key === ' ') playback.toggle()
  else if (e.key === 'Home') seek(0)
  else return
  e.preventDefault()
})

useHead({
  title: () => (plan.value ? `${plan.value.title} · Zephyr` : 'Zephyr'),
  // the read link must not leak to other sites through the Referer header
  meta: [{ name: 'referrer', content: 'no-referrer' }],
})
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-2">
      <AppNav :links="loggedIn" />
      <h1 v-if="plan" class="min-w-0 truncate font-medium">{{ plan.title }}</h1>
      <Badge variant="outline">{{ $t('roles.viewer') }}</Badge>
    </header>
    <main v-if="plan && data?.arena" class="flex w-full flex-col gap-2 p-4">
      <div class="overflow-hidden rounded-lg border bg-card">
        <ArenaPanel
          v-model:options="options"
          :arena="data.arena"
          :horses="horses"
          :gaits="gaits"
          :parts="parts"
          :active-id="null"
          :time="editor.time"
          :ghost="null"
          :split-hover="null"
          :selection="[]"
          :handles="[]"
          :overlay="null"
          :paste-preview="[]"
          cursor="grab"
          hint=""
          read-only
        />
        <PlayerBar
          :rate="playback.rate.value"
          :time="editor.time"
          :end="end"
          :playing="playback.playing.value"
          :parts="parts"
          @update:rate="playback.setRate"
          @toggle="playback.toggle"
          @seek="seek"
        />
      </div>
      <p v-if="musicStatus === 'loading'" class="text-sm text-muted-foreground" role="status">
        {{ $t('music.loading') }}
      </p>
      <p v-else-if="musicStatus === 'error'" class="text-sm" role="alert">
        {{ $t('play.musicFailed') }}
      </p>
    </main>
    <main v-else-if="error" class="p-8">
      <p role="alert">{{ $t('play.invalid') }}</p>
      <NuxtLink v-if="loggedIn" to="/" class="underline">{{ $t('editor.back') }}</NuxtLink>
    </main>
    <main v-else class="p-8 text-muted-foreground">{{ $t('common.loading') }}</main>
  </div>
</template>
