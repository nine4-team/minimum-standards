import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { normalizeFirebaseError } from '../utils/errors';
import { firebaseAuth } from '../firebase/firebaseApp';
import { useTheme } from '../theme/useTheme';

function getCrashlytics() {
  try {
    const crashlyticsModule = require('@react-native-firebase/crashlytics');
    return crashlyticsModule.default();
  } catch {
    return null;
  }
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary component that catches unhandled exceptions
 * and logs fatal errors to Crashlytics.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to Crashlytics if available
    this.logToCrashlytics(error, errorInfo);

    // Call optional error handler
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (onErrorCallbackError) {
        console.warn('ErrorBoundary onError callback failed:', onErrorCallbackError);
      }
    }
  }

  private logToCrashlytics(error: Error, errorInfo: ErrorInfo) {
    const crashlytics = getCrashlytics();
    if (!crashlytics) {
      // Crashlytics not available, skip logging
      return;
    }

    try {
      // Set user identifier if authenticated
      const user = firebaseAuth.currentUser;
      if (user?.uid) {
        crashlytics.setUserId(user.uid);
      }

      // Normalize error to get stable code
      const normalizedError = normalizeFirebaseError(error);
      
      // Log structured error information
      crashlytics.log(`Error Boundary caught: ${normalizedError.code}`);
      crashlytics.setAttribute('error_code', normalizedError.code);
      crashlytics.setAttribute('error_name', error.name);
      
      if (errorInfo.componentStack) {
        crashlytics.setAttribute('component_stack', errorInfo.componentStack.substring(0, 500));
      }

      // Record the fatal error
      crashlytics.recordError(error);
    } catch (crashlyticsError) {
      // Fail silently if Crashlytics logging fails
      console.warn('Failed to log to Crashlytics:', crashlyticsError);
    }
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  onRetry: () => void;
}

function ErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  const theme = useTheme();
  const normalizedError = error ? normalizeFirebaseError(error) : null;
  const userMessage = normalizedError?.message || 'Something went wrong. Please try again.';

  return (
    <View style={[styles.container, { backgroundColor: theme.background.screen }]}>
      <View style={[styles.content, { backgroundColor: theme.background.card }]}>
        <Text style={[styles.title, { color: theme.text.primary }]}>Something went wrong</Text>
        <Text style={[styles.message, { color: theme.text.secondary }]}>
          {userMessage}
        </Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: theme.button.primary.background }]}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry"
        >
          <Text style={[styles.retryButtonText, { color: theme.button.primary.text }]}>Retry</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    borderRadius: 12,
    padding: 24,
    maxWidth: 400,
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
