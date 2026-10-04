<script setup lang="ts">
import { ChevronRight, LayoutGrid } from '@lucide/vue'

// links: false shows only the logo (e.g. anonymous viewers of a shared plan)
const { links = true } = defineProps<{ links?: boolean }>()
</script>

<template>
  <nav :aria-label="$t('nav.label')" class="flex items-center gap-1">
    <NuxtLink
      v-if="links"
      to="/"
      class="rounded-md p-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <img src="/logo.svg" :alt="$t('app.name')" class="h-6 w-auto" />
    </NuxtLink>
    <img v-else src="/logo.svg" :alt="$t('app.name')" class="box-content h-6 w-auto p-1" />
    <template v-if="links">
      <span class="mx-2 h-5 w-px bg-border" aria-hidden="true" />
      <Button variant="ghost" size="sm" as-child>
        <NuxtLink to="/" data-testid="nav-dashboard">
          <LayoutGrid />
          {{ $t('nav.dashboard') }}
        </NuxtLink>
      </Button>
      <ChevronRight class="size-4 text-muted-foreground" aria-hidden="true" />
    </template>
  </nav>
</template>
