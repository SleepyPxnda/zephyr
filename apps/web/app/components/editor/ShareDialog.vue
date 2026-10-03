<script setup lang="ts">
import type { MemberRole } from '@zephyr/core'
import { Check, Copy, Link2, Trash2, X } from '@lucide/vue'
import { problemCode } from '~/composables/useProblem'

/** Sharing (owner only): people by Discord user name as viewer or editor, read links without an account. */
const props = defineProps<{ planId: string }>()
const open = defineModel<boolean>('open', { required: true })

interface Member {
  userId: string
  username: string
  name: string
  avatarUrl: string
  role: MemberRole
}
interface ShareLink {
  id: string
  token: string
  createdAt: string
}

const { t, d } = useI18n()
const members = ref<Member[]>([])
const links = ref<ShareLink[]>([])
const username = shallowRef('')
const role = shallowRef<MemberRole>('viewer')
const error = shallowRef('')
const busy = shallowRef(false)
const copied = shallowRef<string | null>(null)

const base = computed(() => `/api/plans/${props.planId}`)

async function load() {
  error.value = ''
  try {
    ;[members.value, links.value] = await Promise.all([
      $fetch<Member[]>(`${base.value}/members`),
      $fetch<ShareLink[]>(`${base.value}/share-links`),
    ])
  } catch {
    error.value = t('errors.unknown')
  }
}
watch(open, (o) => {
  if (!o) return
  username.value = ''
  role.value = 'viewer'
  copied.value = null
  void load()
})

/** runs a change; any failure shows one message and reloads the lists */
async function run(
  action: () => Promise<void>,
  failure: (e: unknown) => string = () => t('errors.unknown'),
) {
  error.value = ''
  busy.value = true
  try {
    await action()
  } catch (e) {
    await load()
    error.value = failure(e)
  } finally {
    busy.value = false
  }
}

const invite = () =>
  run(
    async () => {
      const m = await $fetch<Member>(`${base.value}/members`, {
        method: 'POST',
        body: { username: username.value.trim(), role: role.value },
      })
      members.value = [...members.value.filter((x) => x.userId !== m.userId), m].sort((a, b) =>
        a.username.localeCompare(b.username),
      )
      username.value = ''
    },
    (e) =>
      problemCode(e) === 'no_account'
        ? t('share.noAccount')
        : problemCode(e) === 'validation'
          ? t('share.invalidUsername')
          : t('errors.unknown'),
  )

const setRole = (m: Member, r: unknown) =>
  r === 'viewer' || r === 'editor'
    ? run(async () => {
        await $fetch(`${base.value}/members/${m.userId}`, { method: 'PUT', body: { role: r } })
        members.value = members.value.map((x) => (x.userId === m.userId ? { ...x, role: r } : x))
      })
    : undefined

const removeMember = (m: Member) =>
  run(async () => {
    await $fetch(`${base.value}/members/${m.userId}`, { method: 'DELETE' })
    members.value = members.value.filter((x) => x.userId !== m.userId)
  })

const createLink = () =>
  run(async () => {
    const l = await $fetch<ShareLink>(`${base.value}/share-links`, { method: 'POST' })
    links.value = [...links.value, l]
    await copy(l)
  })

const revokeLink = (l: ShareLink) =>
  run(async () => {
    await $fetch(`${base.value}/share-links/${l.id}`, { method: 'DELETE' })
    links.value = links.value.filter((x) => x.id !== l.id)
  })

const linkUrl = (l: ShareLink) =>
  `${window.location.origin}/plans/${props.planId}/play?t=${encodeURIComponent(l.token)}`

