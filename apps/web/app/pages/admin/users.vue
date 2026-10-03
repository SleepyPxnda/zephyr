<script setup lang="ts">
import type { AdminUserPatch } from '@zephyr/core'
import { ArrowLeft } from '@lucide/vue'
import type { AdminUser } from '~/composables/useAdminUsers'

definePageMeta({ middleware: 'admin' })

const { t, d } = useI18n()
const { user: me } = useUserSession()
const { users, patch } = useAdminUsers()

const pending = computed(() => users.value.filter((u) => u.status === 'pending'))
const decided = computed(() => users.value.filter((u) => u.status !== 'pending'))
const busy = shallowRef<string | null>(null)
const error = shallowRef('')

const locked = (u: AdminUser) => u.isSuperAdmin || u.id === me.value?.id

async function change(u: AdminUser, body: AdminUserPatch) {
  error.value = ''
  busy.value = u.id
  try {
    await patch(u.id, body)
  } catch {
    error.value = t('errors.unknown')
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-4 py-8">
    <header class="flex items-center gap-3">
      <Button variant="ghost" size="icon" as-child>
        <NuxtLink to="/" :aria-label="t('admin.back')"><ArrowLeft /></NuxtLink>
      </Button>
      <h1 class="text-2xl font-semibold">{{ t('admin.title') }}</h1>
    </header>

    <p
      v-if="error"
      role="alert"
      class="rounded-md bg-destructive px-3 py-2 text-sm text-destructive-foreground"
    >
      {{ error }}
    </p>

    <section class="flex flex-col gap-3" aria-labelledby="pending-title">
      <h2 id="pending-title" class="text-lg font-semibold">{{ t('admin.pending') }}</h2>
      <p v-if="!pending.length" class="text-sm text-muted-foreground">
        {{ t('admin.noPending') }}
      </p>
      <ul v-else class="flex flex-col divide-y rounded-md border" data-testid="admin-pending">
        <li v-for="u in pending" :key="u.id" class="flex flex-wrap items-center gap-3 px-3 py-2">
          <Avatar class="size-9">
            <AvatarImage :src="u.avatarUrl" alt="" />
            <AvatarFallback>{{ u.name.slice(0, 1) }}</AvatarFallback>
          </Avatar>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ u.name }}</p>
            <p class="truncate text-xs text-muted-foreground">
              @{{ u.username }} ·
              {{ t('admin.requestedAt', { date: d(new Date(u.createdAt), 'short') }) }}
            </p>
          </div>
          <Button
            size="sm"
            :disabled="busy === u.id"
            data-testid="admin-approve"
            @click="change(u, { status: 'active' })"
          >
            {{ t('admin.approve') }}
          </Button>
          <Button
            size="sm"
            variant="outline"
            :disabled="busy === u.id"
            data-testid="admin-reject"
            @click="change(u, { status: 'rejected' })"
          >
            {{ t('admin.reject') }}
          </Button>
        </li>
      </ul>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="users-title">
      <h2 id="users-title" class="text-lg font-semibold">{{ t('admin.users') }}</h2>
      <ul class="flex flex-col divide-y rounded-md border" data-testid="admin-users">
        <li v-for="u in decided" :key="u.id" class="flex flex-wrap items-center gap-3 px-3 py-2">
          <Avatar class="size-9">
            <AvatarImage :src="u.avatarUrl" alt="" />
            <AvatarFallback>{{ u.name.slice(0, 1) }}</AvatarFallback>
          </Avatar>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">
              {{ u.name }}
              <Badge v-if="u.isSuperAdmin" variant="secondary">{{ t('admin.superAdmin') }}</Badge>
              <Badge v-else-if="u.id === me?.id" variant="secondary">{{ t('admin.you') }}</Badge>
            </p>
            <p class="truncate text-xs text-muted-foreground">@{{ u.username }}</p>
          </div>
          <Badge :variant="u.status === 'active' ? 'outline' : 'destructive'">
            {{ t(`admin.status.${u.status}`) }}
          </Badge>
          <div class="flex items-center gap-2">
            <Switch
              :id="`admin-role-${u.id}`"
              :model-value="u.role === 'admin'"
              :disabled="locked(u) || busy === u.id"
              @update:model-value="change(u, { role: $event ? 'admin' : 'user' })"
            />
            <Label :for="`admin-role-${u.id}`">{{ t('admin.adminRole') }}</Label>
          </div>
          <Button
            size="sm"
            variant="outline"
            :disabled="locked(u) || busy === u.id"
            @click="change(u, { status: u.status === 'active' ? 'rejected' : 'active' })"
          >
            {{ u.status === 'active' ? t('admin.block') : t('admin.unblock') }}
          </Button>
        </li>
      </ul>
    </section>
  </main>
</template>
