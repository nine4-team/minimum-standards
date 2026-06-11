import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAuthStore } from '../authStore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, onAuthStateChanged } from '@react-native-firebase/auth';
import { firebaseAuth } from '../../firebase/firebaseApp';

const { __mockAuthInstance } = jest.requireMock('@react-native-firebase/auth');

describe('authStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __mockAuthInstance.currentUser = { uid: 'test-user-id' };
    // Reset store state before each test
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.setUser(null);
      result.current.setInitialized(false);
    });
  });

  test('auth store initializes with isInitialized: false and user: null', () => {
    const { result } = renderHook(() => useAuthStore());

    expect(result.current.isInitialized).toBe(false);
    expect(result.current.user).toBeNull();
  });

  test('setUser updates user state', () => {
    const { result } = renderHook(() => useAuthStore());
    const mockUser = {
      uid: 'test-user-id',
      email: 'test@example.com',
    } as any;

    act(() => {
      result.current.setUser(mockUser);
    });

    expect(result.current.user).toEqual(mockUser);
  });

  test('setInitialized updates initialization state', () => {
    const { result } = renderHook(() => useAuthStore());

    act(() => {
      result.current.setInitialized(true);
    });

    expect(result.current.isInitialized).toBe(true);
  });

  test('signOut clears user state', async () => {
    const { result } = renderHook(() => useAuthStore());
    const mockUser = {
      uid: 'test-user-id',
      email: 'test@example.com',
    } as any;

    act(() => {
      result.current.setUser(mockUser);
    });

    expect(result.current.user).toEqual(mockUser);

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.user).toBeNull();
  });

  test('initialize restores a cached Google session without committing a null user', async () => {
    const restoredUser = {
      uid: 'restored-user-id',
      email: 'restored@example.com',
    } as any;

    __mockAuthInstance.currentUser = null;
    (firebaseAuth as any).currentUser = null;
    (onAuthStateChanged as jest.Mock).mockImplementationOnce((_authInstance, callback) => {
      callback(null);
      return jest.fn();
    });
    (GoogleSignin.signInSilently as jest.Mock).mockResolvedValueOnce({
      type: 'success',
      data: {
        idToken: 'restored-id-token',
        accessToken: 'restored-access-token',
      },
    });
    (firebaseAuth as any).signInWithCredential.mockResolvedValueOnce({ user: restoredUser });

    const { result } = renderHook(() => useAuthStore());
    let cleanup = () => {};

    act(() => {
      cleanup = result.current.initialize();
    });

    await waitFor(() => {
      expect(result.current.isInitialized).toBe(true);
      expect(result.current.user).toEqual(restoredUser);
    });
    expect(GoogleAuthProvider.credential).toHaveBeenCalledWith(
      'restored-id-token',
      'restored-access-token'
    );

    cleanup();
  });
});
