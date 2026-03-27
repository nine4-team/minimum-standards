"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildActivityHistoryDocId = buildActivityHistoryDocId;
exports.createActivityHistoryHelpers = createActivityHistoryHelpers;
const collection_layout_1 = require("./collection-layout");
/**
 * Builds a deterministic document ID for activityHistory documents.
 * Format: standardId__periodStartMs
 */
function buildActivityHistoryDocId(standardId, periodStartMs) {
    return `${standardId}__${periodStartMs}`;
}
function toActivityHistoryDoc(docId, data) {
    if (!data ||
        typeof data.standardId !== 'string' ||
        !data.standardSnapshot ||
        typeof data.total !== 'number' ||
        typeof data.currentSessions !== 'number' ||
        typeof data.targetSessions !== 'number' ||
        typeof data.status !== 'string' ||
        typeof data.progressPercent !== 'number') {
        return null;
    }
    const referenceTimestamp = typeof data.referenceTimestampMs === 'number'
        ? data.referenceTimestampMs
        : typeof data.periodStartMs === 'number'
            ? data.periodStartMs
            : null;
    if (referenceTimestamp == null) {
        return null;
    }
    return {
        id: docId,
        standardId: data.standardId,
        ...(data.activityId ? { activityId: data.activityId } : {}),
        referenceTimestampMs: referenceTimestamp,
        periodStartMs: typeof data.periodStartMs === 'number' ? data.periodStartMs : undefined,
        periodEndMs: typeof data.periodEndMs === 'number' ? data.periodEndMs : undefined,
        periodLabel: typeof data.periodLabel === 'string' ? data.periodLabel : undefined,
        periodKey: typeof data.periodKey === 'string' ? data.periodKey : undefined,
        standardSnapshot: data.standardSnapshot,
        total: data.total,
        currentSessions: data.currentSessions,
        targetSessions: data.targetSessions,
        status: data.status,
        progressPercent: data.progressPercent,
        generatedAtMs: data.generatedAtMs ?? Date.now(),
        source: data.source ?? 'boundary',
        deletedAtMs: data.deletedAtMs ?? null,
    };
}
function createActivityHistoryHelpers(bindings) {
    const { collection, doc, query, where, orderBy, limit, getDocs, getDoc, setDoc, onSnapshot, } = bindings;
    async function writeActivityHistoryPeriod(params) {
        const { firestore, userId, standardId, window, standardSnapshot, rollup, source, } = params;
        const collections = (0, collection_layout_1.getUserScopedCollections)({
            firestore,
            userId,
            bindings: { collection, doc },
        });
        const docId = buildActivityHistoryDocId(standardId, window.startMs);
        const docRef = doc(collections.activityHistory, docId);
        const payload = {
            id: docId,
            standardId,
            referenceTimestampMs: window.startMs,
            standardSnapshot,
            total: rollup.total,
            currentSessions: rollup.currentSessions,
            targetSessions: rollup.targetSessions,
            status: rollup.status,
            progressPercent: rollup.progressPercent,
            generatedAtMs: Date.now(),
            source,
            deletedAtMs: null,
        };
        // We do not use { merge: true } here because we want to ensure the document
        // exactly matches our payload, satisfying the strict hasOnlyKeys rules.
        // Overwriting is safe because we compute the complete rollup for the period.
        await setDoc(docRef, payload);
    }
    async function getActivityHistoryDoc(params) {
        const { firestore, userId, standardId, periodStartMs } = params;
        const collections = (0, collection_layout_1.getUserScopedCollections)({
            firestore,
            userId,
            bindings: { collection, doc },
        });
        const docId = buildActivityHistoryDocId(standardId, periodStartMs);
        const docRef = doc(collections.activityHistory, docId);
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists) {
            return null;
        }
        const raw = snapshot.data();
        if (!raw) {
            return null;
        }
        return toActivityHistoryDoc(docId, raw);
    }
    async function softDeleteActivityHistoryDoc(params) {
        const { firestore, userId, standardId, periodStartMs } = params;
        const existing = await getActivityHistoryDoc({
            firestore,
            userId,
            standardId,
            periodStartMs,
        });
        if (!existing) {
            return; // Nothing to soft-delete
        }
        const collections = (0, collection_layout_1.getUserScopedCollections)({
            firestore,
            userId,
            bindings: { collection, doc },
        });
        const docId = buildActivityHistoryDocId(standardId, periodStartMs);
        const docRef = doc(collections.activityHistory, docId);
        // Clean the standardSnapshot to only include fields allowed by Firestore rules.
        // Old docs may have extra fields (e.g., state, quickAddValues) that fail hasOnly.
        const { minimum, unit, cadence, sessionConfig, summary, periodStartPreference } = existing.standardSnapshot;
        const cleanSnapshot = {
            minimum,
            unit,
            cadence,
            sessionConfig,
            ...(summary !== undefined ? { summary } : {}),
            ...(periodStartPreference !== undefined ? { periodStartPreference } : {}),
        };
        const payload = {
            ...existing,
            standardSnapshot: cleanSnapshot,
            deletedAtMs: Date.now(),
            generatedAtMs: Date.now(),
        };
        // Strip undefined values — Firestore rejects them
        const cleanPayload = Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined));
        await setDoc(docRef, cleanPayload);
    }
    async function getLatestHistoryForStandard(params) {
        // Runtime validation to catch stale bundle issues early
        // If params is not an object or missing required fields, this indicates a stale bundle
        // or incorrect call signature (positional instead of object parameter)
        if (!params || typeof params !== 'object' || Array.isArray(params)) {
            throw new Error('[getLatestHistoryForStandard] Invalid parameter: expected object with { firestore, userId, standardId }. ' +
                'This error usually indicates a stale JS bundle. ' +
                'See troubleshooting/activity-history-engine-call-error.md for resolution steps.');
        }
        const { firestore, userId, standardId } = params;
        if (!firestore) {
            throw new Error('[getLatestHistoryForStandard] firestore is required but was undefined. ' +
                'This usually indicates a stale JS bundle calling the function with positional arguments. ' +
                'See troubleshooting/activity-history-engine-call-error.md for resolution steps.');
        }
        if (!userId || typeof userId !== 'string') {
            throw new Error(`[getLatestHistoryForStandard] userId is required and must be a string, got: ${typeof userId}. ` +
                'This may indicate a stale bundle. See troubleshooting/activity-history-engine-call-error.md');
        }
        if (!standardId || typeof standardId !== 'string') {
            throw new Error(`[getLatestHistoryForStandard] standardId is required and must be a string, got: ${typeof standardId}. ` +
                'This may indicate a stale bundle. See troubleshooting/activity-history-engine-call-error.md');
        }
        const collections = (0, collection_layout_1.getUserScopedCollections)({
            firestore,
            userId,
            bindings: { collection, doc },
        });
        // Fetch a few extra to client-side filter soft-deleted docs
        const historyQuery = query(collections.activityHistory, where('standardId', '==', standardId), orderBy('referenceTimestampMs', 'desc'), limit(5));
        const snapshot = await getDocs(historyQuery);
        if (snapshot.empty) {
            return null;
        }
        for (const docSnap of snapshot.docs) {
            const raw = docSnap.data();
            if (raw.deletedAtMs) {
                continue; // skip soft-deleted
            }
            return toActivityHistoryDoc(docSnap.id, raw);
        }
        return null;
    }
    function listenActivityHistoryForStandard(params) {
        const { firestore, userId, standardId, onNext, onError } = params;
        const collections = (0, collection_layout_1.getUserScopedCollections)({
            firestore,
            userId,
            bindings: { collection, doc },
        });
        const historyQuery = query(collections.activityHistory, where('standardId', '==', standardId), orderBy('referenceTimestampMs', 'desc'));
        return onSnapshot(historyQuery, (snapshot) => {
            const docs = [];
            snapshot.forEach((docSnap) => {
                const raw = docSnap.data();
                if (raw.deletedAtMs) {
                    return; // skip soft-deleted
                }
                const parsed = toActivityHistoryDoc(docSnap.id, raw);
                if (parsed) {
                    docs.push(parsed);
                }
            });
            onNext(docs);
        }, (error) => {
            if (onError) {
                onError(error);
            }
        });
    }
    return {
        writeActivityHistoryPeriod,
        getActivityHistoryDoc,
        softDeleteActivityHistoryDoc,
        getLatestHistoryForStandard,
        listenActivityHistoryForStandard,
    };
}
//# sourceMappingURL=activity-history-helpers.js.map