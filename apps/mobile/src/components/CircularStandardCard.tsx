import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import type { Standard } from '@minimum-standards/shared-model';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/useTheme';
import type { StandardProgressCardStandard } from './StandardProgressCard';

export interface CircularStandardCardProps {
  standard: StandardProgressCardStandard & Pick<Standard, 'name'>;
  activityName: string;
  currentTotalFormatted: string;
  targetValueFormatted: string;
  progressPercent: number;
  unit: string;
  periodStartMs?: number;
  periodEndMs?: number;
  nowMs?: number;
  onLogPress?: () => void;
  onCardPress?: () => void;
  onMenuPress?: () => void;
  highlighted?: boolean;
}

const RING_SIZE = 120;
const STROKE = 9;
const PACE_DOT_RADIUS = 6;

export function CircularStandardCard({
  activityName,
  currentTotalFormatted,
  targetValueFormatted,
  progressPercent,
  unit,
  periodStartMs,
  periodEndMs,
  nowMs,
  onLogPress,
  onCardPress,
  onMenuPress,
  highlighted,
}: CircularStandardCardProps) {
  const theme = useTheme();

  const radius = (RING_SIZE - STROKE) / 2;
  const center = RING_SIZE / 2;
  const circumference = 2 * Math.PI * radius;

  const clampedProgress = Math.max(0, Math.min(progressPercent, 100));
  const progressBarColor =
    clampedProgress >= 100 ? theme.status.met.barComplete : theme.status.met.bar;
  const dashOffset = circumference * (1 - clampedProgress / 100);

  const currentNowMs = nowMs ?? Date.now();
  const hasTimeWindow =
    periodStartMs !== undefined &&
    periodEndMs !== undefined &&
    periodEndMs > periodStartMs &&
    currentNowMs >= periodStartMs &&
    currentNowMs < periodEndMs;

  let paceDot: { x: number; y: number } | null = null;
  if (hasTimeWindow && clampedProgress < 100) {
    const elapsed = Math.max(0, Math.min(currentNowMs - periodStartMs, periodEndMs - periodStartMs));
    const timePercent = (elapsed / (periodEndMs - periodStartMs)) * 100;
    const angle = (timePercent / 100) * 2 * Math.PI - Math.PI / 2;
    paceDot = {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    };
  }

  const handleMenuPress = useCallback(
    (e: any) => {
      e.stopPropagation();
      onMenuPress?.();
    },
    [onMenuPress]
  );

  return (
    <Pressable
      onPress={onCardPress ?? onLogPress}
      accessibilityRole="button"
      accessibilityLabel={`Log progress for ${activityName}`}
      style={({ pressed }) => [
        styles.tile,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {onMenuPress && (
        <TouchableOpacity
          onPress={handleMenuPress}
          style={styles.menuButton}
          accessibilityRole="button"
          accessibilityLabel={`More options for ${activityName}`}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name="more-horiz" size={18} color={theme.button.icon.icon} />
        </TouchableOpacity>
      )}

      <View style={styles.ringContainer}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <G rotation={-90} origin={`${center}, ${center}`}>
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={highlighted ? theme.button.primary.background : theme.border.secondary}
              strokeWidth={STROKE}
              fill="none"
            />
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={progressBarColor}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${circumference}, ${circumference}`}
              strokeDashoffset={dashOffset}
            />
          </G>
          {paceDot && (
            <Circle
              cx={paceDot.x}
              cy={paceDot.y}
              r={PACE_DOT_RADIUS}
              fill={theme.text.primary}
            />
          )}
        </Svg>
        <View style={styles.ringCenter} pointerEvents="none">
          <Text style={[styles.ringValue, { color: theme.text.primary }]} numberOfLines={1}>
            {currentTotalFormatted}
          </Text>
          <Text style={[styles.ringTarget, { color: theme.text.secondary }]} numberOfLines={1}>
            / {targetValueFormatted}
          </Text>
        </View>
      </View>

      <Text style={[styles.name, { color: theme.text.primary }]} numberOfLines={2}>
        {activityName}
      </Text>
      <Text style={[styles.unit, { color: theme.text.secondary }]} numberOfLines={1}>
        {unit}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 6,
  },
  menuButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    padding: 4,
    zIndex: 1,
    opacity: 0.5,
  },
  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    fontSize: 26,
    fontWeight: '700',
    includeFontPadding: false,
  },
  ringTarget: {
    fontSize: 12,
    fontWeight: '500',
    includeFontPadding: false,
    marginTop: 2,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  unit: {
    fontSize: 11,
    textAlign: 'center',
  },
});
