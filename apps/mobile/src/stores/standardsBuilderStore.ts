import { create } from 'zustand';
import {
  Standard,
  PeriodStartPreference,
  StandardCadence,
  formatStandardSummary,
  StandardSessionConfig,
} from '@minimum-standards/shared-model';

export interface StandardsBuilderState {
  // Standard identity fields (formerly on Activity)
  name: string;
  setName: (name: string) => void;
  unit: string;
  setUnit: (unit: string) => void;
  notes: string | null;
  setNotes: (notes: string | null) => void;

  // Cadence configuration
  cadence: StandardCadence | null;
  setCadence: (cadence: StandardCadence | null) => void;

  // Goal: Total per period (what user enters)
  goalTotal: number | null;
  setGoalTotal: (goalTotal: number | null) => void;
  unitOverride: string | null; // Override for unit (null means use the entered unit)
  setUnitOverride: (unit: string | null) => void;

  // Breakdown configuration (session-based mode)
  breakdownEnabled: boolean;
  setBreakdownEnabled: (enabled: boolean) => void;
  sessionLabel: string;
  setSessionLabel: (label: string) => void;
  sessionsPerCadence: number | null;
  setSessionsPerCadence: (sessions: number | null) => void;
  volumePerSession: number | null;
  setVolumePerSession: (volume: number | null) => void;

  // Period alignment preference
  periodStartPreference: PeriodStartPreference | null;
  setPeriodStartPreference: (preference: PeriodStartPreference | null) => void;

  // Editing mode (non-null when editing an existing standard)
  editingStandardId: string | null;

  // Reset store
  reset: () => void;

  // Load from existing standard (for Edit mode)
  loadFromStandard: (standard: Standard) => void;

  // Get the effective unit (entered unit or override)
  getEffectiveUnit: () => string | null;

  // Get summary preview (computed)
  getSummaryPreview: () => string | null;

  // Generate payload for Firestore
  generatePayload: () => {
    name: string;
    notes: string | null;
    minimum: number;
    unit: string;
    cadence: StandardCadence;
    summary: string;
    sessionConfig: StandardSessionConfig;
    periodStartPreference?: PeriodStartPreference;
  } | null;
}

const defaultWeeklyCadence: StandardCadence = {
  interval: 1,
  unit: 'week',
};

const initialState = {
  name: '',
  unit: '',
  notes: null as string | null,
  cadence: defaultWeeklyCadence,
  goalTotal: null,
  unitOverride: null,
  breakdownEnabled: false,
  sessionLabel: 'session',
  sessionsPerCadence: null,
  volumePerSession: null,
  periodStartPreference: null,
  editingStandardId: null,
};

type SessionGoalInputs = Pick<
  StandardsBuilderState,
  'breakdownEnabled' | 'sessionsPerCadence' | 'volumePerSession'
>;

