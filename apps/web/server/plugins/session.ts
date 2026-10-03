import { eq } from 'drizzle-orm'
import { users } from '../db/schema'

/**
 * Session as the app sees it (also while rendering on the server): blocked or deleted accounts
 * count as signed out at once, and role, name and avatar come fresh from the database.
 */
export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', async (session, event) => {
    const id = session.user?.id
    const [user] = id ? await useDb().select().from(users).where(eq(users.id, id)) : []
    if (!user || user.status !== 'active') {
      await clearUserSession(event)
      throw problem(401, 'unauthenticated', 'Bitte anmelden.')
    }
    session.user = sessionUser(user)
  })
})
