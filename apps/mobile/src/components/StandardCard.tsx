import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Standard, formatUnitWithCount } from '@minimum-standards/shared-model';
import { useTheme } from '../theme/useTheme';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { getCardBorderStyle, getCardBaseStyle } from '@nine4/ui-kit';
import { BottomSheetMenu } from './BottomSheetMenu';

export function StandardCard({
  standard,
  onSelect,
  onArchive,
  onActivate,
  onEdit,
  onDelete,
  activityNameMap,
  onSelectStandard,
  showActions = true,
}: {
  standard: Standard;
  onSelect?: () => void;
  onArchive?: () => void;
  onActivate?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  activityNameMap?: Map<string, string>; // deprecated - no longer used
  onSelectStandard?: (standard: Standard) => void;
  showActions?: boolean;
}) {
  const theme = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  const isActive = standard.state === 'active' && standard.archivedAtMs === null;

  const activityName = standard.name;

  // Format volume/period: "1800 minutes / week" (derive from standard data)
  const { interval, unit: cadenceUnit } = standard.cadence;
  const cadenceStr = interval === 1 ? cadenceUnit : `${interval} ${cadenceUnit}s`;
  const minimumUnitText = formatUnitWithCount(standard.unit, standard.minimum);
  const volumePeriodText = `${standard.minimum} ${minimumUnitText} / ${cadenceStr}`;

  // Format session params: "5 sessions × 15 minutes" (only show if sessionsPerCadence > 1)
  const sessionConfig = standard.sessionConfig;
  const usesSessions = sessionConfig.sessionsPerCadence > 1;
  let sessionParamsText: string | null = null;
  if (usesSessions) {
    const sessionLabelPlural = `${sessionConfig.sessionLabel}s`;
    const sessionVolumeUnit = formatUnitWithCount(standard.unit, sessionConfig.volumePerSession);
    sessionParamsText = `${sessionConfig.sessionsPerCadence} ${sessionLabelPlural} × ${sessionConfig.volumePerSession} ${sessionVolumeUnit}`;
  }

  const handleToggle = useCallback((e: any) => {
    e.stopPropagation();
    if (isActive) {
      onArchive?.();
    } else {
      onActivate?.();
    }
  }, [isActive, onArchive, onActivate]);

  const handleMenuPress = useCallback((e: any) => {
    e.stopPropagation();
    setMenuVisible(true);
  }, []);

  const handleEditPress = useCallback(() => {
    setMenuVisible(false);
    onEdit?.();
  }, [onEdit]);

  const handleDeletePress = useCallback(() => {
    setMenuVisible(false);
    onDelete?.();
  }, [onDelete]);

  return (
    <>
      <TouchableOpacity
        style={[
          localStyles.card,
          getCardBaseStyle({ radius: 16 }),
          getCardBorderStyle(theme),
          {
            backgroundColor: theme.background.card,
            shadowColor: theme.shadow,
          },
        ]}
        onPress={onSelect ?? (() => onSelectStandard?.(standard))}
        activeOpacity={onSelect ? 0.7 : 1}
        accessibilityRole={onSelect ? 'button' : undefined}
        accessibilityLabel={onSelect ? `Edit ${activityName} standard` : undefined}
      >
        <View style={[localStyles.cardContent, { opacity: isActive ? 1 : 0.6 }]}>
          <View style={localStyles.cardHeader}>
            <View style={localStyles.titleBlock}>
              <Text style={[localStyles.activityName, { color: theme.text.primary }]} numberOfLines={1}>
                {activityName}
              </Text>
              <Text style={[localStyles.volumePeriodText, { color: theme.text.secondary }]} numberOfLines={1}>
                {volumePeriodText}
              </Text>
              {sessionParamsText !== null && (
                <Text style={[localStyles.sessionParamsText, { color: theme.text.secondary }]} numberOfLines={1}>
                  {sessionParamsText}
                </Text>
              )}
            </View>
            <View style={localStyles.headerActions}>
              <View style={localStyles.actionButtonsRow}>
                {showActions && (
                  <>
                    <TouchableOpacity
                      onPress={handleToggle}
                      style={localStyles.toggleContainer}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: isActive }}
                      accessibilityLabel={isActive ? `Deactivate ${activityName}` : `Activate ${activityName}`}
                    >
                      <View style={[localStyles.toggle, { backgroundColor: isActive ? theme.button.primary.background : theme.input.border }]}>
                        <View style={[localStyles.toggleThumb, { backgroundColor: theme.background.primary, transform: [{ translateX: isActive ? 20 : 0 }] }]} />
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleMenuPress} style={localStyles.menuButton} accessibilityRole="button" accessibilityLabel={`More options for ${activityName}`}>
                      <MaterialIcons name="more-horiz" size={20} color={theme.text.secondary} />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {showActions && (
        <BottomSheetMenu
          visible={menuVisible}
          onRequestClose={() => setMenuVisible(false)}
          title={activityName}
          items={[
            {
              key: 'edit',
              label: 'Edit',
              icon: 'edit',
              onPress: handleEditPress,
            },
            {
              key: 'delete',
              label: 'Delete',
              icon: 'delete',
              destructive: true,
              onPress: handleDeletePress,
            },
          ]}
        />
      )}
    </>
  );
}

const localStyles = StyleSheet.create({
  card: {
    padding: 0,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardContent: { gap: 0 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  titleBlock: { flex: 1, gap: 6 },
  activityName: { fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
  volumePeriodText: { fontSize: 14, fontWeight: '500' },
  sessionParamsText: { fontSize: 13 },
  headerActions: { alignItems: 'flex-end', justifyContent: 'flex-start' },
  actionButtonsRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  toggleContainer: { alignItems: 'center', justifyContent: 'center' },
  toggle: { width: 50, height: 30, borderRadius: 15, padding: 2, justifyContent: 'center' },
  toggleThumb: { width: 26, height: 26, borderRadius: 13, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  menuButton: { padding: 6, alignItems: 'center', justifyContent: 'center', minWidth: 32, minHeight: 32 },
});

