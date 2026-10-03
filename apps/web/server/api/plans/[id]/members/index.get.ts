import { discordAvatarUrl } from '@zephyr/core'
import { asc, eq } from 'drizzle-orm'
import { planMembers, users } from '../../../../db/schema'

/** People the plan is shared with (the owner is not listed). */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  await requirePlanRole(event, id, 'owner')
  const rows = await useDb()
    .select({
      userId: planMembers.userId,
      username: users.username,
      name: users.name,
      discordId: users.discordId,
      avatar: users.avatar,
      role: planMembers.role,
    })
    .from(planMembers)
    .innerJoin(users, eq(users.id, planMembers.userId))
    .where(eq(planMembers.planId, id))
    .orderBy(asc(users.username))
  return rows.map(({ discordId, avatar, ...m }) => ({
    ...m,
    avatarUrl: discordAvatarUrl(discordId, avatar),
  }))
})
