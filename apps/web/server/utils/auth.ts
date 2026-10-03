import { discordAvatarUrl } from '@zephyr/core'
import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { users } from '../db/schema'
import { hasRole, planRoleOf, type PlanRole } from '../lib/access'
import { authEnv } from '../lib/env'

export type AppUser = typeof users.$inferSelect

/** The account with this id when it exists and is active, otherwise null. */
export async function findActiveUser(id: string): Promise<AppUser | null> {
  const [user] = await useDb().select().from(users).where(eq(users.id, id))
  return user && user.status === 'active' ? user : null
}

/**
 * Session user, re-read from the database (deleted or blocked accounts count at once).
 */
export async function requireUser(event: H3Event): Promise<AppUser> {
  const session = await getUserSession(event)
  const id = session.user?.id
  if (!id) throw problem(401, 'unauthenticated', 'Bitte anmelden.')
  const user = await findActiveUser(id)
  // blocked or not (yet) approved accounts lose their session at once
  if (!user) {
    await clearUserSession(event)
    throw problem(401, 'unauthenticated', 'Bitte anmelden.')
  }
  return user
}

/** The one admin: the account of SUPER_ADMIN_DISCORD_ID. */
export const isAdmin = (u: AppUser) => u.discordId === authEnv().SUPER_ADMIN_DISCORD_ID

export async function requireAdmin(event: H3Event): Promise<AppUser> {
  const user = await requireUser(event)
  if (!isAdmin(user)) throw problem(403, 'forbidden', 'Nur für Administratoren.')
  return user
}

/**
 * Requires at least `min` on the plan. Plans the user cannot see answer 404 (their existence is
 * not revealed); visible plans with too little rights answer 403.
 */
export async function requirePlanRole(
  event: H3Event,
  planId: string,
  min: PlanRole,
): Promise<{ user: AppUser; role: PlanRole }> {
  const user = await requireUser(event)
  const role = await planRoleOf(useDb(), user.id, planId)
  if (!role) throw problem(404, 'not_found', 'Plan nicht gefunden.')
  if (!hasRole(role, min))
    throw problem(403, 'forbidden', 'Dafür fehlen die Rechte an diesem Plan.')
  return { user, role }
}

/** What goes into the (encrypted) session cookie: only what identifies and shows the user. */
export const sessionUser = (u: AppUser) => ({
  id: u.id,
  username: u.username,
  name: u.name,
  avatarUrl: discordAvatarUrl(u.discordId, u.avatar),
  isAdmin: isAdmin(u),
})
