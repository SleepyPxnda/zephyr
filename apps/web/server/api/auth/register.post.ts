import { registerSchema } from '@zephyr/core'
import { users } from '../../db/schema'
import { hashPassword } from '../../lib/password'

export default defineEventHandler(async (event) => {
  const input = await parseBody(event, registerSchema)
  const [user] = await useDb()
    .insert(users)
    .values({
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
    })
    .onConflictDoNothing({ target: users.email })
    .returning()
  if (!user) throw problem(409, 'email_taken', 'Für diese E-Mail-Adresse gibt es schon ein Konto.')
  await replaceUserSession(event, { user: sessionUser(user), loggedInAt: Date.now() })
  setResponseStatus(event, 201)
  return sessionUser(user)
})
