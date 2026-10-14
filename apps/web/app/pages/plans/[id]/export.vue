<script setup lang="ts">
import { exportPages, playEnd, type Gait, type Plan } from '@zephyr/core'
import { ArrowLeft, Printer } from '@lucide/vue'
import type { ArenaInfo } from '~/composables/useCatalog'

/**
 * PDF export preview (plan M14): one A4 landscape sheet per part and per stretch without a part.
 * The browser's print dialog turns it into the PDF ("Als PDF speichern").
 */
interface PlayData {
  plan: Plan
  gaits: Gait[]
  arena: ArenaInfo | null
}

const route = useRoute()
const { t } = useI18n()
const { clock } = useFormat()
const id = String(route.params.id)

// same data as the read-only view; needs read access to the plan
const { data, error } = await useFetch<PlayData>(() => `/api/plans/${id}/play`, {
  server: false,
})
const plan = computed(() => data.value?.plan ?? null)
const horses = computed(() => plan.value?.horses ?? [])
const gaits = computed(() => data.value?.gaits ?? [])
const parts = computed(() => plan.value?.parts ?? [])
const timelines = useTimelines(horses, gaits)
const pages = computed(() => {
  let m = 0
  for (const tl of timelines.value.values()) m = Math.max(m, tl.total)
  // music after the last path adds no page: nobody rides there
  return exportPages(parts.value, horses.value, timelines.value, playEnd(m, 0, parts.value))
})

// hall image (signed address), loaded once for all sheets
const image = shallowRef<HTMLImageElement | null>(null)
watch(
  () => data.value?.arena?.imageUrl,
  (url) => {
    if (!url) return (image.value = null)
    const img = new Image()
    img.onload = () => (image.value = img)
    img.src = url
  },
  { immediate: true },
)

const print = () => window.print()

useHead({
  title: () => (plan.value ? `${plan.value.title} · ${t('export.title')} · Zephyr` : 'Zephyr'),
  meta: [{ name: 'referrer', content: 'no-referrer' }],
  style: [{ innerHTML: '@page { size: A4 landscape; margin: 0 }' }],
})
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-2 print:hidden">
      <AppNav />
      <h1 v-if="plan" class="min-w-0 truncate font-medium">
        {{ plan.title }} · {{ $t('export.title') }}
      </h1>
      <div class="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="sm" as-child>
          <NuxtLink :to="`/plans/${id}`">
            <ArrowLeft />
            {{ $t('export.back') }}
          </NuxtLink>
        </Button>
        <Button size="sm" :disabled="!pages.length" data-testid="print" @click="print">
          <Printer />
          {{ $t('export.print') }}
        </Button>
      </div>
    </header>

    <main
      v-if="plan && data?.arena"
      class="flex flex-col items-center gap-6 p-4 print:block print:p-0"
    >
      <p class="text-sm text-muted-foreground print:hidden">{{ $t('export.hint') }}</p>
      <p v-if="!pages.length" class="text-muted-foreground">{{ $t('export.empty') }}</p>
      <article
        v-for="(page, i) in pages"
        :key="`${page.part?.id ?? 'gap'}-${page.start}`"
        class="sheet flex aspect-[297/210] w-full max-w-[297mm] flex-col gap-3 rounded-lg border bg-card p-[8mm] text-card-foreground print:h-[210mm] print:w-[297mm] print:max-w-none print:rounded-none print:border-0"
        :aria-label="$t('export.page', { n: i + 1, total: pages.length })"
      >
        <header class="flex items-center justify-between gap-4">
          <img src="/logo.svg" :alt="$t('app.name')" class="h-7 w-auto" />
          <div class="flex min-w-0 items-center gap-2 text-right">
            <span
              v-if="page.part"
              class="size-3 shrink-0 rounded-full"
              :style="{ background: page.part.color }"
              aria-hidden="true"
            />
            <div class="min-w-0">
              <h2 class="truncate text-lg font-semibold">
                {{ page.part?.name || $t(page.part ? 'export.unnamed' : 'export.noPart') }}
              </h2>
              <p class="truncate text-xs text-muted-foreground">{{ plan.title }}</p>
            </div>
          </div>
        </header>
        <div class="flex min-h-0 flex-1 justify-center">
          <ExportArena
            :arena="data.arena"
            :image="image"
            :horses="horses"
            :timelines="timelines"
            :gaits="gaits"
            :range="page"
          />
        </div>
        <footer class="flex items-center justify-between border-t pt-2 text-sm">
          <span class="tabular-nums">{{ clock(page.start) }} – {{ clock(page.end) }}</span>
          <span class="tabular-nums text-muted-foreground">
            {{ $t('export.page', { n: i + 1, total: pages.length }) }}
          </span>
        </footer>
      </article>
    </main>
    <main v-else-if="error" class="p-8">
      <p role="alert">{{ $t('play.invalid') }}</p>
      <NuxtLink to="/" class="underline">{{ $t('editor.back') }}</NuxtLink>
    </main>
    <main v-else class="p-8 text-muted-foreground">{{ $t('common.loading') }}</main>
  </div>
</template>

<style scoped>
@media print {
  /* the sheets keep their dark background on paper (white logo); one sheet per page */
  .sheet {
    print-color-adjust: exact;
    break-after: page;
  }
  .sheet:last-child {
    break-after: auto;
  }
}
</style>
