import { Standard } from '@minimum-standards/shared-model';
import { recomputeActivityHistoryPeriod } from '../utils/activityHistoryRecompute';

export interface ReconcileActivityHistoryInput {
  userId: string;
  standard: Standard;
  occurredAtMs: number;
  previousStandard?: Standard;
}

export interface ActivityHistoryReconciliationService {
  reconcilePeriod(input: ReconcileActivityHistoryInput): Promise<void>;
}

export const activityHistoryReconciliationService: ActivityHistoryReconciliationService = {
  reconcilePeriod: recomputeActivityHistoryPeriod,
};
