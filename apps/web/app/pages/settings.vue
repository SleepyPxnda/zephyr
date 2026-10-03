<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'
import { buttonVariants } from '~/components/ui/button'

const { t } = useI18n()
const { user, fetch: refreshSession } = useUserSession()

const confirmDelete = shallowRef(false)
const deleting = shallowRef(false)
const error = shallowRef('')

async function deleteAccount() {
  error.value = ''
  deleting.value = true
  try {
    await $fetch('/api/account', { method: 'DELETE' })
    await refreshSession()
    await navigateTo('/login')
  } catch {
    error.value = t('errors.unknown')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-5xl flex-col gap-8 px-4 py-8">
    <header class="flex items-center gap-3">
      <Button variant="ghost" size="icon" as-child>
        <NuxtLink to="/" :aria-label="t('admin.back')"><ArrowLeft /></NuxtLink>
      </Button>
      <h1 class="text-2xl font-semibold">{{ t('settings.title') }}</h1>
    </header>

    <section class="flex flex-col gap-3" aria-labelledby="account-title">
      <h2 id="account-title" class="text-lg font-semibold">{{ t('settings.account') }}</h2>
      <div v-if="user" class="flex items-center gap-3">
        <Avatar class="size-12">
          <AvatarImage :src="user.avatarUrl" alt="" />
          <AvatarFallback>{{ user.name.slice(0, 1) }}</AvatarFallback>
        </Avatar>
        <div class="min-w-0">
          <p class="truncate font-medium">{{ user.name }}</p>
          <p class="truncate text-sm text-muted-foreground">@{{ user.username }}</p>
        </div>
      </div>
      <p class="text-sm text-muted-foreground">{{ t('settings.fromDiscord') }}</p>
      <p v-if="user?.isAdmin" class="text-sm text-muted-foreground">
        {{ t('settings.adminCannotDelete') }}
      </p>
      <div v-else>
        <Button variant="destructive" data-testid="account-delete" @click="confirmDelete = true">
          {{ t('settings.deleteAccount') }}
        </Button>
      </div>
      <p
        v-if="error"
        role="alert"
        class="rounded-md bg-destructive px-3 py-2 text-sm text-destructive-foreground"
      >
        {{ error }}
      </p>
    </section>

    <template v-if="user?.isAdmin">
      <GaitTableSheet />
      <ArenaSettings />
    </template>

    <AlertDialog v-model:open="confirmDelete">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ t('settings.deleteTitle') }}</AlertDialogTitle>
          <AlertDialogDescription>{{ t('settings.deleteText') }}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{{ t('common.cancel') }}</AlertDialogCancel>
          <AlertDialogAction
            :class="buttonVariants({ variant: 'destructive' })"
            :disabled="deleting"
            data-testid="account-delete-confirm"
            @click="deleteAccount"
          >
            {{ t('settings.deleteConfirm') }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </main>
</template>
