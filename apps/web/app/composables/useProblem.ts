/** Problem code of a failed $fetch (RFC 9457 body with a `code` member), if any. */
export function problemCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('data' in error)) return null
  const data = (error as { data: unknown }).data
  if (typeof data !== 'object' || data === null || !('code' in data)) return null
  const code = (data as { code: unknown }).code
  return typeof code === 'string' ? code : null
}
