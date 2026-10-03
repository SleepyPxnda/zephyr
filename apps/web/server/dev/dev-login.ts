import { usernameSchema } from '@zephyr/core'
import { and, eq } from 'drizzle-orm'
import { users } from '../db/schema'

/**
 * Development only (registered via $development in nuxt.config.ts, absent from production
 * builds): signs in as an active account without Discord, for checks in the browser.
 */
export default defineEventHandler(async (event) => {
  const username = usernameSchema.safeParse(getQuery(event).username)
  if (!username.success) throw problem(404, 'not_found')
  const [user] = await useDb()
    .select()
    .from(users)
    .where(and(eq(users.username, username.data), eq(users.status, 'active')))
  if (!user) throw problem(404, 'not_found', 'Kein aktives Konto mit diesem Namen.')
  await replaceUserSession(event, { user: sessionUser(user), loggedInAt: Date.now() })
  return sendRedirect(event, '/')
})
