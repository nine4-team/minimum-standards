import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SignInScreen } from '../SignInScreen';
import { logAuthErrorToCrashlytics } from '../../utils/crashlytics';
import { useAuthStore } from '../../stores/authStore';

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    hasPlayServices: jest.fn(() => Promise.resolve()),
    signInSilently: jest.fn(() =>
      Promise.reject({
        code: 'SIGN_IN_REQUIRED',
        message: 'No cached session',
      })
    ),
    signIn: jest.fn(() =>
      Promise.resolve({
        type: 'success',
        data: {
          idToken: 'token',
          user: {
            email: 'test@example.com',
            name: 'Tester',
          },
        },
      })
    ),
    getTokens: jest.fn(() =>
      Promise.resolve({
        idToken: 'token',
        accessToken: 'access',
      })
    ),
  },
}));

jest.mock('../../utils/crashlytics', () => ({
  logAuthErrorToCrashlytics: jest.fn(),
}));

jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn(),
    }),
  };
});

const authModule = require('@react-native-firebase/auth');
const mockAuthInstance = authModule.__mockAuthInstance;
const mockLogAuthErrorToCrashlytics = logAuthErrorToCrashlytics as jest.MockedFunction<typeof logAuthErrorToCrashlytics>;

describe('SignInScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().setUser(null);
  });

  test('renders email/password fields and Google button', () => {
    const { getByPlaceholderText, getByText } = render(<SignInScreen />);

    expect(getByPlaceholderText('Enter your email')).toBeTruthy();
    expect(getByPlaceholderText('Enter your password')).toBeTruthy();
    expect(getByText('Sign in with Google')).toBeTruthy();
  });

  test('logs auth error to Crashlytics when email/password sign in fails', async () => {
    const mockSignInWithEmailAndPassword =
      mockAuthInstance.signInWithEmailAndPassword as jest.MockedFunction<typeof mockAuthInstance.signInWithEmailAndPassword>;
    mockSignInWithEmailAndPassword.mockRejectedValueOnce({
      code: 'auth/invalid-credential',
      message: 'Invalid credential',
    });

    const { getByPlaceholderText, getAllByText } = render(<SignInScreen />);

    const emailInput = getByPlaceholderText('Enter your email');
    const passwordInput = getByPlaceholderText('Enter your password');
    const [, submitButton] = getAllByText('Sign In');

    fireEvent.changeText(emailInput, 'test@example.com');
    fireEvent.changeText(passwordInput, 'wrongpassword');
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(mockLogAuthErrorToCrashlytics).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'auth/invalid-credential' }),
        'sign_in'
      );
    });
  });

  test('logs auth error to Crashlytics when Google sign in fails', async () => {
    const { GoogleSignin } = require('@react-native-google-signin/google-signin');
    GoogleSignin.signIn.mockRejectedValueOnce({ 
      code: 'auth/network-request-failed', 
      message: 'Network error' 
    });

    const { getByText } = render(<SignInScreen />);

    const googleButton = getByText('Sign in with Google');
    fireEvent.press(googleButton);

    await waitFor(() => {
      expect(mockLogAuthErrorToCrashlytics).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'auth/network-request-failed' }),
        'google_sign_in'
      );
    });
  });

  test('stores Firebase user immediately after successful Google sign in', async () => {
    const firebaseUser = {
      uid: 'google-user-id',
      email: 'test@example.com',
    };
    mockAuthInstance.signInWithCredential.mockResolvedValueOnce({ user: firebaseUser });

    const { getByText } = render(<SignInScreen />);

    fireEvent.press(getByText('Sign in with Google'));

    await waitFor(() => {
      expect(useAuthStore.getState().user).toEqual(firebaseUser);
    });
  });
});
