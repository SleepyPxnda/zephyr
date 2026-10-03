/**
 * Avatar image of a Discord user. Without an own avatar Discord shows one of six default
 * avatars, chosen from the user id (new username system: (id >> 22) % 6).
 */
export function discordAvatarUrl(discordId: string, avatar: string | null): string {
  if (avatar) return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=64`
  const index = Number((BigInt(discordId) >> 22n) % 6n)
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`
}
