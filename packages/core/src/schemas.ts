import { z } from 'zod'

/** Upper bound of points per horse path (SPEC "Weg-Dokument"). */
export const MAX_PATH_POINTS = 50_000
/** Longest gap that can be entered (s); same limit as the prototype's input. */
export const MAX_GAP_S = 3600

const id = z.uuid()
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const coord = z.number().min(-1e4).max(1e4)
const nonNegTime = z.number().min(0).max(1e6)

export const pointSchema = z.object({ x: coord, y: coord })

export const geoKindSchema = z.enum(['line', 'arc', 'arc3', 'circle'])
export const handSchema = z.enum(['auto', 'left', 'right'])

/** Remembered construction of a section, stored on its first point, used to rebuild it. */
export const geoSchema = z
  .object({
    kind: geoKindSchema,
    E: pointSchema,
    M: pointSchema.optional(),
    hand: handSchema.default('auto'),
    half: z.boolean().default(false),
    round: z.boolean().default(true),
  })
  .refine((g) => g.kind !== 'arc3' || g.M !== undefined, { message: 'arc3 needs M' })

export const pathPointSchema = pointSchema.extend({
  jump: z.literal(true).optional(),
  geo: geoSchema.optional(),
})

export const gapTypeSchema = z.enum(['halt', 'pause'])

export const sectionSchema = z.object({
  start: z.int().min(0),
  gaitId: id,
  gap: z.number().min(0).max(MAX_GAP_S),
  gapType: gapTypeSchema,
  /** Saddle override: null = horse default. */
  tack: z.boolean().nullable(),
})

export const pathSchema = z
  .object({
    v: z.literal(1),
    pts: z.array(pathPointSchema).max(MAX_PATH_POINTS),
    sections: z.array(sectionSchema),
  })
  .superRefine((p, ctx) => {
    if (p.pts.length === 0) {
      if (p.sections.length) ctx.addIssue({ code: 'custom', message: 'sections without points' })
      return
    }
    if (p.sections.length === 0 || p.sections[0]?.start !== 0)
      ctx.addIssue({ code: 'custom', message: 'first section must start at 0', path: ['sections'] })
    p.sections.forEach((s, k) => {
      if (s.start >= p.pts.length)
        ctx.addIssue({ code: 'custom', message: 'start out of range', path: ['sections', k] })
      const prev = p.sections[k - 1]
      if (prev && s.start <= prev.start)
        ctx.addIssue({ code: 'custom', message: 'starts must increase', path: ['sections', k] })
    })
    if (p.pts[0]?.jump)
      ctx.addIssue({ code: 'custom', message: 'first point cannot jump', path: ['pts', 0] })
  })

/** Halt or pause announced with "+ Halt" / "+ Pause" for the next line. */
export const pendingSchema = z.object({
  gap: z.number().min(0).max(MAX_GAP_S),
  gapType: gapTypeSchema,
  /** The next line starts anywhere (after a pause). */
  jump: z.boolean(),
})

export const gaitSchema = z.object({
  id,
  name: z.string().min(1).max(60),
  color,
  /** m/s with saddle */
  speedTack: z.number().gt(0).max(20),
  /** m/s without saddle */
  speedBare: z.number().gt(0).max(20),
  /** smallest circle diameter (m) */
  turnDiameter: z.number().min(0).max(100),
  archivedAt: z.string().nullable().default(null),
})

export const horseSchema = z.object({
  id,
  number: z.int().min(1).max(999),
  name: z.string().max(60),
  color,
  /** Default saddle of the horse (true = with saddle). */
  tack: z.boolean(),
  path: pathSchema,
  pending: pendingSchema.nullable(),
})

export const partSchema = z
  .object({
    id,
    name: z.string().max(60),
    start: nonNegTime,
    end: nonNegTime,
    color,
  })
  .refine((p) => p.end > p.start, { message: 'end must be after start', path: ['end'] })

export const timingSchema = z.object({
  bpm: z.number().min(1).max(260).nullable(),
  beat0: z.number().min(0).max(1e6),
  meter: z.union([z.literal(3), z.literal(4)]),
  musicId: id.nullable(),
})

export const planSettingsSchema = z.object({
  timelineZoom: z.number().min(6).max(90),
  drawGaitId: id.nullable(),
  roundCorners: z.boolean(),
})

/** Body of PUT /api/plans/:id (the revision travels in If-Match). */
export const planContentSchema = z.object({
  title: z.string().min(1).max(200),
  timing: timingSchema,
  settings: planSettingsSchema,
  horses: z.array(horseSchema).max(50),
  parts: z.array(partSchema).max(200),
})

export const planSchema = planContentSchema.extend({
  id,
  revision: z.int().min(0),
})

export const arenaSchema = z.object({
  imageId: id.nullable(),
  /** across the hall (y axis), m */
  widthM: z.number().gt(0).max(500),
  /** along the hall (x axis), m */
  lengthM: z.number().gt(0).max(500),
})

// ---------- API inputs ----------

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254))
/** At least 10 characters; long passphrases are welcome, but bounded for hashing. */
export const passwordSchema = z.string().min(10).max(200)

export const registerSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(1).max(80),
  password: passwordSchema,
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type Point = z.infer<typeof pointSchema>
export type GeoKind = z.infer<typeof geoKindSchema>
export type Hand = z.infer<typeof handSchema>
export type Geo = z.infer<typeof geoSchema>
export type PathPoint = z.infer<typeof pathPointSchema>
export type GapType = z.infer<typeof gapTypeSchema>
export type Section = z.infer<typeof sectionSchema>
export type Path = z.infer<typeof pathSchema>
export type Pending = z.infer<typeof pendingSchema>
export type Gait = z.infer<typeof gaitSchema>
export type Horse = z.infer<typeof horseSchema>
export type Part = z.infer<typeof partSchema>
export type Timing = z.infer<typeof timingSchema>
export type PlanSettings = z.infer<typeof planSettingsSchema>
export type PlanContent = z.infer<typeof planContentSchema>
export type Plan = z.infer<typeof planSchema>
export type Arena = z.infer<typeof arenaSchema>
