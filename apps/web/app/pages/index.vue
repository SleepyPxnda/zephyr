<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-5xl flex-col gap-2 px-4 py-10">
    <h1 class="font-brand text-4xl font-bold" data-testid="wordmark">
      {{ t('app.name') }}
    </h1>
    <p class="text-muted-foreground">{{ t('app.tagline') }}</p>
  </main>
</template>
