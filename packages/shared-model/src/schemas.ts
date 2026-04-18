import { z } from 'zod';
import { normalizeUnitToPlural } from './unit-normalization';

const timestampMsSchema = z
  .number()
  .int()
  .nonnegative()
  .refine((v) => Number.isFinite(v), 'timestampMs must be finite');

// Cadence unit types - supports day, week, month, and future extensions
export const cadenceUnitSchema = z.enum(['day', 'week', 'month']);

// Cadence structure: {interval: number, unit: 'day' | 'week' | 'month'}
export const standardCadenceSchema = z.object({
  interval: z.number().int().positive(),
  unit: cadenceUnitSchema,
});

// Legacy cadence schema for backward compatibility (deprecated)
export const legacyStandardCadenceSchema = z.union([
  z.literal('daily'),
  z.literal('weekly'),
  z.literal('monthly')
]);

export const standardStateSchema = z.union([z.literal('active'), z.literal('archived')]);

export const standardSessionConfigSchema = z.object({
  sessionLabel: z.string().min(1).max(40),
  sessionsPerCadence: z.number().int().positive(),
  volumePerSession: z.number().positive(),
});

const periodStartPreferenceSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('default') }),
  z.object({
    mode: z.literal('weekDay'),
    weekStartDay: z.number().int().min(1).max(7),
  }),
]);

export const activitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  unit: z
    .string()
    .min(1)
    .max(40)
    .transform((val) => {
      try {
        return normalizeUnitToPlural(val);
      } catch (error) {
        // If normalization fails, throw a Zod error
        throw new z.ZodError([
          {
            code: z.ZodIssueCode.custom,
            path: ['unit'],
            message: error instanceof Error ? error.message : 'Invalid unit'
          }
        ]);
      }
    }),
  notes: z.string().max(1000).nullable().default(null),
  createdAtMs: timestampMsSchema,
  updatedAtMs: timestampMsSchema,
  deletedAtMs: timestampMsSchema.nullable()
});

export const configEraSchema = z.object({
  effectiveFromMs: timestampMsSchema,
  minimum: z.number().min(0),
  unit: z.string().min(1).max(40),
  cadence: standardCadenceSchema,
  sessionConfig: standardSessionConfigSchema,
  summary: z.string().min(1).max(200),
  periodStartPreference: periodStartPreferenceSchema.optional(),
});

export const standardSchema = z.object({
  id: z.string().min(1),
  name: z.string().max(120).default(''), // Allow empty for pre-migration docs
  minimum: z.number().min(0),
  unit: z
    .string()
    .min(1)
    .max(40)
    .transform((val) => {
      try {
        return normalizeUnitToPlural(val);
      } catch (error) {
        // If normalization fails, throw a Zod error
        throw new z.ZodError([
          {
            code: z.ZodIssueCode.custom,
            path: ['unit'],
            message: error instanceof Error ? error.message : 'Invalid unit'
          }
        ]);
      }
    }),
  cadence: standardCadenceSchema,
  state: standardStateSchema,
  summary: z.string().min(1).max(200), // Normalized summary string like "1000 calls / week" or "5 sessions × 15 minutes = 75 minutes / week"
  archivedAtMs: timestampMsSchema.nullable(), // Timestamp when archived, null if active
  quickAddValues: z.array(z.number().positive()).max(5).optional(),
  sessionConfig: standardSessionConfigSchema, // Required: session-based configuration
  periodStartPreference: periodStartPreferenceSchema.optional(),
  configEras: z.array(configEraSchema).optional(),
  notes: z.string().max(1000).nullable().default(null),
  orderIndex: z.number().int().nonnegative().optional(),
  hiddenFromGroup: z.boolean().optional(),
  activityId: z.string().min(1).optional(), // Deprecated: kept for migration
  createdAtMs: timestampMsSchema,
  updatedAtMs: timestampMsSchema,
  deletedAtMs: timestampMsSchema.nullable()
}).refine(
  (data) => data.minimum === data.sessionConfig.sessionsPerCadence * data.sessionConfig.volumePerSession,
  {
    message: 'minimum must equal sessionsPerCadence × volumePerSession',
    path: ['minimum'],
  }
);

export const activityLogSchema = z.object({
  id: z.string().min(1),
  standardId: z.string().min(1),
  value: z.number().min(0),
  occurredAtMs: timestampMsSchema,
  note: z.string().max(500).nullable(),
  editedAtMs: timestampMsSchema.nullable(),
  createdAtMs: timestampMsSchema,
  updatedAtMs: timestampMsSchema,
  deletedAtMs: timestampMsSchema.nullable()
});

export type ActivitySchema = z.infer<typeof activitySchema>;
export type StandardSchema = z.infer<typeof standardSchema>;
export type ActivityLogSchema = z.infer<typeof activityLogSchema>;
export type DashboardPinsSchema = z.infer<typeof dashboardPinsSchema>;

export const dashboardPinsSchema = z.object({
  id: z.string().min(1),
  pinnedStandardIds: z.array(z.string().min(1)),
  updatedAtMs: timestampMsSchema
});

export const activityHistorySourceSchema = z.enum(['boundary', 'resume', 'log-edit']);

export const activityHistoryStandardSnapshotSchema = z.object({
  minimum: z.number().min(0),
  unit: z.string().min(1).max(40),
  cadence: standardCadenceSchema,
  sessionConfig: standardSessionConfigSchema,
  summary: z.string().max(200).optional(),
  periodStartPreference: periodStartPreferenceSchema.optional(),
});

export const activityHistoryPeriodStatusSchema = z.enum(['Met', 'In Progress', 'Missed']);

export const activityHistoryDocSchema = z
  .object({
    id: z.string().min(1),
    standardId: z.string().min(1),
    activityId: z.string().min(1).optional(), // Deprecated: kept for migration
    referenceTimestampMs: timestampMsSchema,
    standardSnapshot: activityHistoryStandardSnapshotSchema,
    total: z.number().min(0),
    currentSessions: z.number().int().nonnegative(),
    targetSessions: z.number().int().nonnegative(),
    status: activityHistoryPeriodStatusSchema,
    progressPercent: z.number().min(0).max(100),
    generatedAtMs: timestampMsSchema,
    source: activityHistorySourceSchema,
    deletedAtMs: timestampMsSchema.nullable().optional(),
    periodStartMs: timestampMsSchema.optional(),
    periodEndMs: timestampMsSchema.optional(),
    periodLabel: z.string().min(1).max(200).optional(),
    periodKey: z.string().min(1).max(50).optional(),
  })
  .superRefine((data, ctx) => {
    if (
      typeof data.periodStartMs === 'number' &&
      typeof data.periodEndMs === 'number' &&
      data.periodEndMs < data.periodStartMs
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['periodEndMs'],
        message: 'periodEndMs must be greater than or equal to periodStartMs',
      });
    }
  });

export type ActivityHistoryDocSchema = z.infer<typeof activityHistoryDocSchema>;
