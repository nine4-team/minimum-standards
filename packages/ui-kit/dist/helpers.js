"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCardBorderStyle = getCardBorderStyle;
exports.getCardBaseStyle = getCardBaseStyle;
exports.getTabBarConstants = getTabBarConstants;
exports.getTabBarStyle = getTabBarStyle;
exports.getScreenContainerStyle = getScreenContainerStyle;
exports.getScreenHeaderStyle = getScreenHeaderStyle;
exports.getSectionTitleStyle = getSectionTitleStyle;
const react_native_1 = require("react-native");
/**
 * Get card border style (standardized border width and color)
 */
function getCardBorderStyle(theme) {
    return {
        borderWidth: 1,
        borderColor: theme.border.secondary,
    };
}
/**
 * Get card base style (border radius and overflow)
 */
function getCardBaseStyle(options = {}) {
    return {
        borderRadius: options.radius ?? 12,
        overflow: 'hidden',
    };
}
function getTabBarConstants() {
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
function getTabBarStyle(theme, insets) {
    const constants = getTabBarConstants();
    const baseTabBarHeight = react_native_1.Platform.OS === 'ios'
        ? constants.baseTabBarHeight.ios
        : constants.baseTabBarHeight.android;
    const baseBottomPadding = react_native_1.Platform.OS === 'ios'
        ? constants.baseBottomPadding.ios
        : constants.baseBottomPadding.android;
    const bottomPadding = react_native_1.Platform.OS === 'ios'
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
        height: react_native_1.Platform.OS === 'ios' ? baseTabBarHeight : undefined,
        minHeight: react_native_1.Platform.OS === 'ios' ? undefined : androidMinHeight,
    };
}
/**
 * Get screen container style
 */
function getScreenContainerStyle(theme) {
    return {
        flex: 1,
        backgroundColor: theme.background.screen,
    };
}
/**
 * Get screen header style
 */
function getScreenHeaderStyle(theme, insets) {
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
function getSectionTitleStyle(theme) {
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
//# sourceMappingURL=helpers.js.map