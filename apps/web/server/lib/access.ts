import { and, eq, isNull } from 'drizzle-orm'
import type { Db } from '../db/client'
import { planMembers, plans } from '../db/schema'

export type PlanRole = 'viewer' | 'editor' | 'owner'
const RANK: Record<PlanRole, number> = { viewer: 1, editor: 2, owner: 3 }

export const hasRole = (role: PlanRole | null, min: PlanRole): boolean =>
  !!role && RANK[role] >= RANK[min]

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Role of a user on a plan (owner or member role), null without access; deleted plans count as missing. */
export async function planRoleOf(db: Db, userId: string, planId: string): Promise<PlanRole | null> {
  if (!UUID.test(planId)) return null
  const [row] = await db
    .select({ ownerId: plans.ownerId, member: planMembers.role })
    .from(plans)
    .leftJoin(planMembers, and(eq(planMembers.planId, plans.id), eq(planMembers.userId, userId)))
    .where(and(eq(plans.id, planId), isNull(plans.deletedAt)))
  if (!row) return null
  if (row.ownerId === userId) return 'owner'
  return row.member ?? null
}
