"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activityHistoryDocSchema = exports.activityHistoryPeriodStatusSchema = exports.activityHistoryStandardSnapshotSchema = exports.activityHistorySourceSchema = exports.dashboardPinsSchema = exports.activityLogSchema = exports.standardSchema = exports.configEraSchema = exports.activitySchema = exports.standardSessionConfigSchema = exports.standardStateSchema = exports.legacyStandardCadenceSchema = exports.standardCadenceSchema = exports.cadenceUnitSchema = void 0;
const zod_1 = require("zod");
const unit_normalization_1 = require("./unit-normalization");
const timestampMsSchema = zod_1.z
    .number()
    .int()
    .nonnegative()
    .refine((v) => Number.isFinite(v), 'timestampMs must be finite');
// Cadence unit types - supports day, week, month, and future extensions
exports.cadenceUnitSchema = zod_1.z.enum(['day', 'week', 'month']);
// Cadence structure: {interval: number, unit: 'day' | 'week' | 'month'}
exports.standardCadenceSchema = zod_1.z.object({
    interval: zod_1.z.number().int().positive(),
    unit: exports.cadenceUnitSchema,
});
// Legacy cadence schema for backward compatibility (deprecated)
exports.legacyStandardCadenceSchema = zod_1.z.union([
    zod_1.z.literal('daily'),
    zod_1.z.literal('weekly'),
    zod_1.z.literal('monthly')
]);
exports.standardStateSchema = zod_1.z.union([zod_1.z.literal('active'), zod_1.z.literal('archived')]);
exports.standardSessionConfigSchema = zod_1.z.object({
    sessionLabel: zod_1.z.string().min(1).max(40),
    sessionsPerCadence: zod_1.z.number().int().positive(),
    volumePerSession: zod_1.z.number().positive(),
});
const periodStartPreferenceSchema = zod_1.z.discriminatedUnion('mode', [
    zod_1.z.object({ mode: zod_1.z.literal('default') }),
    zod_1.z.object({
        mode: zod_1.z.literal('weekDay'),
        weekStartDay: zod_1.z.number().int().min(1).max(7),
    }),
]);
exports.activitySchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1).max(120),
    unit: zod_1.z
        .string()
        .min(1)
        .max(40)
        .transform((val) => {
        try {
            return (0, unit_normalization_1.normalizeUnitToPlural)(val);
        }
        catch (error) {
            // If normalization fails, throw a Zod error
            throw new zod_1.z.ZodError([
                {
                    code: zod_1.z.ZodIssueCode.custom,
                    path: ['unit'],
                    message: error instanceof Error ? error.message : 'Invalid unit'
                }
            ]);
        }
    }),
    notes: zod_1.z.string().max(1000).nullable().default(null),
    createdAtMs: timestampMsSchema,
    updatedAtMs: timestampMsSchema,
    deletedAtMs: timestampMsSchema.nullable()
});
exports.configEraSchema = zod_1.z.object({
    effectiveFromMs: timestampMsSchema,
    minimum: zod_1.z.number().min(0),
    unit: zod_1.z.string().min(1).max(40),
    cadence: exports.standardCadenceSchema,
    sessionConfig: exports.standardSessionConfigSchema,
    summary: zod_1.z.string().min(1).max(200),
    periodStartPreference: periodStartPreferenceSchema.optional(),
});
exports.standardSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    name: zod_1.z.string().max(120).default(''), // Allow empty for pre-migration docs
    minimum: zod_1.z.number().min(0),
    unit: zod_1.z
        .string()
        .min(1)
        .max(40)
        .transform((val) => {
        try {
            return (0, unit_normalization_1.normalizeUnitToPlural)(val);
        }
        catch (error) {
            // If normalization fails, throw a Zod error
            throw new zod_1.z.ZodError([
                {
                    code: zod_1.z.ZodIssueCode.custom,
                    path: ['unit'],
                    message: error instanceof Error ? error.message : 'Invalid unit'
                }
            ]);
        }
    }),
    cadence: exports.standardCadenceSchema,
    state: exports.standardStateSchema,
    summary: zod_1.z.string().min(1).max(200), // Normalized summary string like "1000 calls / week" or "5 sessions × 15 minutes = 75 minutes / week"
    archivedAtMs: timestampMsSchema.nullable(), // Timestamp when archived, null if active
    quickAddValues: zod_1.z.array(zod_1.z.number().positive()).max(5).optional(),
    sessionConfig: exports.standardSessionConfigSchema, // Required: session-based configuration
    periodStartPreference: periodStartPreferenceSchema.optional(),
    configEras: zod_1.z.array(exports.configEraSchema).optional(),
    notes: zod_1.z.string().max(1000).nullable().default(null),
    activityId: zod_1.z.string().min(1).optional(), // Deprecated: kept for migration
    createdAtMs: timestampMsSchema,
    updatedAtMs: timestampMsSchema,
    deletedAtMs: timestampMsSchema.nullable()
}).refine((data) => data.minimum === data.sessionConfig.sessionsPerCadence * data.sessionConfig.volumePerSession, {
    message: 'minimum must equal sessionsPerCadence × volumePerSession',
    path: ['minimum'],
});
exports.activityLogSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    standardId: zod_1.z.string().min(1),
    value: zod_1.z.number().min(0),
    occurredAtMs: timestampMsSchema,
    note: zod_1.z.string().max(500).nullable(),
    editedAtMs: timestampMsSchema.nullable(),
    createdAtMs: timestampMsSchema,
    updatedAtMs: timestampMsSchema,
    deletedAtMs: timestampMsSchema.nullable()
});
exports.dashboardPinsSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    pinnedStandardIds: zod_1.z.array(zod_1.z.string().min(1)),
    updatedAtMs: timestampMsSchema
});
exports.activityHistorySourceSchema = zod_1.z.enum(['boundary', 'resume', 'log-edit']);
exports.activityHistoryStandardSnapshotSchema = zod_1.z.object({
    minimum: zod_1.z.number().min(0),
    unit: zod_1.z.string().min(1).max(40),
    cadence: exports.standardCadenceSchema,
    sessionConfig: exports.standardSessionConfigSchema,
    summary: zod_1.z.string().max(200).optional(),
    periodStartPreference: periodStartPreferenceSchema.optional(),
});
exports.activityHistoryPeriodStatusSchema = zod_1.z.enum(['Met', 'In Progress', 'Missed']);
exports.activityHistoryDocSchema = zod_1.z
    .object({
    id: zod_1.z.string().min(1),
    standardId: zod_1.z.string().min(1),
    activityId: zod_1.z.string().min(1).optional(), // Deprecated: kept for migration
    referenceTimestampMs: timestampMsSchema,
    standardSnapshot: exports.activityHistoryStandardSnapshotSchema,
    total: zod_1.z.number().min(0),
    currentSessions: zod_1.z.number().int().nonnegative(),
    targetSessions: zod_1.z.number().int().nonnegative(),
    status: exports.activityHistoryPeriodStatusSchema,
    progressPercent: zod_1.z.number().min(0).max(100),
    generatedAtMs: timestampMsSchema,
    source: exports.activityHistorySourceSchema,
    deletedAtMs: timestampMsSchema.nullable().optional(),
    periodStartMs: timestampMsSchema.optional(),
    periodEndMs: timestampMsSchema.optional(),
    periodLabel: zod_1.z.string().min(1).max(200).optional(),
    periodKey: zod_1.z.string().min(1).max(50).optional(),
})
    .superRefine((data, ctx) => {
    if (typeof data.periodStartMs === 'number' &&
        typeof data.periodEndMs === 'number' &&
        data.periodEndMs < data.periodStartMs) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['periodEndMs'],
            message: 'periodEndMs must be greater than or equal to periodStartMs',
        });
    }
});
//# sourceMappingURL=schemas.js.map