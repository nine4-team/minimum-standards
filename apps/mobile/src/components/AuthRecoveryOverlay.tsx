import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/useTheme';

export function AuthRecoveryOverlay() {
  const theme = useTheme();

  return (
    <View
      style={[styles.overlay, { backgroundColor: theme.background.screen }]}
      accessibilityViewIsModal
      accessibilityRole="progressbar"
      accessibilityLabel="Reconnecting your account"
    >
      <ActivityIndicator color={theme.activityIndicator} />
      <Text style={[styles.title, { color: theme.text.primary }]}>Reconnecting…</Text>
      <Text style={[styles.message, { color: theme.text.secondary }]}>Your entries are safe.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  message: {
    fontSize: 14,
  },
});
