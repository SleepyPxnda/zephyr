import { z } from 'zod'

/**
 * Server environment (see .env.example), validated once on first use. Files go to S3, or with
 * STORAGE=local into a folder on disk (local development without an S3).
 */
const envSchema = z.union([
  z.object({
    DATABASE_URL: z.string().min(1),
    STORAGE: z.literal('local'),
    /** relative to apps/web */
    STORAGE_DIR: z.string().min(1).default('.data/storage'),
  }),
  z.object({
    DATABASE_URL: z.string().min(1),
    STORAGE: z.literal('s3').default('s3'),
    S3_ENDPOINT: z.url(),
    S3_REGION: z.string().min(1),
    S3_BUCKET: z.string().min(1),
    S3_ACCESS_KEY: z.string().min(1),
    S3_SECRET_KEY: z.string().min(1),
    S3_FORCE_PATH_STYLE: z.stringbool().default(true),
  }),
])

export type ServerEnv = z.infer<typeof envSchema>
export type S3Env = Extract<ServerEnv, { STORAGE: 's3' }>

let cached: ServerEnv | undefined

export function serverEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  if (source !== process.env) return envSchema.parse(source)
  cached ??= envSchema.parse(source)
  return cached
}

/** Sign-in settings; separate from serverEnv so that migrations do not need them. */
const authEnvSchema = z.object({
  /** comma-separated Discord user ids of the admins: always active and admin */
  SUPER_ADMIN_DISCORD_ID: z
    .string()
    .transform((s) =>
      s
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().regex(/^\d{17,20}$/)).min(1)),
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
