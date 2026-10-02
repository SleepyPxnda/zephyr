import type { Path, Pending, PlanSettings } from '@zephyr/core'
import { sql } from 'drizzle-orm'
import {
  boolean,
  char,
  check,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

/** Case-insensitive text (extension created in the first migration). */
const citext = customType<{ data: string }>({ dataType: () => 'citext' })
const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' })
const num = (name: string) => numeric(name, { mode: 'number' })
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

export const userRole = pgEnum('user_role', ['user', 'admin'])
export const memberRole = pgEnum('member_role', ['viewer', 'editor'])
export const fileKind = pgEnum('file_kind', ['audio', 'image'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: citext('email').notNull().unique(),
  name: text('name').notNull().default(''),
  passwordHash: text('password_hash').notNull(),
  role: userRole('role').notNull().default('user'),
  createdAt: createdAt(),
})

export const files = pgTable(
  'files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: fileKind('kind').notNull(),
    mime: text('mime').notNull(),
    bytes: integer('bytes').notNull(),
    storageKey: text('storage_key').notNull().unique(),
    originalName: text('original_name').notNull().default(''),
    durationS: num('duration_s'),
    /** waveform in 20 ms steps */
    peaks: bytea('peaks'),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      'files_size',
      sql`${t.bytes} >= 0 and ((${t.kind} = 'audio' and ${t.bytes} <= 52428800) or (${t.kind} = 'image' and ${t.bytes} <= 15728640))`,
    ),
    index('files_owner_idx').on(t.ownerId),
  ],
)

export const plans = pgTable(
  'plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    musicId: uuid('music_id').references(() => files.id, { onDelete: 'set null' }),
    bpm: num('bpm'),
    beat0S: num('beat0_s').notNull().default(0),
    meter: smallint('meter').notNull().default(4),
    settings: jsonb('settings').$type<PlanSettings>().notNull(),
    revision: integer('revision').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('plans_meter', sql`${t.meter} in (3, 4)`),
    check('plans_bpm', sql`${t.bpm} is null or (${t.bpm} >= 1 and ${t.bpm} <= 260)`),
    check('plans_beat0', sql`${t.beat0S} >= 0`),
    index('plans_owner_idx').on(t.ownerId),
  ],
)

export const planMembers = pgTable(
  'plan_members',
  {
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: memberRole('role').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.planId, t.userId] }),
    index('plan_members_user_idx').on(t.userId),
  ],
)

export const shareLinks = pgTable(
  'share_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    role: memberRole('role').notNull().default('viewer'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [check('share_links_viewer', sql`${t.role} = 'viewer'`)],
)

export const gaits = pgTable(
  'gaits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    position: integer('position').notNull(),
    name: text('name').notNull(),
    color: char('color', { length: 7 }).notNull(),
    speedTack: num('speed_tack').notNull(),
    speedBare: num('speed_bare').notNull(),
    turnDiameterM: num('turn_diameter_m').notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => [
    check(
      'gaits_speed',
      sql`${t.speedTack} > 0 and ${t.speedTack} <= 20 and ${t.speedBare} > 0 and ${t.speedBare} <= 20`,
    ),
    check('gaits_diameter', sql`${t.turnDiameterM} >= 0`),
    check('gaits_color', sql`${t.color} ~ '^#[0-9a-fA-F]{6}$'`),
  ],
)

/** The one hall; exactly one row (id = 1). */
export const arena = pgTable(
  'arena',
  {
    id: smallint('id').primaryKey().default(1),
    imageId: uuid('image_id').references(() => files.id, { onDelete: 'set null' }),
    widthM: num('width_m').notNull(),
    lengthM: num('length_m').notNull(),
    /** measurements are a placeholder until the real ones are known */
    placeholder: boolean('placeholder').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('arena_single_row', sql`${t.id} = 1`),
    check('arena_size', sql`${t.widthM} > 0 and ${t.lengthM} > 0`),
  ],
)

export const horses = pgTable(
  'horses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    number: integer('number').notNull(),
    name: text('name').notNull().default(''),
    color: char('color', { length: 7 }).notNull(),
    tack: boolean('tack').notNull().default(true),
    path: jsonb('path').$type<Path>().notNull(),
    pending: jsonb('pending').$type<Pending>(),
  },
  (t) => [index('horses_plan_idx').on(t.planId)],
)

export const parts = pgTable(
  'parts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    name: text('name').notNull().default(''),
    startS: num('start_s').notNull(),
    endS: num('end_s').notNull(),
    color: char('color', { length: 7 }).notNull(),
  },
  (t) => [
    check('parts_range', sql`${t.endS} > ${t.startS} and ${t.startS} >= 0`),
    index('parts_plan_idx').on(t.planId),
  ],
)

export const planVersions = pgTable(
  'plan_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    revision: integer('revision').notNull(),
    snapshot: jsonb('snapshot').notNull(),
    label: text('label'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('plan_versions_plan_idx').on(t.planId, t.revision)],
)
