import { ActivityHistoryDoc, ActivityHistoryStandardSnapshot, ActivityHistorySource, PeriodWindow } from '@minimum-standards/shared-model';
import { CollectionBindings } from './collection-layout';
/**
 * Builds a deterministic document ID for activityHistory documents.
 * Format: activityId__standardId__periodStartMs
 */
export declare function buildActivityHistoryDocId(activityId: string, standardId: string, periodStartMs: number): string;
export interface WriteActivityHistoryPeriodParams {
    firestore: unknown;
    userId: string;
    activityId: string;
    standardId: string;
    window: PeriodWindow;
    standardSnapshot: ActivityHistoryStandardSnapshot;
    rollup: {
        total: number;
        currentSessions: number;
        targetSessions: number;
        status: 'Met' | 'In Progress' | 'Missed';
        progressPercent: number;
    };
    source: ActivityHistorySource;
}
export interface GetLatestHistoryForStandardParams {
    firestore: unknown;
    userId: string;
    standardId: string;
}
export interface GetActivityHistoryDocParams {
    firestore: unknown;
    userId: string;
    activityId: string;
    standardId: string;
    periodStartMs: number;
}
export interface SoftDeleteActivityHistoryDocParams {
    firestore: unknown;
    userId: string;
    activityId: string;
    standardId: string;
    periodStartMs: number;
}
export interface ListenActivityHistoryForActivityParams {
    firestore: unknown;
    userId: string;
    activityId: string;
    onNext: (docs: ActivityHistoryDoc[]) => void;
    onError?: (error: Error) => void;
}
export type Unsubscribe = () => void;
type QuerySnapshotLike = {
    empty: boolean;
    docs: Array<{
        id: string;
        data(): Record<string, unknown>;
    }>;
    forEach(callback: (doc: {
        id: string;
        data(): Record<string, unknown>;
    }) => void): void;
};
type DocumentSnapshotLike = {
    exists: boolean;
    id: string;
    data(): Record<string, unknown> | undefined;
};
export type ActivityHistoryFirestoreBindings = CollectionBindings & {
    query: (...args: unknown[]) => unknown;
    where: (...args: unknown[]) => unknown;
    orderBy: (...args: unknown[]) => unknown;
    limit: (...args: unknown[]) => unknown;
    getDocs: (queryRef: unknown) => Promise<QuerySnapshotLike>;
    getDoc: (docRef: unknown) => Promise<DocumentSnapshotLike>;
    setDoc: (docRef: unknown, data: ActivityHistoryDoc, options?: {
        merge?: boolean;
    }) => Promise<void>;
    onSnapshot: (queryRef: unknown, onNext: (snapshot: QuerySnapshotLike) => void, onError?: (error: Error) => void) => Unsubscribe;
};
export declare function createActivityHistoryHelpers(bindings: ActivityHistoryFirestoreBindings): {
    writeActivityHistoryPeriod: (params: WriteActivityHistoryPeriodParams) => Promise<void>;
    getActivityHistoryDoc: (params: GetActivityHistoryDocParams) => Promise<ActivityHistoryDoc | null>;
    softDeleteActivityHistoryDoc: (params: SoftDeleteActivityHistoryDocParams) => Promise<void>;
    getLatestHistoryForStandard: (params: GetLatestHistoryForStandardParams) => Promise<ActivityHistoryDoc | null>;
    listenActivityHistoryForActivity: (params: ListenActivityHistoryForActivityParams) => Unsubscribe;
};
export {};
