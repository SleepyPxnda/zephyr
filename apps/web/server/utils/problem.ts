import { createError, readBody, type H3Error, type H3Event } from 'h3'
import type { z } from 'zod'

/** Machine-readable reason, sent as the `code` member of the problem document. */
export type ProblemCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'invalid_credentials'
  | 'email_taken'
  | 'csrf'
  | 'revision_conflict'
  | 'unknown_gaits'
  | 'no_account'

/** Throwable error that the error handler turns into RFC 9457 `application/problem+json`. */
export function problem(
  status: number,
  code: ProblemCode,
  detail?: string,
  extra: Record<string, unknown> = {},
): H3Error {
  return createError({ statusCode: status, message: detail, data: { code, ...extra } })
}

/** Reads and validates a JSON body; 422 with the list of issues when it does not fit. */
export async function parseBody<S extends z.ZodType>(
  event: H3Event,
  schema: S,
): Promise<z.output<S>> {
  const body: unknown = await readBody(event).catch(() => undefined)
  const res = schema.safeParse(body)
  if (!res.success) {
    throw problem(422, 'validation', 'Die Eingaben sind ungültig.', {
      errors: res.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    })
  }
  return res.data
}
