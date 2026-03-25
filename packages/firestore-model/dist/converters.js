"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activityHistoryConverter = exports.dashboardPinsConverter = exports.activityLogConverter = exports.categoryConverter = exports.standardConverter = exports.activityConverter = void 0;
const firestore_1 = require("firebase/firestore");
const shared_model_1 = require("@minimum-standards/shared-model");
const timestamps_1 = require("./timestamps");
function coercePeriodStartPreference(preference) {
    if (!preference || typeof preference !== 'object') {
        return undefined;
    }
    const maybePreference = preference;
    if (maybePreference.mode === 'default') {
        return { mode: 'default' };
    }
    if (maybePreference.mode === 'weekDay' &&
        typeof maybePreference.weekStartDay === 'number') {
        const weekStartDay = maybePreference.weekStartDay;
        if (weekStartDay >= 1 && weekStartDay <= 7) {
            return {
                mode: 'weekDay',
                weekStartDay: weekStartDay,
            };
        }
    }
    return undefined;
}
function parseWith(schema, value) {
    return schema.parse(value);
}
exports.activityConverter = {
    toFirestore(model) {
        // Note: createdAt/updatedAt should be server-controlled; on write we use serverTimestamp().
        // Note: unit should already be normalized to plural form via activitySchema transform.
        return {
            name: model.name,
            unit: model.unit, // Already normalized via schema transform
            notes: model.notes,
            categoryId: model.categoryId ?? null,
            createdAt: (0, firestore_1.serverTimestamp)(),
            updatedAt: (0, firestore_1.serverTimestamp)(),
            deletedAt: model.deletedAtMs == null ? null : (0, timestamps_1.msToTimestamp)(model.deletedAtMs)
        };
    },
    fromFirestore(snapshot, options) {
        const data = snapshot.data(options);
        const parsed = parseWith(shared_model_1.activitySchema, {
            id: snapshot.id,
            name: data.name,
            unit: data.unit,
            notes: data.notes ?? null,
            categoryId: data.categoryId ?? null,
            createdAtMs: (0, timestamps_1.timestampToMs)(data.createdAt),
            updatedAtMs: (0, timestamps_1.timestampToMs)(data.updatedAt),
            deletedAtMs: data.deletedAt == null ? null : (0, timestamps_1.timestampToMs)(data.deletedAt)
        });
        return {
            ...parsed,
            notes: parsed.notes ?? null,
        };
    }
};
exports.standardConverter = {
    toFirestore(model) {
        // Ensure summary is regenerated if cadence/minimum/unit/sessionConfig changed
        const summary = (0, shared_model_1.formatStandardSummary)(model.minimum, model.unit, model.cadence, model.sessionConfig);
        return {
            activityId: model.activityId,
            minimum: model.minimum,
            unit: model.unit,
            cadence: model.cadence,
            state: model.state,
            summary: summary,
            sessionConfig: model.sessionConfig,
            ...(model.periodStartPreference && model.periodStartPreference.mode !== 'default'
                ? { periodStartPreference: model.periodStartPreference }
                : {}),
            ...(Array.isArray(model.quickAddValues) && model.quickAddValues.length > 0
                ? { quickAddValues: model.quickAddValues }
                : {}),
            archivedAt: model.archivedAtMs == null ? null : (0, timestamps_1.msToTimestamp)(model.archivedAtMs),
            createdAt: (0, firestore_1.serverTimestamp)(),
            updatedAt: (0, firestore_1.serverTimestamp)(),
            deletedAt: model.deletedAtMs == null ? null : (0, timestamps_1.msToTimestamp)(model.deletedAtMs)
        };
    },
    fromFirestore(snapshot, options) {
        const data = snapshot.data(options);
        const rawStandard = {
            id: snapshot.id,
            activityId: data.activityId,
            minimum: data.minimum,
            unit: data.unit,
            cadence: data.cadence,
            state: data.state,
            summary: data.summary,
            sessionConfig: data.sessionConfig,
            periodStartPreference: coercePeriodStartPreference(data.periodStartPreference),
            quickAddValues: Array.isArray(data.quickAddValues)
                ? data.quickAddValues.filter((value) => typeof value === 'number' && Number.isFinite(value) && value > 0)
                : undefined,
            categoryId: data.categoryId ?? null,
            archivedAtMs: data.archivedAt == null ? null : (0, timestamps_1.timestampToMs)(data.archivedAt),
            createdAtMs: (0, timestamps_1.timestampToMs)(data.createdAt),
            updatedAtMs: (0, timestamps_1.timestampToMs)(data.updatedAt),
            deletedAtMs: data.deletedAt == null ? null : (0, timestamps_1.timestampToMs)(data.deletedAt)
        };
        return parseWith(shared_model_1.standardSchema, rawStandard);
    }
};
exports.categoryConverter = {
    toFirestore(model) {
        return {
            name: model.name,
            order: model.order,
            isSystem: model.isSystem ?? false,
            createdAt: (0, firestore_1.serverTimestamp)(),
            updatedAt: (0, firestore_1.serverTimestamp)(),
            deletedAt: model.deletedAtMs == null ? null : (0, timestamps_1.msToTimestamp)(model.deletedAtMs)
        };
    },
    fromFirestore(snapshot, options) {
        const data = snapshot.data(options);
        return parseWith(shared_model_1.categorySchema, {
            id: snapshot.id,
            name: data.name,
            order: data.order,
            isSystem: data.isSystem ?? false,
            createdAtMs: (0, timestamps_1.timestampToMs)(data.createdAt),
            updatedAtMs: (0, timestamps_1.timestampToMs)(data.updatedAt),
            deletedAtMs: data.deletedAt == null ? null : (0, timestamps_1.timestampToMs)(data.deletedAt)
        });
    }
};
exports.activityLogConverter = {
    toFirestore(model) {
        return {
            standardId: model.standardId,
            value: model.value,
            occurredAt: (0, timestamps_1.msToTimestamp)(model.occurredAtMs),
            note: model.note,
            editedAt: model.editedAtMs == null ? null : (0, timestamps_1.msToTimestamp)(model.editedAtMs),
            createdAt: (0, firestore_1.serverTimestamp)(),
            updatedAt: (0, firestore_1.serverTimestamp)(),
            deletedAt: model.deletedAtMs == null ? null : (0, timestamps_1.msToTimestamp)(model.deletedAtMs)
        };
    },
    fromFirestore(snapshot, options) {
        const data = snapshot.data(options);
        return parseWith(shared_model_1.activityLogSchema, {
            id: snapshot.id,
            standardId: data.standardId,
            value: data.value,
            occurredAtMs: (0, timestamps_1.timestampToMs)(data.occurredAt),
            note: data.note ?? null,
            editedAtMs: data.editedAt == null ? null : (0, timestamps_1.timestampToMs)(data.editedAt),
            createdAtMs: (0, timestamps_1.timestampToMs)(data.createdAt),
            updatedAtMs: (0, timestamps_1.timestampToMs)(data.updatedAt),
            deletedAtMs: data.deletedAt == null ? null : (0, timestamps_1.timestampToMs)(data.deletedAt)
        });
    }
};
exports.dashboardPinsConverter = {
    toFirestore(model) {
        return {
            pinnedStandardIds: model.pinnedStandardIds,
            updatedAt: (0, firestore_1.serverTimestamp)()
        };
    },
    fromFirestore(snapshot, options) {
        const data = snapshot.data(options);
        return parseWith(shared_model_1.dashboardPinsSchema, {
            id: snapshot.id,
            pinnedStandardIds: Array.isArray(data.pinnedStandardIds)
                ? data.pinnedStandardIds
                : [],
            updatedAtMs: data.updatedAt == null ? Date.now() : (0, timestamps_1.timestampToMs)(data.updatedAt)
        });
    }
};
exports.activityHistoryConverter = {
    toFirestore(model) {
        // Note: All timestamps are stored as numbers (ms) per spec
        return {
            activityId: model.activityId,
            standardId: model.standardId,
            referenceTimestampMs: model.referenceTimestampMs,
            standardSnapshot: model.standardSnapshot,
            total: model.total,
            currentSessions: model.currentSessions,
            targetSessions: model.targetSessions,
            status: model.status,
            progressPercent: model.progressPercent,
            generatedAtMs: model.generatedAtMs,
            source: model.source,
        };
    },
    fromFirestore(snapshot, options) {
        const data = snapshot.data(options);
        const referenceTimestampMs = typeof data.referenceTimestampMs === 'number'
            ? data.referenceTimestampMs
            : data.periodStartMs;
        if (typeof referenceTimestampMs !== 'number') {
            throw new Error('[activityHistoryConverter] Document missing reference timestamp');
        }
        const normalizedSnapshot = {
            ...data.standardSnapshot,
            periodStartPreference: coercePeriodStartPreference(data.standardSnapshot?.periodStartPreference),
        };
        const rawHistoryDoc = {
            id: snapshot.id,
            activityId: data.activityId,
            standardId: data.standardId,
            referenceTimestampMs,
            periodStartMs: data.periodStartMs,
            periodEndMs: data.periodEndMs,
            periodLabel: data.periodLabel,
            periodKey: data.periodKey,
            standardSnapshot: normalizedSnapshot,
            total: data.total,
            currentSessions: data.currentSessions,
            targetSessions: data.targetSessions,
            status: data.status,
            progressPercent: data.progressPercent,
            generatedAtMs: data.generatedAtMs,
            source: data.source,
        };
        return parseWith(shared_model_1.activityHistoryDocSchema, rawHistoryDoc);
    }
};
//# sourceMappingURL=converters.js.map