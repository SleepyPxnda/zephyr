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
