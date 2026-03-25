"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculatePeriodWindow = calculatePeriodWindow;
exports.derivePeriodStatus = derivePeriodStatus;
const luxon_1 = require("luxon");
const types_1 = require("./types");
const LABEL_LOCALE = 'en-US';
const formatLabel = (dt, format) => dt.setLocale(LABEL_LOCALE).toFormat(format);
function createDayWindow(start, interval) {
    const end = start.plus({ days: interval });
    const inclusiveEnd = end.minus({ days: 1 });
    return {
        startMs: start.toMillis(),
        endMs: end.toMillis(),
        periodKey: start.toFormat('yyyy-LL-dd'),
        label: interval === 1
            ? formatLabel(start, 'MMM d')
            : `${formatLabel(start, 'MMM d')} - ${formatLabel(inclusiveEnd, 'MMM d')}`,
    };
}
function createWeekWindow(start, interval) {
    const end = start.plus({ weeks: interval });
    const inclusiveEnd = end.minus({ days: 1 });
    return {
        startMs: start.toMillis(),
        endMs: end.toMillis(),
        periodKey: start.toFormat('yyyy-LL-dd'),
        label: `${formatLabel(start, 'MMM d')} - ${formatLabel(inclusiveEnd, 'MMM d')}`,
    };
}
function createMonthWindow(start, interval) {
    const end = start.plus({ months: interval });
    const inclusiveEnd = end.minus({ days: 1 });
    return {
        startMs: start.toMillis(),
        endMs: end.toMillis(),
        periodKey: start.toFormat('yyyy-LL'),
        label: interval === 1
            ? formatLabel(start, 'MMM')
            : `${formatLabel(start, 'MMM')} - ${formatLabel(inclusiveEnd, 'MMM')}`,
    };
}
function buildWindowFromStart(start, cadence) {
    switch (cadence.unit) {
        case 'day':
            return createDayWindow(start.startOf('day'), cadence.interval);
        case 'week':
            return createWeekWindow(start.startOf('day'), cadence.interval);
        case 'month':
            return createMonthWindow(start.startOf('month'), cadence.interval);
        default:
            throw new Error(`Unsupported cadence unit: ${cadence.unit}`);
    }
}
function calculateDefaultWindow(reference, cadence) {
    const { interval, unit } = cadence;
    if (unit === 'day') {
        return createDayWindow(reference.startOf('day'), interval);
    }
    if (unit === 'week') {
        const weekday = reference.weekday; // Monday = 1, Sunday = 7
        const daysToMonday = weekday === 1 ? 0 : weekday === 7 ? 6 : weekday - 1;
        const start = reference.minus({ days: daysToMonday }).startOf('day');
        return createWeekWindow(start, interval);
    }
    if (unit === 'month') {
        const monthStart = reference.startOf('month');
        return createMonthWindow(monthStart, interval);
    }
    throw new Error(`Unsupported cadence unit: ${unit}`);
}
function getCadenceDuration(cadence) {
    switch (cadence.unit) {
        case 'day':
            return { days: cadence.interval };
        case 'week':
            return { weeks: cadence.interval };
        case 'month':
            return { months: cadence.interval };
        default:
            throw new Error(`Unsupported cadence unit: ${cadence.unit}`);
    }
}
/**
 * Calculates the period window for a given timestamp, cadence, timezone, and optional period start preference.
 *
 * @param timestampMs - The timestamp in milliseconds
 * @param cadence - The cadence object with interval and unit
 * @param timezone - IANA timezone identifier (e.g., 'America/New_York')
 * @param options - Optional settings including period start preference
 * @returns Period window with start (inclusive), end (exclusive), period key, and label
 */
function calculatePeriodWindow(timestampMs, cadence, timezone, options) {
    const zoned = luxon_1.DateTime.fromMillis(timestampMs, { zone: timezone });
    if (!zoned.isValid) {
        throw new Error(`Invalid timestamp or timezone provided: ${zoned.invalidReason}`);
    }
    const preference = options?.periodStartPreference ?? types_1.DEFAULT_PERIOD_START_PREFERENCE;
    if (preference.mode === 'weekDay' && cadence.unit === 'week') {
        const weekStartDay = preference.weekStartDay;
        const startOfDay = zoned.startOf('day');
        const offset = (startOfDay.weekday - weekStartDay + 7) % 7;
        const alignedStart = startOfDay.minus({ days: offset });
        return createWeekWindow(alignedStart, cadence.interval);
    }
    return calculateDefaultWindow(zoned, cadence);
}
/**
 * Derives the period status from period totals and boundaries.
 *
 * @param periodTotal - The total value for the period
 * @param minimum - The minimum required value
 * @param nowMs - Current timestamp in milliseconds
 * @param periodEndMs - Period end boundary (exclusive) in milliseconds
 * @returns Period status: 'Met', 'In Progress', or 'Missed'
 */
function derivePeriodStatus(periodTotal, minimum, nowMs, periodEndMs) {
    if (periodTotal >= minimum) {
        return 'Met';
    }
    if (nowMs >= periodEndMs) {
        return 'Missed';
    }
    return 'In Progress';
}
//# sourceMappingURL=period-calculator.js.map