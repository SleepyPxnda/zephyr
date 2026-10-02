import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { users } from '../db/schema'
import { hasRole, planRoleOf, type PlanRole } from '../lib/access'

export type AppUser = typeof users.$inferSelect

/** Session user, re-read from the database (deleted accounts and role changes count at once). */
export async function requireUser(event: H3Event): Promise<AppUser> {
  const session = await getUserSession(event)
  const id = session.user?.id
  if (!id) throw problem(401, 'unauthenticated', 'Bitte anmelden.')
  const [user] = await useDb().select().from(users).where(eq(users.id, id))
  if (!user) {
    await clearUserSession(event)
    throw problem(401, 'unauthenticated', 'Bitte anmelden.')
  }
  return user
}

export async function requireAdmin(event: H3Event): Promise<AppUser> {
  const user = await requireUser(event)
  if (user.role !== 'admin') throw problem(403, 'forbidden', 'Nur für Administratoren.')
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

/** What goes into the (encrypted) session cookie: only what identifies the user. */
export const sessionUser = (u: AppUser) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
})
