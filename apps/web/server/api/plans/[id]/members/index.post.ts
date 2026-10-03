import { discordAvatarUrl, memberInviteSchema } from '@zephyr/core'
import { and, eq } from 'drizzle-orm'
import { planMembers, users } from '../../../../db/schema'

/**
 * Shares the plan with an approved account by Discord user name; an existing share gets the new
 * role. Unknown or not approved names are refused.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const { user } = await requirePlanRole(event, id, 'owner')
  const { username, role } = await parseBody(event, memberInviteSchema)
  const db = useDb()
  const [target] = await db
    .select()
    .from(users)
    .where(and(eq(users.username, username), eq(users.status, 'active')))
  if (!target)
    throw problem(404, 'no_account', 'Kein freigegebenes Konto mit diesem Discord-Namen.')
  if (target.id === user.id)
    throw problem(422, 'validation', 'Der Plan gehört dir bereits.', {
      errors: [{ path: 'username', message: 'owner' }],
    })
  await db
    .insert(planMembers)
    .values({ planId: id, userId: target.id, role })
    .onConflictDoUpdate({ target: [planMembers.planId, planMembers.userId], set: { role } })
  setResponseStatus(event, 201)
  return {
    userId: target.id,
    username: target.username,
    name: target.name,
    avatarUrl: discordAvatarUrl(target.discordId, target.avatar),
    role,
  }
})
