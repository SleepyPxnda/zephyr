import { authEnv } from './env'

/**
 * Announces a new access request in Discord, if a webhook is configured. Never blocks or fails
 * the sign-in: errors are only logged.
 */
export function notifyAccessRequest(
  user: { name: string; username: string },
  origin: string,
): void {
  const url = authEnv().DISCORD_WEBHOOK_URL
  if (!url) return
  void $fetch(url, {
    method: 'POST',
    body: {
      content: `Neue Zugangsanfrage: ${user.name} (@${user.username}) – ${origin}/admin/users`,
      // names come from Discord users: never ping anyone
      allowed_mentions: { parse: [] },
    },
  }).catch((e: unknown) => console.error('access request webhook failed', e))
}
