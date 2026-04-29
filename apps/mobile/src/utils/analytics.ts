/**
 * Central registry of analytics events emitted by the Standards flows.
 *
 * dashboard_log_tap — User tapped Log from the dashboard (payload: standardId, activityId)
 * standard_detail_view — User viewed standard detail screen (payload: standardId, activityId)
 * standard_detail_period_tap — User tapped a period row in history (payload: standardId, periodLabel)
 * standard_detail_log_tap — User tapped Log button from detail screen (payload: standardId, activityId)
 * standard_detail_edit_tap — User tapped Edit button from detail screen (payload: standardId, activityId)
 * standard_detail_archive_tap — User tapped Archive/Unarchive button from detail screen (payload: standardId, activityId, action: 'archive' | 'unarchive')
 */
type StandardAnalyticsEvent =
  | 'standard_create'
  | 'standard_edit'
  | 'standard_archive'
  | 'standard_unarchive'
  | 'standard_archive_toggle'
  | 'dashboard_log_tap'
  | 'dashboard_quick_log'
  | 'standard_detail_view'
  | 'standard_detail_period_tap'
  | 'standard_detail_log_tap'
  | 'standard_detail_edit_tap'
  | 'standard_detail_archive_tap'
  | 'activity_history_chart_selected'
  | 'activity_history_chart_bar_tap'
  | 'activity_history_chart_tooltip_action';

type EventPayload = Record<string, unknown>;

/**
 * Temporary analytics shim so we can instrument events without
 * wiring a full analytics provider during the MVP.
 */
export function trackStandardEvent(
  event: StandardAnalyticsEvent,
  payload: EventPayload = {}
) {
  console.log(`[analytics] ${event}`, payload);
}
