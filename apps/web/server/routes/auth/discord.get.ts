import { discordProfileSchema } from '@zephyr/core'
import { signInDiscordUser } from '../../lib/discord'
import { authEnv } from '../../lib/env'
import { notifyAccessRequest } from '../../lib/webhook'

/** Discord OAuth: start (no `code`) and callback. Only approved accounts get a session. */
export default defineOAuthDiscordEventHandler({
  config: { scope: ['identify'] },
  async onSuccess(event, { user: raw }) {
    const profile = discordProfileSchema.safeParse(raw)
    if (!profile.success) return sendRedirect(event, '/login?status=error')
    const { user, created } = await signInDiscordUser(
      useDb(),
      profile.data,
      authEnv().SUPER_ADMIN_DISCORD_ID,
    )
    if (user.status !== 'active') {
      if (created) {
        const origin = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin
        notifyAccessRequest(user, origin)
      }
      await clearUserSession(event)
      return sendRedirect(event, `/login?status=${user.status}`)
    }
    await replaceUserSession(event, { user: sessionUser(user), loggedInAt: Date.now() })
    return sendRedirect(event, '/')
  },
  onError(event, error) {
    console.error('discord sign-in failed', error)
    return sendRedirect(event, '/login?status=error')
  },
})
