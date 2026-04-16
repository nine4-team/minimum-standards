import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, G, Line } from 'react-native-svg';
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

const RING_SIZE = 130;
const STROKE = 10;
const PACE_TICK_STROKE = 1.5;
const PACE_TICK_OVERSHOOT = 1;

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

  let paceTick: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (hasTimeWindow && clampedProgress < 100) {
    const elapsed = Math.max(0, Math.min(currentNowMs - periodStartMs, periodEndMs - periodStartMs));
    const timePercent = (elapsed / (periodEndMs - periodStartMs)) * 100;
    const angle = (timePercent / 100) * 2 * Math.PI - Math.PI / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const inner = radius - STROKE / 2 - PACE_TICK_OVERSHOOT;
    const outer = radius + STROKE / 2 + PACE_TICK_OVERSHOOT;
    paceTick = {
      x1: center + inner * cos,
      y1: center + inner * sin,
      x2: center + outer * cos,
      y2: center + outer * sin,
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
          <MaterialIcons name="more-horiz" size={18} color={theme.text.secondary} />
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
          {paceTick && (
            <Line
              x1={paceTick.x1}
              y1={paceTick.y1}
              x2={paceTick.x2}
              y2={paceTick.y2}
              stroke={theme.text.primary}
              strokeWidth={PACE_TICK_STROKE}
              strokeLinecap="round"
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

      <Text style={[styles.name, { color: theme.text.primary }]} numberOfLines={1}>
        {activityName.toUpperCase()}
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
    fontSize: 28,
    fontWeight: '700',
    includeFontPadding: false,
  },
  ringTarget: {
    fontSize: 13,
    fontWeight: '500',
    includeFontPadding: false,
    marginTop: 2,
  },
  name: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  unit: {
    fontSize: 11,
    textAlign: 'center',
  },
});
