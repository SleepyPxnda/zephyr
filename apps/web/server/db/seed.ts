import { randomUUID } from 'node:crypto'
import type { S3Client } from '@aws-sdk/client-s3'
import { count, eq } from 'drizzle-orm'
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

/** Made-up accounts for development: one of each status (ids are not real Discord ids). */
export const DEMO_USERS = [
  { discordId: '100000000000000001', username: 'anna', name: 'Anna (Demo)', status: 'active' },
  { discordId: '100000000000000002', username: 'ben', name: 'Ben (Demo)', status: 'pending' },
  { discordId: '100000000000000003', username: 'clara', name: 'Clara (Demo)', status: 'rejected' },
] as const

export interface SeedOptions {
  superAdminDiscordId: string
  /** also create DEMO_USERS (never in production) */
  demoUsers: boolean
  hallImage: Uint8Array
  s3: S3Client
  bucket: string
}

export interface SeedResult {
  adminCreated: boolean
  demoUsersCreated: number
  gaitsCreated: number
  arenaCreated: boolean
}

/** Idempotent: creates what is missing and never overwrites existing data. */
export async function seed(db: Db, o: SeedOptions): Promise<SeedResult> {
  const result: SeedResult = {
    adminCreated: false,
    demoUsersCreated: 0,
    gaitsCreated: 0,
    arenaCreated: false,
  }

  // the super admin: name and avatar follow at the first Discord sign-in
  const [created] = await db
    .insert(users)
    .values({
      discordId: o.superAdminDiscordId,
      // placeholder until the first sign-in; the id cannot collide with a Discord name
      username: o.superAdminDiscordId,
      name: 'Admin',
      status: 'active',
      role: 'admin',
      decidedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning()
  result.adminCreated = !!created
  const [admin] = await db.select().from(users).where(eq(users.discordId, o.superAdminDiscordId))
  if (!admin) throw new Error('admin account could not be created')

  if (o.demoUsers) {
    const demo = await db
      .insert(users)
      .values(DEMO_USERS.map((u) => ({ ...u })))
      .onConflictDoNothing()
      .returning()
    result.demoUsersCreated = demo.length
  }

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
