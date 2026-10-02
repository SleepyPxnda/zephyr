import { loginSchema } from '@zephyr/core'
import { eq } from 'drizzle-orm'
import { users } from '../../db/schema'
import { dummyHash, verifyPassword } from '../../lib/password'

export default defineEventHandler(async (event) => {
  const input = await parseBody(event, loginSchema)
  const [user] = await useDb().select().from(users).where(eq(users.email, input.email))
  // verify against a dummy hash for unknown addresses, so timing does not reveal accounts
  const ok = await verifyPassword(user?.passwordHash ?? (await dummyHash()), input.password)
  if (!user || !ok)
    throw problem(401, 'invalid_credentials', 'E-Mail-Adresse oder Passwort stimmt nicht.')
  await replaceUserSession(event, { user: sessionUser(user), loggedInAt: Date.now() })
  return sessionUser(user)
})
