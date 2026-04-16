import { ViewStyle } from 'react-native';
import type { ColorTheme } from './colors';
import { Platform } from 'react-native';

/**
 * Get card border style (standardized border width and color)
 */
export function getCardBorderStyle(theme: ColorTheme): ViewStyle {
  return {
    borderWidth: 1,
    borderColor: theme.border.secondary,
  };
}

/**
 * Get card base style (border radius and overflow)
 */
export function getCardBaseStyle(options: { radius?: number } = {}): ViewStyle {
  return {
    borderRadius: options.radius ?? 12,
    overflow: 'hidden',
  };
}

/**
 * Tab bar constants for platform-specific sizing
 */
export interface TabBarConstants {
  baseTabBarHeight: {
    ios: number;
    android: number;
  };
  baseBottomPadding: {
    ios: number;
    android: number;
  };
}

export function getTabBarConstants(): TabBarConstants {
  return {
    baseTabBarHeight: {
      ios: 88,
      android: 64,
    },
    baseBottomPadding: {
      ios: 20,
      android: 12,
    },
  };
}

/**
 * Get tab bar style configuration
 */
export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export function getTabBarStyle(
  theme: ColorTheme,
  insets: SafeAreaInsets
): ViewStyle {
  const constants = getTabBarConstants();
  const baseTabBarHeight = Platform.OS === 'ios' 
    ? constants.baseTabBarHeight.ios 
    : constants.baseTabBarHeight.android;
  const baseBottomPadding = Platform.OS === 'ios' 
    ? constants.baseBottomPadding.ios 
    : constants.baseBottomPadding.android;
  const bottomPadding = Platform.OS === 'ios' 
    ? Math.max(insets.bottom, baseBottomPadding) 
    : baseBottomPadding;
  const androidMinHeight = baseTabBarHeight + bottomPadding;

  return {
    backgroundColor: 'transparent',
    borderTopWidth: 1,
    borderTopColor: theme.tabBar.border,
    elevation: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    paddingTop: 8,
    paddingLeft: Math.max(insets.left, 16),
    paddingRight: Math.max(insets.right, 16),
    paddingBottom: bottomPadding,
    height: Platform.OS === 'ios' ? baseTabBarHeight : undefined,
    minHeight: Platform.OS === 'ios' ? undefined : androidMinHeight,
  };
}

/**
 * Get screen container style
 */
export function getScreenContainerStyle(theme: ColorTheme): ViewStyle {
  return {
    flex: 1,
    backgroundColor: theme.background.screen,
  };
}

/**
 * Get screen header style
 */
export function getScreenHeaderStyle(
  theme: ColorTheme,
  insets: SafeAreaInsets
): ViewStyle {
  return {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: Math.max(insets.top, 12),
    backgroundColor: theme.background.chrome,
  };
}

/**
 * Get section title style (for use with Text component)
 */
export function getSectionTitleStyle(theme: ColorTheme): {
  fontSize: number;
  fontWeight: string;
  textTransform: string;
  marginBottom: number;
  marginLeft: number;
  letterSpacing: number;
  color: string;
} {
  return {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.5,
    color: theme.text.secondary,
  };
}
