import { and, desc, eq, isNull, or } from 'drizzle-orm'
import { planMembers, plans } from '../../db/schema'

/** Own and shared plans: id, title, last change, role. */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const rows = await useDb()
    .select({
      id: plans.id,
      title: plans.title,
      updatedAt: plans.updatedAt,
      ownerId: plans.ownerId,
      member: planMembers.role,
    })
    .from(plans)
    .leftJoin(planMembers, and(eq(planMembers.planId, plans.id), eq(planMembers.userId, user.id)))
    .where(
      and(isNull(plans.deletedAt), or(eq(plans.ownerId, user.id), eq(planMembers.userId, user.id))),
    )
    .orderBy(desc(plans.updatedAt))
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    updatedAt: r.updatedAt.toISOString(),
    role: r.ownerId === user.id ? 'owner' : (r.member ?? 'viewer'),
  }))
})
