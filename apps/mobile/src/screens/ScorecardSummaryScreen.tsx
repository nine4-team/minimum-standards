import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useScorecardSummary } from '../hooks/useScorecardSummary';
import type { ScorecardSection } from '../hooks/useScorecardSummary';
import { StandardSummaryCard } from '../components/ActivitySummaryCard';
import { BottomSheetMenu } from '../components/BottomSheetMenu';
import { RangeFilterDrawer } from '../components/RangeFilterDrawer';
import { ErrorBanner } from '../components/ErrorBanner';
import { useUIPreferencesStore } from '../stores/uiPreferencesStore';
import {
  CARD_LIST_GAP,
  SCREEN_PADDING,
  getScreenContainerStyle,
} from '@nine4/ui-kit';
import type { StandardSummaryCard as StandardSummaryCardData } from '../utils/scorecardSummary';

export interface ScorecardSummaryScreenProps {
  onNavigateToDetail: (standardId: string) => void;
}

export function ScorecardSummaryScreen({
  onNavigateToDetail,
}: ScorecardSummaryScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { cards, sections, loading, error } = useScorecardSummary();

  const scorecardTimeRange = useUIPreferencesStore((s) => s.scorecardTimeRange);
  const setScorecardTimeRange = useUIPreferencesStore((s) => s.setScorecardTimeRange);
  const scorecardSort = useUIPreferencesStore((s) => s.scorecardSort);
  const setScorecardSort = useUIPreferencesStore((s) => s.setScorecardSort);
  const showInactiveStandards = useUIPreferencesStore((s) => s.showInactiveStandards);
  const setShowInactiveStandards = useUIPreferencesStore((s) => s.setShowInactiveStandards);

  const [headerMenuVisible, setHeaderMenuVisible] = useState(false);
  const [rangeDrawerVisible, setRangeDrawerVisible] = useState(false);

  const renderCard = ({ item }: { item: StandardSummaryCardData }) => (
    <View style={styles.cardWrapper}>
      <StandardSummaryCard
        card={item}
        onPress={() => onNavigateToDetail(item.standardId)}
      />
    </View>
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: ScorecardSection }) => (
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionLine, { backgroundColor: theme.border.secondary }]} />
        <Text style={[styles.sectionLabel, { color: theme.text.tertiary }]}>
          {section.title}
        </Text>
        <View style={[styles.sectionLine, { backgroundColor: theme.border.secondary }]} />
      </View>
    ),
    [theme],
  );

  return (
    <View style={[styles.screen, getScreenContainerStyle(theme)]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.background.screen,
            borderBottomColor: theme.border.secondary,
            paddingTop: Math.max(insets.top, 12),
          },
        ]}
      >
        <View style={styles.headerSpacer} />
        <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
          Scorecards
        </Text>
        <TouchableOpacity
          onPress={() => setHeaderMenuVisible(true)}
          style={styles.headerMenuButton}
          accessibilityRole="button"
          accessibilityLabel="More options"
        >
          <MaterialIcons
            name="more-horiz"
            size={24}
            color={theme.text.secondary}
          />
        </TouchableOpacity>
      </View>

      <ErrorBanner error={error} />

      {loading && cards.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.activityIndicator} />
        </View>
      ) : cards.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
            No Scorecard Data
          </Text>
          <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
            Create standards and log activities to see your scorecard summary here.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.standardId}
          renderItem={renderCard}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 16 },
          ]}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      )}

      <BottomSheetMenu
        visible={headerMenuVisible}
        onRequestClose={() => setHeaderMenuVisible(false)}
        title="Options"
        items={[
          {
            key: 'sort',
            label: scorecardSort === 'alpha' ? 'Sort by Completion' : 'Sort Alphabetically',
            icon: 'sort',
            onPress: () => setScorecardSort(scorecardSort === 'alpha' ? 'completion' : 'alpha'),
          },
          {
            key: 'time-range',
            label: `Time Range: ${scorecardTimeRange}`,
            icon: 'event',
            onPress: () => setRangeDrawerVisible(true),
          },
          {
            key: 'show-inactive',
            label: showInactiveStandards
              ? 'Hide Inactive Standards'
              : 'Show Inactive Standards',
            icon: showInactiveStandards ? 'visibility-off' : 'visibility',
            onPress: () => setShowInactiveStandards(!showInactiveStandards),
          },
        ]}
      />

      <RangeFilterDrawer
        visible={rangeDrawerVisible}
        onClose={() => setRangeDrawerVisible(false)}
        selectedRange={scorecardTimeRange}
        onSelectRange={setScorecardTimeRange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    // Style from getScreenContainerStyle
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 64,
  },
  headerMenuButton: {
    width: 64,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: 4,
    opacity: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: SCREEN_PADDING,
  },
  cardWrapper: {
    marginBottom: CARD_LIST_GAP,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  sectionLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
