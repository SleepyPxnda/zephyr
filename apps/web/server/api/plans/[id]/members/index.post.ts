import { memberInviteSchema } from '@zephyr/core'
import { eq } from 'drizzle-orm'
import { planMembers, users } from '../../../../db/schema'

/**
 * Shares the plan with an existing account by e-mail; an existing share gets the new role.
 * Accounts that do not exist yet are refused (no invitations by mail, see plan M10).
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  const { user } = await requirePlanRole(event, id, 'owner')
  const { email, role } = await parseBody(event, memberInviteSchema)
  const db = useDb()
  const [target] = await db
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.email, email))
  if (!target) throw problem(404, 'no_account', 'Kein Konto mit dieser E-Mail-Adresse.')
  if (target.id === user.id)
    throw problem(422, 'validation', 'Der Plan gehört dir bereits.', {
      errors: [{ path: 'email', message: 'owner' }],
    })
  await db
    .insert(planMembers)
    .values({ planId: id, userId: target.id, role })
    .onConflictDoUpdate({ target: [planMembers.planId, planMembers.userId], set: { role } })
  setResponseStatus(event, 201)
  return { userId: target.id, email: target.email, name: target.name, role }
})
