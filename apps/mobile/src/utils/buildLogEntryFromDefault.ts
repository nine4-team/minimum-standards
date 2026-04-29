import type { Standard } from '@minimum-standards/shared-model';
import type { CreateLogInput } from '../hooks/useStandards';

/**
 * Build the payload for a one-tap quick-log from a standard's defaultQuantity.
 *
 * Returns null when the standard has no positive defaultQuantity. Pure: no
 * I/O, no side effects, safe to unit-test.
 */
export function buildLogEntryFromDefault(
  standard: Pick<Standard, 'id' | 'defaultQuantity'>,
  nowMs: number,
): CreateLogInput | null {
  const quantity = standard.defaultQuantity;
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }
  return {
    standardId: standard.id,
    value: quantity,
    occurredAtMs: nowMs,
    note: null,
  };
}
