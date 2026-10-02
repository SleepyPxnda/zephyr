<script setup lang="ts">
const { t } = useI18n()
const { user, fetch: refreshSession } = useUserSession()

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await refreshSession()
  await navigateTo('/login')
}
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-5xl flex-col gap-2 px-4 py-10">
    <header class="flex items-center justify-between gap-4">
      <h1 class="font-brand text-4xl font-bold" data-testid="wordmark">{{ t('app.name') }}</h1>
      <Button v-if="user" variant="outline" data-testid="logout" @click="logout">{{
        t('auth.logout')
      }}</Button>
    </header>
    <p class="text-muted-foreground">{{ t('app.tagline') }}</p>
    <p v-if="user" data-testid="greeting">{{ t('home.greeting', { name: user.name }) }}</p>
  </main>
</template>
