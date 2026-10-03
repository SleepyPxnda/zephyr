import { asc, eq } from 'drizzle-orm'
import { planMembers, users } from '../../../../db/schema'

/** People the plan is shared with (the owner is not listed). */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? ''
  await requirePlanRole(event, id, 'owner')
  return useDb()
    .select({
      userId: planMembers.userId,
      email: users.email,
      name: users.name,
      role: planMembers.role,
    })
    .from(planMembers)
    .innerJoin(users, eq(users.id, planMembers.userId))
    .where(eq(planMembers.planId, id))
    .orderBy(asc(users.email))
})
