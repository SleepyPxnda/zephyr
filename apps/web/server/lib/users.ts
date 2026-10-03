import { discordAvatarUrl } from '@zephyr/core'
import type { AppUser } from '../utils/auth'

/** An account as the admin page shows it. */
export const adminUserView = (u: AppUser) => ({
  id: u.id,
  username: u.username,
  name: u.name,
  avatarUrl: discordAvatarUrl(u.discordId, u.avatar),
  status: u.status,
  createdAt: u.createdAt,
  decidedAt: u.decidedAt,
})

export type AdminUserView = ReturnType<typeof adminUserView>
