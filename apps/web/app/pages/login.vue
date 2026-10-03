<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()

/** outcome of the Discord round trip, see server/routes/auth/discord.get.ts */
const notice = computed(() => {
  const s = route.query.status
  return s === 'pending' || s === 'rejected' || s === 'error' ? t(`auth.status.${s}`) : ''
})
</script>

<template>
  <main class="flex min-h-dvh items-center justify-center px-4 py-10">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <p class="font-brand text-2xl font-bold">{{ t('app.name') }}</p>
        <h1 class="leading-none font-semibold">{{ t('auth.login.title') }}</h1>
        <p class="text-sm text-muted-foreground">{{ t('auth.login.description') }}</p>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <p
          v-if="notice"
          role="status"
          class="rounded-md bg-muted px-3 py-2 text-sm"
          data-testid="login-status"
        >
          {{ notice }}
        </p>
        <!-- server route: full page navigation, not a client-side link -->
        <Button as-child data-testid="discord-login">
          <a href="/auth/discord">{{ t('auth.login.discord') }}</a>
        </Button>
      </CardContent>
    </Card>
  </main>
</template>
