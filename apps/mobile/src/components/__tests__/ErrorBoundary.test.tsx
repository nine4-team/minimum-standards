import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ErrorBoundary } from '../ErrorBoundary';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('../../firebase/firebaseApp', () => ({
  firebaseAuth: {
    currentUser: { uid: 'test-user-123' },
  },
}));

// Mock Crashlytics (optional dependency)
const mockCrashlytics = {
  setUserId: jest.fn(),
  log: jest.fn(),
  setAttribute: jest.fn(),
  recordError: jest.fn(),
};

jest.mock('@react-native-firebase/crashlytics', () => {
  try {
    return {
      __esModule: true,
      default: jest.fn(() => mockCrashlytics),
    };
  } catch {
    return null;
  }
});

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('catches unhandled exceptions', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByText(/A database error occurred. Please try again/i)).toBeTruthy();
  });

  test('Crashlytics logging includes Firebase auth UID', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    // Verify Crashlytics was called with user ID
    expect(mockCrashlytics.setUserId).toHaveBeenCalledWith('test-user-123');
    expect(mockCrashlytics.recordError).toHaveBeenCalled();
  });

  test('displays user-friendly error message', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    // Should show user-friendly message, not raw error
    expect(getByText(/Something went wrong/i)).toBeTruthy();
    // Should NOT show raw error message
    expect(() => getByText('Test error')).toThrow();
  });

  test('retry button resets error state', () => {
    const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
      if (shouldThrow) {
        throw new Error('Test error');
      }
      return <Text>Success</Text>;
    };

    const { getByText, rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText('Something went wrong')).toBeTruthy();

    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    const retryButton = getByText('Retry');
    fireEvent.press(retryButton);

    expect(getByText('Success')).toBeTruthy();
  });

  test('uses custom fallback if provided', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    const customFallback = <Text>Custom Error UI</Text>;

    const { getByText } = render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(getByText('Custom Error UI')).toBeTruthy();
    expect(() => getByText('Something went wrong')).toThrow();
  });

  test('calls onError callback when error occurs', () => {
    const onError = jest.fn();
    const ThrowError = () => {
      throw new Error('Test error');
    };

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalled();
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][1]).toHaveProperty('componentStack');
  });

  test('does not crash if onError callback throws', () => {
    const onError = jest.fn(() => {
      throw new Error('Callback failed');
    });
    const ThrowError = () => {
      throw new Error('Test error');
    };

    const { getByText } = render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalled();
    expect(getByText('Something went wrong')).toBeTruthy();
  });
});
