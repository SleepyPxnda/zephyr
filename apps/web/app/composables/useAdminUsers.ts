import type { AdminUserPatch, UserStatus } from '@zephyr/core'

export interface AdminUser {
  id: string
  username: string
  name: string
  avatarUrl: string
  status: UserStatus
  createdAt: string
  decidedAt: string | null
}

/** Accounts for the admin page and the count of open access requests (admin only). */
export function useAdminUsers() {
  const { user } = useUserSession()
  const isAdmin = computed(() => !!user.value?.isAdmin)
  const { data, refresh } = useFetch<AdminUser[]>('/api/admin/users', {
    key: 'admin-users',
    default: () => [],
    immediate: isAdmin.value,
  })
  const pendingCount = computed(() => data.value.filter((u) => u.status === 'pending').length)

  async function patch(id: string, body: AdminUserPatch) {
    try {
      await $fetch(`/api/admin/users/${id}`, { method: 'PATCH', body })
    } finally {
      await refresh()
    }
  }

  return { isAdmin, users: data, pendingCount, patch, refresh }
}
