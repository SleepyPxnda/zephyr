<script setup lang="ts">
const { t } = useI18n()
const { user, fetch: refreshSession } = useUserSession()
const { list, create, duplicate, remove } = usePlans()
const { isAdmin, pendingCount } = useAdminUsers()

const search = shallowRef('')
const importOpen = shallowRef(false)
const creating = shallowRef(false)
const visible = computed(() => {
  const q = search.value.trim().toLocaleLowerCase('de')
  return q
    ? list.data.value.filter((p) => p.title.toLocaleLowerCase('de').includes(q))
    : list.data.value
})

async function newPlan() {
  creating.value = true
  try {
    await navigateTo(`/plans/${await create(t('plans.newTitle'))}`)
  } finally {
    creating.value = false
  }
}

/** the prototype's music is not in the file; the editor names it so it can be uploaded again */
const onImported = (id: string, musicName: string) =>
  navigateTo({ path: `/plans/${id}`, query: musicName ? { music: musicName } : {} })

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await refreshSession()
  await navigateTo('/login')
}
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 px-4 py-8">
    <header class="flex items-center justify-between gap-4">
      <div>
        <h1 class="font-brand text-4xl font-bold" data-testid="wordmark">{{ t('app.name') }}</h1>
        <p class="text-muted-foreground">{{ t('app.tagline') }}</p>
      </div>
      <div class="flex items-center gap-3">
        <Button v-if="isAdmin" variant="outline" as-child data-testid="admin-link">
          <NuxtLink to="/admin/users">
            {{ t('admin.link') }}
            <Badge v-if="pendingCount" variant="destructive" class="ml-1">
              {{ t('admin.pendingBadge', { n: pendingCount }) }}
            </Badge>
          </NuxtLink>
        </Button>
        <Button variant="outline" as-child data-testid="settings-link">
          <NuxtLink to="/settings">{{ t('settings.link') }}</NuxtLink>
        </Button>
        <span v-if="user" class="text-sm" data-testid="greeting">{{
          t('home.greeting', { name: user.name })
        }}</span>
        <Button v-if="user" variant="outline" data-testid="logout" @click="logout">{{
          t('auth.logout')
        }}</Button>
      </div>
    </header>

    <PlanListToolbar
      v-model:search="search"
      :busy="creating"
      @create="newPlan"
      @import="importOpen = true"
    />

    <p v-if="!list.data.value.length" class="text-muted-foreground">{{ t('home.empty') }}</p>
    <p v-else-if="!visible.length" class="text-muted-foreground">{{ t('plans.noMatch') }}</p>
    <ul v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="p in visible" :key="p.id">
        <PlanCard :plan="p" @duplicate="duplicate(p.id)" @remove="remove(p.id)" />
      </li>
    </ul>

    <ImportDialog v-model:open="importOpen" @imported="onImported" />
  </main>
</template>