async function copy(l: ShareLink) {
  try {
    await navigator.clipboard.writeText(linkUrl(l))
    copied.value = l.id
  } catch {
    // clipboard blocked: the address stays selectable in the field
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ $t('share.title') }}</DialogTitle>
        <DialogDescription>{{ $t('share.description') }}</DialogDescription>
      </DialogHeader>

      <!-- people -->
      <section class="flex flex-col gap-3" :aria-label="$t('share.people')">
        <h3 class="text-sm font-semibold">{{ $t('share.people') }}</h3>
        <form class="flex flex-wrap items-end gap-2" @submit.prevent="invite">
          <div class="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label for="share-username">{{ $t('share.username') }}</Label>
            <Input
              id="share-username"
              v-model="username"
              type="text"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              maxlength="33"
              :placeholder="$t('share.usernamePlaceholder')"
              data-testid="share-username"
            />
          </div>
          <Select v-model="role">
            <SelectTrigger class="w-36" :aria-label="$t('share.role')"
              ><SelectValue
            /></SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">{{ $t('roles.viewer') }}</SelectItem>
              <SelectItem value="editor">{{ $t('roles.editor') }}</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" :disabled="busy || !username.trim()" data-testid="share-invite">
            {{ $t('share.invite') }}
          </Button>
        </form>
        <p v-if="!members.length" class="text-sm text-muted-foreground">
          {{ $t('share.noPeople') }}
        </p>
        <ul v-else class="flex flex-col divide-y rounded-md border" data-testid="share-members">
          <li v-for="m in members" :key="m.userId" class="flex items-center gap-2 px-3 py-2">
            <img
              :src="m.avatarUrl"
              alt=""
              class="size-8 shrink-0 rounded-full bg-muted"
              loading="lazy"
              referrerpolicy="no-referrer"
            />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ m.name || m.username }}</p>
              <p class="truncate text-xs text-muted-foreground">@{{ m.username }}</p>
            </div>
            <Select :model-value="m.role" :disabled="busy" @update:model-value="setRole(m, $event)">
              <SelectTrigger
                class="w-36"
                size="sm"
                :aria-label="$t('share.roleOf', { name: m.name || m.username })"
                ><SelectValue
              /></SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">{{ $t('roles.viewer') }}</SelectItem>
                <SelectItem value="editor">{{ $t('roles.editor') }}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon-sm"
              :disabled="busy"
              :aria-label="$t('share.removeMember', { name: m.name || m.username })"
              @click="removeMember(m)"
            >
              <X />
            </Button>
          </li>
        </ul>
      </section>

      <!-- read links -->
      <section class="flex flex-col gap-3 border-t pt-4" :aria-label="$t('share.links')">
        <div class="flex items-center justify-between gap-2">
          <h3 class="text-sm font-semibold">{{ $t('share.links') }}</h3>
          <Button
            variant="outline"
            size="sm"
            :disabled="busy"
            data-testid="share-create-link"
            @click="createLink"
          >
            <Link2 />
            {{ $t('share.createLink') }}
          </Button>
        </div>
        <p class="text-sm text-muted-foreground">{{ $t('share.linksHint') }}</p>
        <ul v-if="links.length" class="flex flex-col gap-2" data-testid="share-links">
          <li v-for="l in links" :key="l.id" class="flex items-center gap-2">
            <Input
              :model-value="linkUrl(l)"
              readonly
              class="h-8 flex-1 font-mono text-xs"
              :aria-label="$t('share.linkCreated', { date: d(new Date(l.createdAt), 'short') })"
              @focus="($event.target as HTMLInputElement).select()"
            />
            <Button
              variant="ghost"
              size="icon-sm"
              :aria-label="$t('share.copy')"
              :title="copied === l.id ? $t('share.copied') : $t('share.copy')"
              @click="copy(l)"
            >
              <Check v-if="copied === l.id" />
              <Copy v-else />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              :disabled="busy"
              :aria-label="$t('share.revoke')"
              :title="$t('share.revoke')"
              @click="revokeLink(l)"
            >
              <Trash2 />
            </Button>
          </li>
        </ul>
      </section>

      <p
        v-if="error"
        role="alert"
        class="rounded-md bg-destructive px-3 py-2 text-sm text-destructive-foreground"
      >
        {{ error }}
      </p>
    </DialogContent>
  </Dialog>
</template>
