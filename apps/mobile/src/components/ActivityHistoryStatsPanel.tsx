import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TouchableWithoutFeedback } from 'react-native';
import { useTheme } from '../theme/useTheme';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { CARD_PADDING } from '@nine4/ui-kit';

export interface ActivityHistoryStatsPanelProps {
  activityName: string;
  totalValue: string;
  unit: string;
  percentMet: number;
  countMet: string;
  standardChange: string;
  standardHistory?: number[];
  isLoading?: boolean;
  hasData?: boolean;
}

export function ActivityHistoryStatsPanel({
  activityName,
  totalValue,
  unit,
  percentMet,
  countMet,
  standardChange,
  standardHistory = [],
  isLoading = false,
  hasData = true,
}: ActivityHistoryStatsPanelProps) {
  const theme = useTheme();
  const [helpContent, setHelpContent] = useState<{ title: string; description: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const showHelp = (title: string, description: string) => {
    setHelpContent({ title, description });
  };

  const handleStandardPress = () => {
    if (standardHistory.length > 2) {
      setShowHistory(true);
    } else {
      showHelp('Standard Change', 'Evolution of your minimum standard from start to now.');
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background.surface, borderColor: theme.border.secondary }]}>
        <View style={[styles.activityHeader, { borderBottomColor: theme.border.secondary }]}>
          <Text style={[styles.activityName, { color: theme.text.primary }]}>{activityName}</Text>
          {!!unit && (
            <Text style={[styles.activityUnit, { color: theme.text.secondary }]}>{unit}</Text>
          )}
        </View>
        <View style={styles.gridContent}>
          {[1, 2].map((i) => (
            <View key={i} style={styles.skeletonItem}>
              <View style={[styles.skeletonLabel, { backgroundColor: theme.background.tertiary }]} />
              <View style={[styles.skeletonValue, { backgroundColor: theme.background.tertiary }]} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (!hasData) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.background.surface,
            borderColor: theme.border.secondary,
          },
        ]}
      >
        <View style={[styles.activityHeader, { borderBottomColor: theme.border.secondary }]}>
          <Text style={[styles.activityName, { color: theme.text.primary }]}>{activityName}</Text>
          {!!unit && (
            <Text style={[styles.activityUnit, { color: theme.text.secondary }]}>{unit}</Text>
          )}
        </View>
        <View style={styles.emptyContent}>
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
            Start logging to see trends
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.background.surface,
          borderColor: theme.border.secondary,
        },
      ]}
    >
      <View style={[styles.activityHeader, { borderBottomColor: theme.border.secondary }]}>
        <Text style={[styles.activityName, { color: theme.text.primary }]}>{activityName}</Text>
        {!!unit && (
          <Text style={[styles.activityUnit, { color: theme.text.secondary }]}>{unit}</Text>
        )}
      </View>
      <View style={styles.gridContent}>
        <StatItem
          label={`Total ${unit}`}
          value={totalValue}
          valueColor={theme.status.met.text}
          onHelp={() => showHelp(`Total ${unit}`, `Sum of all logs for this activity in the selected range.`)}
        />
        <StatItem
          label="% Met"
          value={`${percentMet}%`}
          valueColor={percentMet >= 90 ? theme.status.met.barComplete : theme.status.met.text}
          onHelp={() => showHelp('% Met', 'Percentage of periods where the minimum standard was achieved. In-progress periods are excluded.')}
        />
        {/* 
        <StatItem
          label="Count Met"
          value={countMet}
          onHelp={() => showHelp('Count Met', 'The number of periods met vs total completed periods in view.')}
        />
        <StatItem
          label="Standard Change"
          value={standardChange === 'No changes yet' ? 'No changes' : standardChange}
          onHelp={() => showHelp('Standard Change', standardChange === 'No changes yet' ? 'Your minimum standard has not changed since you started tracking this activity.' : 'Evolution of your minimum standard from start to now.')}
          onPress={standardChange !== 'No changes yet' ? handleStandardPress : undefined}
          hasMore={standardHistory.length > 2}
        />
        */}
      </View>

      {/* Help Modal */}
      <Modal
        visible={!!helpContent}
        transparent
        animationType="fade"
        onRequestClose={() => setHelpContent(null)}
      >
        <TouchableWithoutFeedback onPress={() => setHelpContent(null)}>
          <View style={[styles.modalOverlay, { backgroundColor: theme.background.overlay }]}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { backgroundColor: theme.background.surface }]}>
                <Text style={[styles.modalTitle, { color: theme.text.primary }]}>{helpContent?.title}</Text>
                <Text style={[styles.modalDescription, { color: theme.text.secondary }]}>
                  {helpContent?.description}
                </Text>
                <TouchableOpacity
                  style={[styles.modalCloseButton, { backgroundColor: theme.primary.main }]}
                  onPress={() => setHelpContent(null)}
                >
                  <Text style={styles.modalCloseButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Standard History Modal */}
      <Modal
        visible={showHistory}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHistory(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowHistory(false)}>
          <View style={[styles.modalOverlay, { backgroundColor: theme.background.overlay }]}>
            <TouchableWithoutFeedback>
              <View style={[styles.historyModalContent, { backgroundColor: theme.background.surface }]}>
                <View style={styles.historyHeader}>
                  <Text style={[styles.modalTitle, { color: theme.text.primary }]}>Standard History</Text>
                  <TouchableOpacity onPress={() => setShowHistory(false)}>
                    <MaterialIcon name="close" size={24} color={theme.text.primary} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.historyList}>
                  {standardHistory.map((val, i) => (
                    <View key={i} style={[styles.historyItem, { borderBottomColor: theme.border.secondary }]}>
                      <Text style={[styles.historyStep, { color: theme.text.tertiary }]}>
                        Step {standardHistory.length - i}
                      </Text>
                      <Text style={[styles.historyValue, { color: theme.text.primary }]}>
                        {val} {unit}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

function StatItem({
  label,
  value,
  onHelp,
  onPress,
  hasMore,
  badge,
  valueColor,
}: {
  label: string;
  value: string;
  onHelp: () => void;
  onPress?: () => void;
  hasMore?: boolean;
  badge?: string;
  valueColor?: string;
}) {
  const theme = useTheme();
  return (
    <TouchableOpacity
      style={styles.statItem}
      onPress={onPress}
      disabled={!onPress && !onHelp}
      activeOpacity={0.7}
    >
      <View style={styles.labelRow}>
        <Text style={[styles.statLabel, { color: theme.text.secondary }]} numberOfLines={1}>
          {label}
        </Text>
        <TouchableOpacity onPress={onHelp} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialIcon name="help-outline" size={12} color={theme.text.tertiary} style={styles.helpIcon} />
        </TouchableOpacity>
      </View>
      <View style={styles.valueRow}>
        <Text style={[styles.statValue, { color: valueColor || theme.text.primary }]} numberOfLines={1}>
          {value}
        </Text>
        {hasMore && (
          <MaterialIcon name="chevron-right" size={16} color={theme.text.tertiary} />
        )}
      </View>
      {badge && (
        <View style={[styles.badge, { backgroundColor: theme.background.tertiary }]}>
          <Text style={[styles.badgeText, { color: theme.text.tertiary }]}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 0,
    overflow: 'hidden',
  },
  activityHeader: {
    paddingHorizontal: CARD_PADDING,
    paddingTop: CARD_PADDING,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'column',
    gap: 2,
  },
  activityName: {
    fontSize: 18,
    fontWeight: '700',
  },
  activityUnit: {
    fontSize: 14,
  },
  gridContent: {
    padding: CARD_PADDING,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    width: '50%',
    paddingBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  helpIcon: {
    marginLeft: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  historyModalContent: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalCloseButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalCloseButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  historyList: {
    flexGrow: 0,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyStep: {
    fontSize: 14,
    fontWeight: '500',
  },
  historyValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  skeletonItem: {
    width: '50%',
    paddingBottom: 16,
  },
  skeletonLabel: {
    width: 60,
    height: 14,
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonValue: {
    width: 80,
    height: 28,
    borderRadius: 4,
  },
  emptyContent: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  badge: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
