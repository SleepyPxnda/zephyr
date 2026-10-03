import { z } from 'zod'

/** Server environment (see .env.example), validated once on first use. */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1).default('garage'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z.stringbool().default(true),
})

export type ServerEnv = z.infer<typeof envSchema>

let cached: ServerEnv | undefined

export function serverEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  if (source !== process.env) return envSchema.parse(source)
  cached ??= envSchema.parse(source)
  return cached
}

/** Sign-in settings; separate from serverEnv so that migrations do not need them. */
const authEnvSchema = z.object({
  /** Discord user id of the super admin: always active and admin */
  SUPER_ADMIN_DISCORD_ID: z.string().regex(/^\d{17,20}$/),
  /** optional: Discord webhook announcing new access requests; empty counts as unset */
  DISCORD_WEBHOOK_URL: z.union([z.literal('').transform(() => undefined), z.url()]).optional(),
})

export type AuthEnv = z.infer<typeof authEnvSchema>

let cachedAuth: AuthEnv | undefined

export function authEnv(source: Record<string, string | undefined> = process.env): AuthEnv {
  if (source !== process.env) return authEnvSchema.parse(source)
  cachedAuth ??= authEnvSchema.parse(source)
  return cachedAuth
}