export const useStandardsBuilderStore = create<StandardsBuilderState>((set, get) => {
  const recalculateGoalTotal = (overrides: Partial<SessionGoalInputs> = {}) => {
    const currentState = get();
    const breakdownEnabled =
      overrides.breakdownEnabled ?? currentState.breakdownEnabled;
    const sessionsPerCadence =
      overrides.sessionsPerCadence ?? currentState.sessionsPerCadence;
    const volumePerSession =
      overrides.volumePerSession ?? currentState.volumePerSession;

    if (!breakdownEnabled) {
      return;
    }

    if (
      sessionsPerCadence !== null &&
      volumePerSession !== null &&
      sessionsPerCadence > 0 &&
      volumePerSession > 0
    ) {
      set({ goalTotal: sessionsPerCadence * volumePerSession });
    } else {
      set({ goalTotal: null });
    }
  };

  return {
    ...initialState,

    setPeriodStartPreference: (preference) => {
      set({ periodStartPreference: preference });
    },

  setName: (name) => {
    set({ name });
  },

  setUnit: (unit) => {
    set({ unit, unitOverride: null });
  },

  setNotes: (notes) => {
    set({ notes });
  },

  setCadence: (cadence) => {
    set({ cadence });
  },

  setGoalTotal: (goalTotal) => {
    set({ goalTotal });
  },

  setUnitOverride: (unitOverride) => {
    set({ unitOverride: unitOverride ? unitOverride.toLowerCase() : null });
  },

    setBreakdownEnabled: (enabled) => {
      set({ breakdownEnabled: enabled });
      recalculateGoalTotal({ breakdownEnabled: enabled });
    },

  setSessionLabel: (label) => {
    set({ sessionLabel: label.trim() || 'session' });
  },

    setSessionsPerCadence: (sessions) => {
      set({ sessionsPerCadence: sessions });
      recalculateGoalTotal({ sessionsPerCadence: sessions });
    },

    setVolumePerSession: (volume) => {
      set({ volumePerSession: volume });
      recalculateGoalTotal({ volumePerSession: volume });
    },

  getEffectiveUnit: () => {
    const state = get();
    if (state.unitOverride) {
      return state.unitOverride;
    }
    return state.unit || null;
  },

  getSummaryPreview: () => {
    const state = get();
    const effectiveUnit = state.getEffectiveUnit();
    
    if (!effectiveUnit || !state.cadence) {
      return null;
        }

    // Calculate session config based on current state
    let sessionConfig: StandardSessionConfig | undefined;
    let minimum: number;

    if (state.breakdownEnabled && state.sessionsPerCadence !== null && state.volumePerSession !== null) {
      // Session-based mode: calculate minimum from session config
      minimum = state.sessionsPerCadence * state.volumePerSession;
      sessionConfig = {
        sessionLabel: state.sessionLabel || 'session',
        sessionsPerCadence: state.sessionsPerCadence,
        volumePerSession: state.volumePerSession,
      };
    } else if (state.goalTotal !== null) {
      // Direct minimum mode: use goalTotal as minimum, store as 1 session
      minimum = state.goalTotal;
      sessionConfig = {
        sessionLabel: state.sessionLabel || 'session',
        sessionsPerCadence: 1,
        volumePerSession: state.goalTotal,
      };
    } else {
      return null;
    }

    return formatStandardSummary(minimum, effectiveUnit, state.cadence, sessionConfig);
  },

  generatePayload: () => {
    const state = get();
    const effectiveUnit = state.getEffectiveUnit();

    if (
      !state.name.trim() ||
      !effectiveUnit ||
      !state.cadence
    ) {
      return null;
    }

    // Determine session config and calculate minimum
    let sessionConfig: StandardSessionConfig;
    let minimum: number;

    if (state.breakdownEnabled) {
      // Session-based mode: validate session config inputs
      if (
        state.sessionsPerCadence === null ||
        state.volumePerSession === null ||
        state.sessionsPerCadence <= 0 ||
        state.volumePerSession <= 0
      ) {
        return null;
      }
      minimum = state.sessionsPerCadence * state.volumePerSession;
      sessionConfig = {
        sessionLabel: state.sessionLabel || 'session',
        sessionsPerCadence: state.sessionsPerCadence,
        volumePerSession: state.volumePerSession,
      };
    } else {
      // Direct minimum mode: use goalTotal, store as 1 session
      if (state.goalTotal === null || state.goalTotal <= 0) {
        return null;
      }
      minimum = state.goalTotal;
      sessionConfig = {
        sessionLabel: state.sessionLabel || 'session',
        sessionsPerCadence: 1,
        volumePerSession: state.goalTotal,
      };
    }

    const summary = formatStandardSummary(
      minimum,
      effectiveUnit,
      state.cadence,
      sessionConfig
    );

    const preference = state.periodStartPreference;

    return {
      name: state.name.trim(),
      notes: state.notes,
      minimum,
      unit: effectiveUnit,
      cadence: state.cadence,
      summary,
      sessionConfig,
      periodStartPreference: preference ?? undefined,
    };
  },

    reset: () => {
      set(initialState);
    },

    loadFromStandard: (standard: Standard) => {
      const hasSessionBreakdown =
        standard.sessionConfig.sessionsPerCadence > 1;

      set({
        name: standard.name,
        unit: standard.unit,
        notes: standard.notes,
        cadence: standard.cadence,
        goalTotal: standard.minimum,
        unitOverride: null,
        breakdownEnabled: hasSessionBreakdown,
        sessionLabel: standard.sessionConfig.sessionLabel,
        sessionsPerCadence: standard.sessionConfig.sessionsPerCadence,
        volumePerSession: standard.sessionConfig.volumePerSession,
        periodStartPreference: standard.periodStartPreference ?? null,
        editingStandardId: standard.id,
      });
    },
  };
});
