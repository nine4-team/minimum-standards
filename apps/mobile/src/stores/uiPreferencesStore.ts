import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TimeRange } from '../components/RangeFilterDrawer';

export type ChartType = 'Daily Volume' | 'Daily Progress' | 'Period Progress' | 'Standards Progress' | 'Cumulative Volume';
export type ThemePreference = 'light' | 'dark' | 'system';
export type ScorecardSort = 'alpha' | 'completion' | 'manual';

interface UIPreferencesState {
  preferredActivityChart: ChartType;
  setPreferredActivityChart: (chart: ChartType) => void;
  themePreference: ThemePreference;
  setThemePreference: (theme: ThemePreference) => void;
  focusModeEnabled: boolean;
  setFocusModeEnabled: (enabled: boolean) => void;
  showInactiveStandards: boolean;
  setShowInactiveStandards: (show: boolean) => void;
  standardsSort: ScorecardSort;
  setStandardsSort: (sort: ScorecardSort) => void;
  scorecardSort: ScorecardSort;
  setScorecardSort: (sort: ScorecardSort) => void;
  scorecardTimeRange: TimeRange;
  setScorecardTimeRange: (range: TimeRange) => void;
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
      showInactiveStandards: false,
      setShowInactiveStandards: (show) => set({ showInactiveStandards: show }),
      standardsSort: 'completion',
      setStandardsSort: (sort) => set({ standardsSort: sort }),
      scorecardSort: 'alpha',
      setScorecardSort: (sort) => set({ scorecardSort: sort }),
      scorecardTimeRange: 'All',
      setScorecardTimeRange: (range) => set({ scorecardTimeRange: range }),
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
