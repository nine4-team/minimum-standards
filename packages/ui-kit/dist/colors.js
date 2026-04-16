"use strict";
/**
 * Centralized color theme for the application.
 * All non-error colors should be defined here and referenced throughout the app.
 * Error colors may be hard-coded where needed for error states.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.darkTheme = exports.lightTheme = void 0;
exports.getStatusColors = getStatusColors;
exports.lightTheme = {
    status: {
        met: {
            background: '#F5F3EF',
            text: '#987e55',
            bar: '#987e55',
            barComplete: '#4A7C59',
            barOverflow: '#34C77C',
        },
        inProgress: {
            background: '#FFF8E1',
            text: '#B06E00',
            bar: '#F4B400',
        },
        missed: {
            background: '#FCE8E6',
            text: '#C5221F',
            bar: '#C5221F',
        },
    },
    primary: {
        main: '#000',
        light: '#666',
        dark: '#111',
    },
    background: {
        screen: '#f7f8fa',
        chrome: '#fff',
        surface: '#fff',
        primary: '#f7f8fa',
        secondary: '#fff',
        tertiary: '#fafafa',
        card: '#fff',
        modal: '#fff',
        overlay: 'rgba(0, 0, 0, 0.5)',
    },
    text: {
        primary: '#111',
        secondary: '#666',
        tertiary: '#999',
        disabled: '#ccc',
        inverse: '#fff',
    },
    border: {
        primary: '#ddd',
        secondary: '#e0e0e0',
        focus: '#000',
    },
    tabBar: {
        background: '#F9F9F9',
        activeTint: '#987e55',
        inactiveTint: '#999',
        border: '#e0e0e0',
    },
    button: {
        primary: {
            background: '#987e55',
            text: '#fff',
        },
        secondary: {
            background: '#f0f0f0',
            text: '#333',
        },
        disabled: {
            background: '#ccc',
            text: '#fff',
        },
        destructive: {
            background: '#987e55',
            text: '#fff',
        },
        icon: {
            background: '#F5F3EF',
            icon: '#987e55',
        },
    },
    input: {
        background: '#fff',
        border: '#ddd',
        borderError: '#c00',
        text: '#333',
        placeholder: '#999',
    },
    shadow: '#000',
    divider: '#e0e0e0',
    activityIndicator: '#000',
    link: '#000',
    archive: {
        background: '#ffebee',
        text: '#d32f2f',
        badgeBackground: '#FDECEA',
        badgeText: '#C64B30',
    },
};
exports.darkTheme = {
    status: {
        met: {
            background: '#3D3224',
            text: '#987e55',
            bar: '#987e55',
            barComplete: '#4A7C59',
            barOverflow: '#3DD598',
        },
        inProgress: {
            background: '#3E2E1A',
            text: '#FFC107',
            bar: '#FFC107',
        },
        missed: {
            background: '#3E1E1E',
            text: '#EF5350',
            bar: '#EF5350',
        },
    },
    primary: {
        main: '#fff',
        light: '#B0B0B0',
        dark: '#000',
    },
    background: {
        screen: '#1E1E1E',
        chrome: '#1E1E1E',
        surface: '#2E2E2E',
        primary: '#1E1E1E',
        secondary: '#2E2E2E',
        tertiary: '#323232',
        card: '#2E2E2E',
        modal: '#2E2E2E',
        overlay: 'rgba(0, 0, 0, 0.5)',
    },
    text: {
        primary: '#E0E0E0',
        secondary: '#B0B0B0',
        tertiary: '#888',
        disabled: '#666',
        inverse: '#111',
    },
    border: {
        primary: '#4A4A4C',
        secondary: '#4A4A4C',
        focus: '#fff',
    },
    tabBar: {
        // Keep chrome aligned with the primary screen container in dark mode
        background: '#1E1E1E',
        activeTint: '#987e55',
        inactiveTint: '#888',
        border: '#4A4A4C',
    },
    button: {
        primary: {
            background: '#987e55',
            text: '#fff',
        },
        secondary: {
            background: '#333',
            text: '#E0E0E0',
        },
        disabled: {
            background: '#666',
            text: '#B0B0B0',
        },
        destructive: {
            background: '#987e55',
            text: '#fff',
        },
        icon: {
            background: '#3D3224',
            icon: '#987e55',
        },
    },
    input: {
        background: '#2E2E2E',
        border: '#4A4A4C',
        borderError: '#EF5350',
        text: '#E0E0E0',
        placeholder: '#888',
    },
    shadow: '#000',
    divider: '#4A4A4C',
    activityIndicator: '#fff',
    link: '#fff',
    archive: {
        background: '#3E1E1E',
        text: '#EF5350',
        badgeBackground: '#3E1E1E',
        badgeText: '#EF5350',
    },
};
/**
 * Get status colors for a given status string
 */
function getStatusColors(theme, status) {
    switch (status) {
        case 'Met':
            return theme.status.met;
        case 'In Progress':
            return theme.status.inProgress;
        case 'Missed':
            return theme.status.missed;
        default:
            return theme.status.missed;
    }
}
//# sourceMappingURL=colors.js.map