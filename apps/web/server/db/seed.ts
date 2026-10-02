import { randomUUID } from 'node:crypto'
import type { S3Client } from '@aws-sdk/client-s3'
import { emailSchema, passwordSchema } from '@zephyr/core'
import { count, eq } from 'drizzle-orm'
import { hashPassword } from '../lib/password'
import { putObject } from '../lib/storage'
import type { Db } from './client'
import { arena, files, gaits, users } from './schema'

/** Default gaits (SPEC "Gangarten", colours from "Name und Farbthema"). */
export const DEFAULT_GAITS = [
  { name: 'Schritt', color: '#A8DCC4', speedTack: 1.6, speedBare: 1.7, turnDiameterM: 2 },
  { name: 'Trab', color: '#9CC5EA', speedTack: 3.6, speedBare: 3.9, turnDiameterM: 6 },
  { name: 'Galopp', color: '#F6C1A0', speedTack: 5.5, speedBare: 6.0, turnDiameterM: 8 },
]

/** Placeholder size in the 16:9 ratio of the hall image until the real measurements are known. */
export const PLACEHOLDER_ARENA = { lengthM: 40, widthM: 22.5 }

export interface SeedOptions {
  adminEmail: string
  adminPassword: string
  hallImage: Uint8Array
  s3: S3Client
  bucket: string
}

export interface SeedResult {
  adminCreated: boolean
  gaitsCreated: number
  arenaCreated: boolean
}

/** Idempotent: creates what is missing and never overwrites existing data. */
export async function seed(db: Db, o: SeedOptions): Promise<SeedResult> {
  const email = emailSchema.parse(o.adminEmail)
  const password = passwordSchema.parse(o.adminPassword)
  const result: SeedResult = { adminCreated: false, gaitsCreated: 0, arenaCreated: false }

  let [admin] = await db.select().from(users).where(eq(users.email, email))
  if (!admin) {
    ;[admin] = await db
      .insert(users)
      .values({ email, name: 'Admin', passwordHash: await hashPassword(password), role: 'admin' })
      .onConflictDoNothing()
      .returning()
    result.adminCreated = !!admin
    admin ??= (await db.select().from(users).where(eq(users.email, email)))[0]
  } else if (admin.role !== 'admin') {
    await db.update(users).set({ role: 'admin' }).where(eq(users.id, admin.id))
  }
  if (!admin) throw new Error('admin account could not be created')

  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(gaits)
  if (n === 0) {
    await db.insert(gaits).values(DEFAULT_GAITS.map((g, position) => ({ ...g, position })))
    result.gaitsCreated = DEFAULT_GAITS.length
  }

  const [hall] = await db.select().from(arena)
  if (!hall) {
    const key = `images/${randomUUID()}.png`
    await putObject(o.s3, o.bucket, key, o.hallImage, 'image/png')
    await db.transaction(async (tx) => {
      const [file] = await tx
        .insert(files)
        .values({
          ownerId: admin.id,
          kind: 'image',
          mime: 'image/png',
          bytes: o.hallImage.byteLength,
          storageKey: key,
          originalName: 'halle.png',
        })
        .returning()
      const inserted = await tx
        .insert(arena)
        .values({ id: 1, imageId: file?.id, ...PLACEHOLDER_ARENA, placeholder: true })
        .onConflictDoNothing()
        .returning()
      result.arenaCreated = inserted.length > 0
    })
  }
  return result
}
