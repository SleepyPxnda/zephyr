import { discordAvatarUrl } from '@zephyr/core'
import type { AppUser } from '../utils/auth'

/** An account as the admin page shows it. */
export const adminUserView = (u: AppUser, superAdminId: string) => ({
  id: u.id,
  username: u.username,
  name: u.name,
  avatarUrl: discordAvatarUrl(u.discordId, u.avatar),
  status: u.status,
  role: u.role,
  createdAt: u.createdAt,
  decidedAt: u.decidedAt,
  isSuperAdmin: u.discordId === superAdminId,
})

export type AdminUserView = ReturnType<typeof adminUserView>
