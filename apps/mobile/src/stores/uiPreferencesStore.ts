import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TimeRange } from '../components/RangeFilterDrawer';

export type ChartType = 'Daily Volume' | 'Daily Progress' | 'Period Progress' | 'Standards Progress' | 'Cumulative Volume';
export type ThemePreference = 'light' | 'dark' | 'system';

interface UIPreferencesState {
  preferredActivityChart: ChartType;
  setPreferredActivityChart: (chart: ChartType) => void;
  themePreference: ThemePreference;
  setThemePreference: (theme: ThemePreference) => void;
  focusModeEnabled: boolean;
  setFocusModeEnabled: (enabled: boolean) => void;
  collapsedByCategoryId: Record<string, boolean>;
  setCollapsedByCategoryId: (collapsed: Record<string, boolean>) => void;
  focusedCategoryId: string | null;
  setFocusedCategoryId: (categoryId: string | null) => void;
  showTimeBar: boolean;
  setShowTimeBar: (show: boolean) => void;
  hiddenTimeBarStandardIds: string[];
  toggleTimeBarForStandard: (standardId: string) => void;
  showInactiveStandards: boolean;
  setShowInactiveStandards: (show: boolean) => void;
  scorecardTimeRange: TimeRange;
  setScorecardTimeRange: (range: TimeRange) => void;
  activityCategoryMigrationCompletedAtMs: number | null;
  setActivityCategoryMigrationCompletedAtMs: (timestamp: number | null) => void;
  activityCategoryMigrationConflictActivityIds: string[];
  setActivityCategoryMigrationConflictActivityIds: (ids: string[]) => void;
  /** Transient: set after creating a standard so the dashboard can scroll to it. Not persisted. */
  pendingScrollToStandardId: string | null;
  setPendingScrollToStandardId: (id: string | null) => void;
}

export const useUIPreferencesStore = create<UIPreferencesState>()(
  persist(
    (set) => ({
      preferredActivityChart: 'Daily Volume',
      setPreferredActivityChart: (chart) => set({ preferredActivityChart: chart }),
      themePreference: 'system',
      setThemePreference: (theme) => set({ themePreference: theme }),
      focusModeEnabled: false,
      setFocusModeEnabled: (enabled) => set({ focusModeEnabled: enabled }),
      collapsedByCategoryId: {},
      setCollapsedByCategoryId: (collapsed) => set({ collapsedByCategoryId: collapsed }),
      focusedCategoryId: null,
      setFocusedCategoryId: (categoryId) => set({ focusedCategoryId: categoryId }),
      showTimeBar: true,
      setShowTimeBar: (show) => set({ showTimeBar: show, hiddenTimeBarStandardIds: [] }),
      hiddenTimeBarStandardIds: [],
      toggleTimeBarForStandard: (standardId) => set((state) => {
        const hidden = state.hiddenTimeBarStandardIds;
        if (hidden.includes(standardId)) {
          return { hiddenTimeBarStandardIds: hidden.filter((id) => id !== standardId) };
        }
        return { hiddenTimeBarStandardIds: [...hidden, standardId] };
      }),
      showInactiveStandards: false,
      setShowInactiveStandards: (show) => set({ showInactiveStandards: show }),
      scorecardTimeRange: 'All',
      setScorecardTimeRange: (range) => set({ scorecardTimeRange: range }),
      activityCategoryMigrationCompletedAtMs: null,
      setActivityCategoryMigrationCompletedAtMs: (timestamp) => set({ activityCategoryMigrationCompletedAtMs: timestamp }),
      activityCategoryMigrationConflictActivityIds: [],
      setActivityCategoryMigrationConflictActivityIds: (ids) => set({ activityCategoryMigrationConflictActivityIds: ids }),
      pendingScrollToStandardId: null,
      setPendingScrollToStandardId: (id) => set({ pendingScrollToStandardId: id }),
    }),
    {
      name: 'ui-preferences-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => {
        const { pendingScrollToStandardId, setPendingScrollToStandardId, ...persisted } = state;
        return persisted;
      },
    }
  )
);
