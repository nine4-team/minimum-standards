import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ToastAndroid,
  Alert,
  FlatList,
  ScrollView,
  Keyboard,
  KeyboardEvent,
  LayoutChangeEvent,
  InteractionManager,
  AppState,
  AppStateStatus,
  useColorScheme,
  AccessibilityInfo,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import KeepAwake from 'react-native-keep-awake';
import type { Standard } from '@minimum-standards/shared-model';
import { calculatePeriodWindow } from '@minimum-standards/shared-model';
import { useStandards } from '../hooks/useStandards';
import { useTheme } from '../theme/useTheme';
import { useUIPreferencesStore } from '../stores/uiPreferencesStore';
import { BUTTON_BORDER_RADIUS, CARD_LIST_GAP } from '@nine4/ui-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StandardCard } from './StandardCard';
import { normalizeUnitToPlural, formatUnitWithCount } from '@minimum-standards/shared-model';
import { useStandardPeriodActivityLogs, ActivityLog } from '../hooks/useStandardPeriodActivityLogs';

export interface EditLogEntry {
  id: string;
  value: number;
  occurredAtMs: number;
  note: string | null;
}

export type LogEntryDraft = Omit<EditLogEntry, 'id'>;

export interface LogEntryModalProps {
  visible: boolean;
  standard: Standard | null | undefined;
  logEntry?: EditLogEntry | null; // Optional log entry for edit mode
  initialDraft?: LogEntryDraft | null;
  onClose: () => void;
  onSave: (standardId: string, value: number, occurredAtMs: number, note?: string | null, logEntryId?: string) => Promise<void>;
  onCreateStandard?: () => void; // Callback to create a new standard from empty state
  resolveActivityName?: (activityId: string) => string | undefined; // deprecated
  resolveActivity?: (activityId: string) => any | undefined; // deprecated
  currentPeriodStartMs?: number;
  currentPeriodEndMs?: number;
  onDeleteLogEntry?: (logEntryId: string, standardId: string, occurredAtMs: number) => Promise<void>;
}

