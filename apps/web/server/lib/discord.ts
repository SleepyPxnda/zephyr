import type { DiscordProfile } from '@zephyr/core'
import { and, eq, ne, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { users } from '../db/schema'
import type { AppUser } from '../utils/auth'

/**
 * Creates or refreshes the account of a Discord user. Unknown users become access requests
 * (`pending`); the super admin is always active and admin.
 */
export async function signInDiscordUser(
  db: Db,
  p: DiscordProfile,
  superAdminId: string,
): Promise<{ user: AppUser; created: boolean }> {
  const isSuper = p.id === superAdminId
  const profile = {
    username: p.username,
    name: p.global_name || p.username,
    avatar: p.avatar ?? null,
  }
  const superFields = isSuper ? { status: 'active' as const, role: 'admin' as const } : {}

  return db.transaction(async (tx) => {
    // a name given up on Discord may now belong to someone else: the old holder keeps their
    // id as name until they sign in again
    await tx
      .update(users)
      .set({ username: sql`${users.discordId}` })
      .where(and(eq(users.username, p.username), ne(users.discordId, p.id)))

    const [existing] = await tx.select().from(users).where(eq(users.discordId, p.id))
    const [user] = existing
      ? await tx
          .update(users)
          .set({ ...profile, ...superFields })
          .where(eq(users.id, existing.id))
          .returning()
      : await tx
          .insert(users)
          .values({
            discordId: p.id,
            ...profile,
            ...superFields,
            ...(isSuper ? { decidedAt: new Date() } : {}),
          })
          .returning()
    if (!user) throw new Error('discord user could not be stored')
    return { user, created: !existing }
  })
}