export function LogEntryModal({
  visible,
  standard,
  logEntry,
  initialDraft,
  onClose,
  onSave,
  onCreateStandard,
  resolveActivityName,
  resolveActivity,
  currentPeriodStartMs,
  currentPeriodEndMs,
  onDeleteLogEntry,
}: LogEntryModalProps) {
  const theme = useTheme();
  const systemColorScheme = useColorScheme();
  const themePreference = useUIPreferencesStore((s) => s.themePreference);
  const isDark = themePreference === 'system' ? systemColorScheme === 'dark' : themePreference === 'dark';
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [affirmationMessage, setAffirmationMessage] = useState<string | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [showWhen, setShowWhen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [androidPickerMode, setAndroidPickerMode] = useState<'date' | 'time' | null>(null);
  const [selectedStandard, setSelectedStandard] = useState<Standard | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const valueInputRef = useRef<TextInput>(null);
  const [logMode, setLogMode] = useState<'manual' | 'stopwatch'>('manual');
  const [activityNotes, setActivityNotes] = useState('');

  // Stopwatch state
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [stopwatchStartedAtMs, setStopwatchStartedAtMs] = useState<number | null>(null);
  const [stopwatchAccumulatedMs, setStopwatchAccumulatedMs] = useState(0);
  const [stopwatchLastGeneratedValue, setStopwatchLastGeneratedValue] = useState<string | null>(null);
  const [stopwatchNowMs, setStopwatchNowMs] = useState(Date.now());
  const stopwatchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { activeStandards, loading: standardsLoading } = useStandards();

  // Internal edit state for tapping a period entry card
  const [internalEditEntry, setInternalEditEntry] = useState<EditLogEntry | null>(null);
  const effectiveLogEntry = logEntry ?? internalEditEntry;
  const isEditMode = !!effectiveLogEntry;

  // Fetch period entries when standard is selected and not in external edit mode
  const periodLogs = useStandardPeriodActivityLogs(
    !logEntry && selectedStandard ? selectedStandard.id : null,
    currentPeriodStartMs,
    currentPeriodEndMs,
    selectedStandard
  );
  const affirmationMessages = useMemo(
    () => ['Nice work.', 'Logged.', 'Done.', 'Solid.', '+1 logged.', 'Keep it up.'],
    []
  );

  // Determine if we should show the picker (when no standard is currently selected)
  const showPicker = selectedStandard === null;

  const isSessionBased = !!selectedStandard && selectedStandard.sessionConfig.sessionsPerCadence > 1;
  const sessionLabel = selectedStandard?.sessionConfig.sessionLabel ?? 'session';
  const activityName = useMemo(() => {
    if (!selectedStandard || showPicker) {
      return null;
    }
    return selectedStandard.name;
  }, [selectedStandard, showPicker]);

  const getAffirmationMessage = useCallback(() => {
    if (affirmationMessages.length === 0) {
      return 'Logged.';
    }
    const index = Math.floor(Math.random() * affirmationMessages.length);
    return affirmationMessages[index];
  }, [affirmationMessages]);

  const effectiveKeyboardHeight = Math.max(0, keyboardHeight - insets.bottom);

  // Check if the standard's unit is time-based (minutes or hours)
  const isTimeUnit = useMemo(() => {
    if (!selectedStandard) return false;
    const normalizedUnit = normalizeUnitToPlural(selectedStandard.unit);
    return normalizedUnit === 'minutes' || normalizedUnit === 'hours';
  }, [selectedStandard]);

  // Calculate elapsed time in milliseconds
  const stopwatchElapsedMs = useMemo(() => {
    if (!stopwatchRunning || stopwatchStartedAtMs === null) {
      return stopwatchAccumulatedMs;
    }
    return stopwatchAccumulatedMs + (stopwatchNowMs - stopwatchStartedAtMs);
  }, [stopwatchRunning, stopwatchStartedAtMs, stopwatchAccumulatedMs, stopwatchNowMs]);

  // Format elapsed time as mm:ss.cc or hh:mm:ss.cc
  const formatElapsed = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const centiseconds = Math.floor((ms % 1000) / 10);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const cs = centiseconds.toString().padStart(2, '0');
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${cs}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${cs}`;
  };

  // Convert milliseconds to unit value (minutes or hours)
  const msToUnitValue = (ms: number, unit: string): number => {
    const normalizedUnit = normalizeUnitToPlural(unit);
    if (normalizedUnit === 'minutes') {
      return ms / 60000; // Convert to decimal minutes
    } else if (normalizedUnit === 'hours') {
      return ms / 3600000; // Convert to decimal hours
    }
    return 0;
  };

  // Format numeric value with 2 decimals, trimming trailing zeros
  const formatNumericValue = (n: number): string => {
    const rounded = Math.round(n * 100) / 100; // Round to 2 decimals
    const trimmed = rounded.toFixed(2).replace(/\.?0+$/, ''); // Remove trailing zeros
    return trimmed === '' ? '0' : trimmed;
  };

  // Stopwatch tick interval
  useEffect(() => {
    if (stopwatchRunning) {
      stopwatchIntervalRef.current = setInterval(() => {
        setStopwatchNowMs(Date.now());
      }, 37);
      return () => {
        if (stopwatchIntervalRef.current) {
          clearInterval(stopwatchIntervalRef.current);
          stopwatchIntervalRef.current = null;
        }
      };
    } else {
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
        stopwatchIntervalRef.current = null;
      }
    }
  }, [stopwatchRunning]);

  // AppState listener for background/resume handling
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && stopwatchRunning) {
        // Refresh the timer when app comes to foreground
        setStopwatchNowMs(Date.now());
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [stopwatchRunning]);

  // Reset stopwatch when modal closes, standard changes, or entering edit mode
  useEffect(() => {
    if (!visible || !selectedStandard || isEditMode) {
      KeepAwake.deactivate();
      setStopwatchRunning(false);
      setStopwatchStartedAtMs(null);
      setStopwatchAccumulatedMs(0);
      setStopwatchLastGeneratedValue(null);
      setStopwatchNowMs(Date.now());
      setLogMode('manual');
    }
  }, [visible, selectedStandard, isEditMode]);

  useEffect(() => {
    if (!selectedStandard) {
      return;
    }
    if (!isTimeUnit || isEditMode) {
      if (logMode !== 'manual') {
        setLogMode('manual');
      }
    }
  }, [selectedStandard, isTimeUnit, isEditMode, logMode]);

  // Stopwatch control handlers
  const handleStartStopwatch = () => {
    if (saving) return;
    KeepAwake.activate();
    setStopwatchRunning(true);
    setStopwatchStartedAtMs(Date.now());
    setStopwatchNowMs(Date.now());
  };

  const handlePauseStopwatch = () => {
    if (!stopwatchRunning || stopwatchStartedAtMs === null) return;
    const pausedElapsedMs = stopwatchAccumulatedMs + (Date.now() - stopwatchStartedAtMs);
    setStopwatchRunning(false);
    setStopwatchAccumulatedMs(pausedElapsedMs);
    setStopwatchStartedAtMs(null);
  };

  const handleStopStopwatch = () => {
    if (!stopwatchRunning || stopwatchStartedAtMs === null) return;
    KeepAwake.deactivate();

    const finalElapsedMs = stopwatchAccumulatedMs + (Date.now() - stopwatchStartedAtMs);
    setStopwatchRunning(false);
    setStopwatchAccumulatedMs(finalElapsedMs);
    setStopwatchStartedAtMs(null);
    
    // Auto-fill the value
    if (selectedStandard) {
      const unitValue = msToUnitValue(finalElapsedMs, selectedStandard.unit);
      const formattedValue = formatNumericValue(unitValue);
      setValue(formattedValue);
      setStopwatchLastGeneratedValue(formattedValue);
      setSaveError(null);
      // Set occurredAt to now (when timer stopped)
      setSelectedDate(new Date());
    }
    setLogMode('manual');
  };

  const handleResetStopwatch = () => {
    KeepAwake.deactivate();
    setStopwatchRunning(false);
    setStopwatchStartedAtMs(null);
    setStopwatchAccumulatedMs(0);
    setStopwatchNowMs(Date.now());
    
    // Clear input only if it matches the last generated value
    if (value === stopwatchLastGeneratedValue) {
      setValue('');
    }
    setStopwatchLastGeneratedValue(null);
  };

  useEffect(() => {
    if (!visible) {
      // Reset state when modal closes so a new session always starts fresh
      setSelectedStandard(null);
      setInternalEditEntry(null);
      setValue('');
      setNote('');
      setShowNote(false);
      setShowWhen(false);
      setSelectedDate(new Date());
      setSaveError(null);
      setActivityNotes('');
      return;
    }

    if (logEntry) {
      // Edit mode: pre-fill form from logEntry
      setValue(String(logEntry.value));
      setNote(logEntry.note || '');
      setShowNote(!!logEntry.note);
      // Keep date visible, but don't force the picker open.
      setShowWhen(false);
      setSelectedDate(new Date(logEntry.occurredAtMs));
      setSelectedStandard(standard ?? null);
    } else if (initialDraft) {
      // A rejected create can be reopened as an editable draft. It remains a create,
      // never an update of a document that may not exist.
      setValue(String(initialDraft.value));
      setNote(initialDraft.note || '');
      setShowNote(!!initialDraft.note);
      setShowWhen(false);
      setSelectedDate(new Date(initialDraft.occurredAtMs));
      setSelectedStandard(standard ?? null);
    } else {
      // Create mode: reset all form state
      setValue('');
      setNote('');
      setShowNote(false);
      setShowWhen(false);
      setSelectedDate(new Date());
      setSelectedStandard(standard ?? null);
    }

    // Initialize notes from the standard
    if (standard) {
      setActivityNotes(standard.notes ?? '');
    }
    setSaveError(null);
  }, [visible, standard, logEntry, initialDraft]);

  // Auto-focus the value input when entering the logging form
  useEffect(() => {
    if (visible && selectedStandard && !showPicker && !isEditMode && logMode === 'manual') {
      // Delay focus until layout/animations settle (Android needs extra time).
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const task = InteractionManager.runAfterInteractions(() => {
        timeoutId = setTimeout(() => {
          valueInputRef.current?.focus();
        }, Platform.OS === 'android' ? 250 : 100);
      });
      return () => {
        task.cancel();
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };
    }
  }, [visible, selectedStandard, showPicker, isEditMode, logMode]);

  // In edit mode, focus the value input with cursor at the end
  useEffect(() => {
    if (visible && isEditMode && logMode === 'manual') {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const task = InteractionManager.runAfterInteractions(() => {
        timeoutId = setTimeout(() => {
          const input = valueInputRef.current;
          if (input) {
            input.focus();
            // Move cursor to end of existing value
            const len = String(effectiveLogEntry?.value ?? '').length;
            input.setNativeProps({ selection: { start: len, end: len } });
          }
        }, Platform.OS === 'android' ? 250 : 100);
      });
      return () => {
        task.cancel();
        if (timeoutId) clearTimeout(timeoutId);
      };
    }
  }, [visible, isEditMode, logMode]);


  const handleStandardSelect = (selected: Standard) => {
    setSelectedStandard(selected);
    setActivityNotes(selected.notes ?? '');
  };

  const handleSave = async () => {
    const targetStandard = selectedStandard;
    if (!targetStandard) {
      return;
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) {
      setSaveError('Please enter a valid number (zero or greater)');
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      const occurredAtMs = selectedDate.getTime();
      await onSave(
        targetStandard.id,
        numValue,
        occurredAtMs,
        note.trim() || null,
        effectiveLogEntry?.id // Pass logEntryId in edit mode
      );

      let successMessage = internalEditEntry ? 'Updated.' : getAffirmationMessage();
      
      // Determine the period window to check against
      let checkStartMs = currentPeriodStartMs;
      let checkEndMs = currentPeriodEndMs;

      // If no explicit window provided, calculate current period for the standard
      if (checkStartMs === undefined && targetStandard) {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
        const window = calculatePeriodWindow(
          Date.now(),
          targetStandard.cadence,
          timezone,
          { periodStartPreference: targetStandard.periodStartPreference }
        );
        checkStartMs = window.startMs;
        checkEndMs = window.endMs;
      }
      
      // Check if the log is outside the view period
      if (
        checkStartMs !== undefined &&
        checkEndMs !== undefined &&
        (occurredAtMs < checkStartMs || occurredAtMs >= checkEndMs)
      ) {
        successMessage = 'Logged to history.';
      }

      if (Platform.OS === 'android') {
        ToastAndroid.show(successMessage, ToastAndroid.SHORT);
      } else {
        AccessibilityInfo.announceForAccessibility(successMessage);
      }

      // Reset form
      setValue('');
      setNote('');
      setShowNote(false);
      setShowWhen(false);
      setAndroidPickerMode(null);
      setSelectedDate(new Date());

      onClose();
    } catch (error) {
      if (error instanceof Error) {
        setSaveError(error.message);
      } else {
        setSaveError('Failed to save log entry');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) {
      return;
    }
    setValue('');
    setNote('');
    setShowNote(false);
    setShowWhen(false);
    setAndroidPickerMode(null);
    setSelectedDate(new Date());
    setSaveError(null);
    setAffirmationMessage(null);
    setSelectedStandard(null);
    setInternalEditEntry(null);
    // Reset stopwatch
    setStopwatchRunning(false);
    setStopwatchStartedAtMs(null);
    setStopwatchAccumulatedMs(0);
    setStopwatchLastGeneratedValue(null);
    setLogMode('manual');
    onClose();
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  const formatDateOnly = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const formatTimeOnly = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  const handleNowPress = () => {
    setSelectedDate(new Date());
  };

  const handleToggleNote = () => {
    if (saving) {
      return;
    }
    setShowNote((prev) => {
      const next = !prev;
      if (!next) {
        setNote('');
      }
      return next;
    });
  };

  const handleToggleWhen = () => {
    if (saving) {
      return;
    }
    Keyboard.dismiss();
    setShowWhen((prev) => {
      const next = !prev;
      if (!next) {
        setAndroidPickerMode(null);
      }
      return next;
    });
  };

  const renderStandardPicker = () => {
    console.log('[LogEntryModal] renderStandardPicker - standardsLoading=', standardsLoading, 'activeStandards.length=', activeStandards.length);
    if (standardsLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary.main} />
        </View>
      );
    }

    if (activeStandards.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.text.primary }]}>
            No active standards yet.
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.text.secondary }]}>
            Create a standard to start logging your progress.
          </Text>
          {onCreateStandard && (
            <TouchableOpacity
              style={[styles.createStandardButton, { backgroundColor: theme.button.primary.background }]}
              onPress={() => {
                onClose();
                onCreateStandard();
              }}
              accessibilityLabel="Create a new standard"
              accessibilityRole="button"
            >
              <Text style={[styles.createStandardButtonText, { color: theme.button.primary.text }]}>Create Standard</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    return (
      <FlatList
        data={activeStandards}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <StandardCard
            standard={item}
            onSelect={() => handleStandardSelect(item)}
            showActions={false}
          />
        )}
        style={styles.standardsList}
        contentContainerStyle={styles.standardsListContent}
      />
    );
  };

  useEffect(() => {
    console.log('[LogEntryModal] useEffect(visible,standard,logEntry) ->', {
      visible,
      incomingStandardId: standard ? standard.id : null,
      selectedStandardBefore: selectedStandard ? selectedStandard.id : null,
      logEntryId: logEntry ? logEntry.id : null,
    });
  }, [visible, standard, logEntry]);

  useEffect(() => {
    console.log('[LogEntryModal] selectedStandard changed ->', {
      selectedStandardId: selectedStandard ? selectedStandard.id : null,
      showPicker: selectedStandard === null,
    });
  }, [selectedStandard]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const handleKeyboardShow = (event: KeyboardEvent) => {
      setKeyboardHeight(event.endCoordinates?.height ?? 0);
    };

    const handleKeyboardHide = () => {
      setKeyboardHeight(0);
    };

    const showSubscription = Keyboard.addListener(showEvent, handleKeyboardShow);
    const hideSubscription = Keyboard.addListener(hideEvent, handleKeyboardHide);

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const handleLogModeChange = (nextMode: 'manual' | 'stopwatch') => {
    if (saving || nextMode === logMode) {
      return;
    }
    if (nextMode === 'manual') {
      if (stopwatchRunning) {
        handleStopStopwatch();
      }
    } else {
      setValue('');
      setSaveError(null);
      setStopwatchRunning(false);
      setStopwatchStartedAtMs(null);
      setStopwatchAccumulatedMs(0);
      setStopwatchLastGeneratedValue(null);
      setStopwatchNowMs(Date.now());
    }
    setLogMode(nextMode);
  };

  const renderLoggingForm = () => {
    if (!selectedStandard) {
      return null;
    }

    const showStopwatchMode = isTimeUnit && !isEditMode;
    const isManualMode = !showStopwatchMode || logMode === 'manual';
    const isStopwatchMode = showStopwatchMode && logMode === 'stopwatch';

    return (
      <>
        {showStopwatchMode && (
          <View style={[styles.modeTabsContainer, { borderBottomColor: theme.border.secondary }]}>
            {(['manual', 'stopwatch'] as const).map((mode) => {
              const isSelected = logMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  onPress={() => handleLogModeChange(mode)}
                  style={[
                    styles.modeTab,
                    isSelected && {
                      borderBottomColor: theme.tabBar.activeTint,
                      borderBottomWidth: 3,
                    },
                  ]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={mode === 'manual' ? 'Manual entry mode' : 'Stopwatch mode'}
                >
                  <Text
                    style={[
                      styles.modeTabText,
                      { color: isSelected ? theme.tabBar.activeTint : theme.text.secondary },
                      isSelected && { fontWeight: '700' },
                    ]}
                  >
                    {mode === 'manual' ? 'Manual' : 'Stopwatch'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {isManualMode && (
          <View style={styles.numberField}>
            <TextInput
              ref={valueInputRef}
              style={[
                styles.bigNumberInput,
                { color: saveError ? theme.input.borderError : theme.text.primary },
              ]}
              value={value}
              onChangeText={(text) => {
                setValue(text);
                if (saveError) {
                  setSaveError(null);
                }
              }}
              onPressIn={() => valueInputRef.current?.focus()}
              placeholder="0"
              placeholderTextColor={theme.text.tertiary}
              keyboardType={Platform.OS === 'android' ? 'number-pad' : 'numeric'}
              editable={!saving}
              autoFocus={Platform.OS === 'android' && !isEditMode}
              showSoftInputOnFocus={true}
              accessibilityLabel={`Enter ${selectedStandard.unit}`}
              underlineColorAndroid="transparent"
            />
            <Text style={[styles.numberUnit, { color: theme.text.secondary }]}>
              {selectedStandard.unit}
            </Text>
          </View>
        )}

        {isStopwatchMode && (
          <View style={styles.stopwatchSection}>
            <Text style={[styles.stopwatchDisplay, { color: theme.text.primary }]}>
              {formatElapsed(stopwatchElapsedMs)}
            </Text>
            <View style={styles.stopwatchButtonsRow}>
              {stopwatchRunning && (
                <TouchableOpacity
                  onPress={handlePauseStopwatch}
                  disabled={saving}
                  style={[
                    styles.timerButton,
                    { backgroundColor: saving ? theme.button.disabled.background : theme.button.secondary.background },
                  ]}
                  accessibilityLabel="Pause timer"
                  accessibilityRole="button"
                >
                  <Text style={[styles.timerButtonText, { color: theme.button.secondary.text }]}>Pause</Text>
                </TouchableOpacity>
              )}
              {stopwatchRunning && (
                <TouchableOpacity
                  onPress={handleStopStopwatch}
                  disabled={saving}
                  style={[
                    styles.timerButton,
                    { backgroundColor: saving ? theme.button.disabled.background : theme.button.secondary.background },
                  ]}
                  accessibilityLabel="Stop timer"
                  accessibilityRole="button"
                >
                  <Text style={[styles.timerButtonText, { color: theme.button.secondary.text }]}>Stop</Text>
                </TouchableOpacity>
              )}
              {!stopwatchRunning && (
                <TouchableOpacity
                  onPress={handleStartStopwatch}
                  disabled={saving}
                  style={[
                    styles.timerButton,
                    { backgroundColor: saving ? theme.button.disabled.background : theme.button.primary.background },
                  ]}
                  accessibilityLabel={stopwatchElapsedMs > 0 ? 'Resume timer' : 'Start timer'}
                  accessibilityRole="button"
                >
                  <Text style={[styles.timerButtonText, { color: theme.button.primary.text }]}>
                    {stopwatchElapsedMs > 0 ? 'Resume' : 'Start'}
                  </Text>
                </TouchableOpacity>
              )}
              {!stopwatchRunning && stopwatchElapsedMs > 0 && (
                <TouchableOpacity
                  onPress={handleResetStopwatch}
                  disabled={saving}
                  style={[
                    styles.timerButton,
                    { backgroundColor: saving ? theme.button.disabled.background : theme.button.secondary.background },
                  ]}
                  accessibilityLabel="Reset timer"
                  accessibilityRole="button"
                >
                  <Text style={[styles.timerButtonText, { color: theme.button.secondary.text }]}>Reset</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {saveError && <Text style={[styles.errorText, { color: theme.input.borderError }]}>{saveError}</Text>}

        {/* Inline When · Note row */}
        <View style={styles.metaInline}>
          <TouchableOpacity
            onPress={handleToggleWhen}
            disabled={saving}
            accessibilityLabel="Change when this occurred"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Text style={[styles.metaInlineText, { color: theme.text.secondary }]} numberOfLines={1}>
              {formatDate(selectedDate)}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.metaInlineDot, { color: theme.text.tertiary }]}>·</Text>
          <TouchableOpacity
            onPress={handleToggleNote}
            disabled={saving}
            accessibilityLabel={showNote ? 'Hide note' : 'Add a note'}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            style={styles.metaInlineNote}
          >
            <Text
              style={[styles.metaInlineText, { color: note ? theme.text.primary : theme.text.secondary }]}
              numberOfLines={1}
            >
              {note ? note : 'Add note'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Expandable sections */}
        {showWhen && (
          <View style={[styles.expandedSection, { backgroundColor: theme.background.tertiary, borderColor: theme.border.primary }]}>
            <View style={styles.expandedHeader}>
              <Text style={[styles.expandedHeaderText, { color: theme.text.primary }]}>Select Date & Time</Text>
              <TouchableOpacity
                onPress={handleNowPress}
                style={[styles.nowButton, { backgroundColor: theme.button.secondary.background }]}
                disabled={saving}
                accessibilityLabel="Set to current time"
                accessibilityRole="button"
              >
                <Text style={[styles.nowButtonText, { color: theme.button.primary.background }]}>Now</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.dateTimeRow}>
              {Platform.OS === 'ios' ? (
                <>
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="spinner"
                    themeVariant={isDark ? 'dark' : 'light'}
                    onChange={(event, date) => {
                      if (date) {
                        setSelectedDate(date);
                      }
                    }}
                    accessibilityLabel="Select date"
                    style={styles.datePicker}
                  />
                  <DateTimePicker
                    value={selectedDate}
                    mode="time"
                    display="spinner"
                    themeVariant={isDark ? 'dark' : 'light'}
                    onChange={(event, date) => {
                      if (date) {
                        setSelectedDate(date);
                      }
                    }}
                    accessibilityLabel="Select time"
                    style={styles.timePicker}
                  />
                </>
              ) : (
                <>
                  <TouchableOpacity
                    onPress={() => setAndroidPickerMode('date')}
                    style={[styles.androidPickerButton, { backgroundColor: theme.background.primary, borderColor: theme.border.primary }]}
                    accessibilityLabel="Select date"
                    accessibilityRole="button"
                  >
                    <Text style={[styles.androidPickerLabel, { color: theme.text.secondary }]}>Date</Text>
                    <Text style={[styles.androidPickerValue, { color: theme.text.primary }]}>{formatDateOnly(selectedDate)}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setAndroidPickerMode('time')}
                    style={[styles.androidPickerButton, { backgroundColor: theme.background.primary, borderColor: theme.border.primary }]}
                    accessibilityLabel="Select time"
                    accessibilityRole="button"
                  >
                    <Text style={[styles.androidPickerLabel, { color: theme.text.secondary }]}>Time</Text>
                    <Text style={[styles.androidPickerValue, { color: theme.text.primary }]}>{formatTimeOnly(selectedDate)}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            {Platform.OS !== 'ios' && androidPickerMode && (
              <DateTimePicker
                value={selectedDate}
                mode={androidPickerMode}
                display="default"
                accentColor={theme.primary.main}
                onChange={(event, date) => {
                  const nextDate = event.type === 'set' && date ? date : null;
                  setAndroidPickerMode(null);
                  if (nextDate) {
                    setTimeout(() => setSelectedDate(nextDate), 0);
                  }
                }}
              />
            )}
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                onPress={() => setShowWhen(false)}
                style={styles.doneButton}
                disabled={saving}
                accessibilityLabel="Done"
                accessibilityRole="button"
              >
                <Text style={[styles.doneButtonText, { color: theme.button.primary.background }]}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {showNote && (
          <View style={[styles.expandedSection, { backgroundColor: theme.background.tertiary, borderColor: theme.border.primary }]}>
            <Text style={[styles.expandedHeaderText, { color: theme.text.primary }]}>Add Note</Text>
            <TextInput
              style={[styles.noteInput, { backgroundColor: theme.input.background, borderColor: theme.input.border, color: theme.input.text }]}
              value={note}
              onChangeText={setNote}
              placeholder={isSessionBased ? `e.g., ${sessionLabel} notes` : 'Optional note'}
              placeholderTextColor={theme.input.placeholder}
              multiline
              numberOfLines={3}
              maxLength={500}
              editable={!saving}
              accessibilityLabel="Enter optional note"
            />
          </View>
        )}
      </>
    );
  };

  const handlePeriodEntryEdit = useCallback((log: ActivityLog) => {
    setInternalEditEntry({
      id: log.id,
      value: log.value,
      occurredAtMs: log.occurredAtMs,
      note: log.note,
    });
    // Pre-fill form with entry data
    setValue(String(log.value));
    setNote(log.note || '');
    setShowNote(!!log.note);
    setShowWhen(false);
    setSelectedDate(new Date(log.occurredAtMs));
    setSaveError(null);
  }, []);

  const handlePeriodEntryDelete = useCallback((log: ActivityLog) => {
    if (!onDeleteLogEntry) return;
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this log entry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDeleteLogEntry(log.id, log.standardId, log.occurredAtMs),
        },
      ]
    );
  }, [onDeleteLogEntry]);

  const handleCancelInternalEdit = useCallback(() => {
    setInternalEditEntry(null);
    setValue('');
    setNote('');
    setShowNote(false);
    setShowWhen(false);
    setSelectedDate(new Date());
    setSaveError(null);
  }, []);

  const renderPeriodEntries = () => {
    // Don't show period entries when in external edit mode or when picking a standard
    if (logEntry || showPicker || !selectedStandard) {
      return null;
    }

    const { logs: entries, loading: entriesLoading } = periodLogs;

    if (entriesLoading && entries.length === 0) {
      return null; // Don't show loading state — entries appear when ready
    }

    if (entries.length === 0) {
      return null;
    }

    return (
      <View style={styles.periodEntriesSection}>
        <Text style={[styles.periodEntriesSectionTitle, { color: theme.text.secondary }]}>
          This Period
        </Text>
        <View style={styles.periodEntriesList}>
          {entries.map((entry) => {
            const isBeingEdited = internalEditEntry?.id === entry.id;
            return (
              <View
                key={entry.id}
                style={[
                  styles.periodEntryCard,
                  {
                    backgroundColor: theme.background.card,
                    borderWidth: isBeingEdited ? 2 : 1,
                    borderColor: isBeingEdited ? theme.primary.main : theme.border.secondary,
                    borderRadius: 12,
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.periodEntryContent}
                  onPress={() => handlePeriodEntryEdit(entry)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Edit log entry"
                >
                  <View style={styles.periodEntryRow}>
                    <Text style={[styles.periodEntryValue, { color: theme.text.primary }]}>
                      {entry.value} {formatUnitWithCount(selectedStandard.unit, entry.value)}
                    </Text>
                    <Text style={[styles.periodEntryTimestamp, { color: theme.text.tertiary }]}>
                      {new Date(entry.occurredAtMs).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'numeric',
                        day: 'numeric',
                      })}{' '}
                      {new Date(entry.occurredAtMs).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </Text>
                  </View>
                  {entry.note && (
                    <Text
                      style={[styles.periodEntryNote, { color: theme.text.secondary }]}
                      numberOfLines={1}
                    >
                      {entry.note}
                    </Text>
                  )}
                </TouchableOpacity>
                {onDeleteLogEntry && (
                  <TouchableOpacity
                    style={styles.periodEntryDeleteButton}
                    onPress={() => handlePeriodEntryDelete(entry)}
                    accessibilityRole="button"
                    accessibilityLabel="Delete log entry"
                  >
                    <Text style={[styles.periodEntryDeleteText, { color: theme.text.tertiary }]}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const handleFooterLayout = (event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    if (Math.abs(height - footerHeight) > 1) {
      setFooterHeight(height);
    }
  };

  const renderFooter = () => {
    if (showPicker || !selectedStandard) {
      return null;
    }

    return (
      <View
        onLayout={handleFooterLayout}
        style={[
          styles.footer,
          {
            backgroundColor: theme.background.chrome,
            borderTopColor: theme.border.secondary,
            // Keep the Save button above the keyboard without shrinking the scrollable area.
            // This prevents the top content (e.g. unit label) from getting pushed off-screen
            // when the value input auto-focuses.
            bottom: effectiveKeyboardHeight,
            paddingBottom: 12 + insets.bottom,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.saveButton,
            { backgroundColor: saving ? theme.button.disabled.background : theme.button.primary.background },
          ]}
          onPress={handleSave}
          disabled={saving || !value.trim() || (logMode === 'stopwatch' && stopwatchRunning)}
          accessibilityLabel="Save log entry"
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color={theme.button.primary.text} />
          ) : (
            <Text style={[styles.saveButtonText, { color: theme.button.primary.text }]}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: theme.background.overlay }]}>
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.modalBackdrop]}
        />
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: theme.background.chrome,
              paddingTop: Math.max(insets.top, 20),
            },
          ]}
        >
            <View style={[styles.modalHeader, { backgroundColor: theme.background.chrome }]}>
              <View style={styles.headerContent}>
                {internalEditEntry && (
                  <TouchableOpacity
                    onPress={handleCancelInternalEdit}
                    style={styles.cancelEditButton}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel edit"
                  >
                    <Text style={[styles.cancelEditText, { color: theme.primary.main }]}>←</Text>
                  </TouchableOpacity>
                )}
                <Text style={[styles.modalTitle, { color: theme.text.primary }]}>
                  {showPicker
                    ? 'Select Standard'
                    : isEditMode
                    ? `Edit ${activityName ?? 'Activity'}`
                    : `Log ${activityName ?? 'Activity'}`}
                </Text>
                {selectedStandard && !showPicker && (
                  <>
                    <Text style={[styles.standardSummary, { color: theme.text.secondary }]} numberOfLines={1}>
                      {selectedStandard.summary}
                    </Text>
                    {currentPeriodStartMs !== undefined && currentPeriodEndMs !== undefined && (
                      <Text style={[styles.periodDateRange, { color: theme.text.tertiary }]} numberOfLines={1}>
                        {new Date(currentPeriodStartMs).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                        {' – '}
                        {new Date(currentPeriodEndMs - 1).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                      </Text>
                    )}
                    {activityNotes ? (
                      <>
                        <Text style={[styles.activityNotesLabel, { color: theme.text.tertiary }]}>Activity Notes</Text>
                        <Text style={[styles.activityNotesText, { color: theme.text.secondary }]}>{activityNotes}</Text>
                      </>
                    ) : null}
                  </>
                )}
              </View>
              <TouchableOpacity 
                onPress={handleClose} 
                disabled={saving}
                accessibilityLabel="Close modal"
                accessibilityRole="button"
              >
                <Text style={[styles.closeButton, { color: theme.text.secondary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {showPicker ? (
              <View style={[styles.pickerContainer, { backgroundColor: theme.background.chrome }]}>
                {renderStandardPicker()}
              </View>
            ) : (
              <ScrollView
                style={[styles.formScroll, { backgroundColor: theme.background.chrome }]}
                contentContainerStyle={[
                  styles.form,
                  { paddingBottom: 16 + footerHeight + effectiveKeyboardHeight },
                ]}
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="on-drag"
                bounces={true}
                showsVerticalScrollIndicator={true}
                scrollIndicatorInsets={{ bottom: footerHeight + effectiveKeyboardHeight }}
                contentInsetAdjustmentBehavior="always"
                scrollEventThrottle={16}
                nestedScrollEnabled={true}
              >
                {renderLoggingForm()}
                {renderPeriodEntries()}
              </ScrollView>
            )}

            {!showPicker && affirmationMessage && (
              <View
                pointerEvents="none"
                style={[
                  styles.affirmationToast,
                  {
                    backgroundColor: theme.background.surface,
                    borderColor: theme.border.secondary,
                    bottom: footerHeight + effectiveKeyboardHeight + 12,
                  },
                ]}
              >
                <Text style={[styles.affirmationText, { color: theme.text.primary }]}>
                  {affirmationMessage}
                </Text>
              </View>
            )}

            {renderFooter()}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
  },
  modalBackdrop: {
    zIndex: 0,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 0,
    width: '100%',
    zIndex: 1,
    elevation: 1,
    position: 'relative',
  },
  affirmationToast: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  affirmationText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pickerContainer: {
    flex: 1,
    minHeight: 300,
    // ensure picker area paints above header/footer and occupies allocated space
    alignSelf: 'stretch',
  },
  formScroll: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerContent: {
    flex: 1,
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  standardSummary: {
    fontSize: 14,
  },
  periodDateRange: {
    fontSize: 12,
    marginTop: 2,
  },
  activityNotesLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 6,
  },
  activityNotesText: {
    fontSize: 13,
    marginTop: 2,
  },
  closeButton: {
    fontSize: 24,
  },
  form: {
    gap: 16,
    paddingBottom: 16,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  valueInputRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
  },
  valueInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 14,
    minHeight: 70,
  },
  modeTabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  modeTab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: -1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '500',
  },
  stopwatchSection: {
    alignItems: 'center',
    gap: 20,
    marginBottom: 8,
  },
  stopwatchDisplay: {
    fontSize: 64,
    fontWeight: '300',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  stopwatchButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  timerButton: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  inputError: {},
  errorText: {
    fontSize: 14,
    marginTop: 8,
  },
  numberField: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 4,
    marginBottom: 4,
  },
  bigNumberInput: {
    fontSize: 96,
    fontWeight: '300',
    textAlign: 'center',
    padding: 0,
    minWidth: 120,
    minHeight: 110,
    includeFontPadding: false,
    letterSpacing: -2,
  },
  numberUnit: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  metaInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  metaInlineText: {
    fontSize: 13,
    fontWeight: '500',
  },
  metaInlineDot: {
    fontSize: 13,
    fontWeight: '500',
  },
  metaInlineNote: {
    maxWidth: 200,
  },
  expandedSection: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  expandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  expandedHeaderText: {
    fontSize: 15,
    fontWeight: '600',
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    marginTop: 8,
  },
  saveButton: {
    padding: 16,
    borderRadius: BUTTON_BORDER_RADIUS,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 12,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  createStandardButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: BUTTON_BORDER_RADIUS,
    marginTop: 8,
  },
  createStandardButtonText: {
    fontSize: 16,
    fontWeight: '600',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  standardsList: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  standardsListContent: {
    padding: 16,
    gap: 16,
    flexGrow: 1,
    backgroundColor: 'transparent',
  },
  pickerCard: {
    borderRadius: 16,
    padding: 0,
    marginBottom: 12,
    overflow: 'hidden',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  pickerCardContent: {
    gap: 0,
    padding: 16,
  },
  pickerTitleBlock: {
    flex: 1,
    gap: 4,
  },
  pickerActivityName: {
    fontSize: 16,
    fontWeight: '600',
  },
  pickerVolumeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  pickerSessionText: {
    fontSize: 13,
  },
  standardItem: {
    padding: 16,
    borderBottomWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  standardItemText: {
    fontSize: 16,
  },
  nowButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
  },
  nowButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  doneButton: {
    marginTop: 12,
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  androidPickerButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  androidPickerLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  androidPickerValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  datePicker: {
    flex: 1,
  },
  timePicker: {
    flex: 1,
  },
  cancelEditButton: {
    marginBottom: 4,
  },
  cancelEditText: {
    fontSize: 14,
    fontWeight: '600',
  },
  periodEntriesSection: {
    marginTop: 8,
  },
  periodEntriesSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  periodEntriesList: {
    gap: CARD_LIST_GAP,
  },
  periodEntryCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  periodEntryContent: {
    flex: 1,
    padding: 14,
    gap: 6,
  },
  periodEntryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  periodEntryValue: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  periodEntryTimestamp: {
    fontSize: 12,
    fontWeight: '500',
  },
  periodEntryNote: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  periodEntryDeleteButton: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  periodEntryDeleteText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
