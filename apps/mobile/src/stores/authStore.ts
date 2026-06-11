import { create } from 'zustand';
import {
  FirebaseAuthTypes,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
} from '@react-native-firebase/auth';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { firebaseAuth } from '../firebase/firebaseApp';
import { normalizeGoogleSignInResult } from '../utils/googleSignInResult';

export interface AuthState {
  // Current authenticated user
  user: FirebaseAuthTypes.User | null;
  setUser: (user: FirebaseAuthTypes.User | null) => void;

  // Whether auth state has been initialized
  isInitialized: boolean;
  setInitialized: (isInitialized: boolean) => void;

  // Sign out action
  signOut: () => Promise<void>;
  // Optional helper to clear cached Google session when user explicitly requests it
  clearGoogleSession: () => Promise<void>;

  // Initialize auth state listener (call once on app startup)
  initialize: () => () => void; // Returns cleanup function
}

const initialState = {
  user: null,
  isInitialized: false,
};

// Store the unsubscribe function globally to prevent duplicate listeners
let unsubscribeAuthState: (() => void) | null = null;
let hasAttemptedSilentSignIn = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  ...initialState,

  setUser: (user) => {
    set({ user });
  },

  setInitialized: (isInitialized) => {
    set({ isInitialized });
  },

  signOut: async () => {
    console.log('[AuthStore] Signing out...');
    try {
      await firebaseSignOut(firebaseAuth);
    } catch (error) {
      console.error('[AuthStore] Error during Firebase sign out:', error);
    }
    // Prevent background silent-sign-in retries until the next full initialize run.
    hasAttemptedSilentSignIn = true;
    set({ user: null });
  },

  clearGoogleSession: async () => {
    console.log('[AuthStore] Clearing cached Google session on explicit request...');
    try {
      const googleSignin = GoogleSignin as unknown as {
        isSignedIn?: () => Promise<boolean>;
        signOut: () => Promise<void>;
      };
      if (!googleSignin.isSignedIn || (await googleSignin.isSignedIn())) {
        await googleSignin.signOut();
      }
    } catch (error) {
      console.error('[AuthStore] Error clearing Google session:', error);
    }
  },

  initialize: () => {
    console.log('[AuthStore] Starting auth initialization...');
    hasAttemptedSilentSignIn = false;
    
    // Prevent duplicate listeners
    if (unsubscribeAuthState) {
      console.log('[AuthStore] Already initialized, skipping duplicate initialization');
      // Return a no-op cleanup function if already initialized
      return () => {
        // Already initialized, cleanup handled elsewhere
      };
    }

    // Check current user synchronously to set initial state immediately
    // This prevents showing the sign-in screen if user is already authenticated
    console.log('[AuthStore] Checking current user synchronously...');
    try {
      const currentUser = firebaseAuth.currentUser;
      const uid = currentUser?.uid;
      console.log('[AuthStore] Current user check result:', uid ? `User ID: ${uid}` : 'No current user');
      if (currentUser && uid) {
        console.log('[AuthStore] Authenticated user UID available for Firestore operations:', uid);
        console.log('[AuthStore] Setting initial state with current user');
        set({ user: currentUser, isInitialized: true });
      } else {
        console.warn('[AuthStore] No authenticated user found in synchronous check');
      }
    } catch (error) {
      console.error('[AuthStore] ERROR: Failed to check current user:', error);
      // Continue with initialization even if current user check fails
    }

    // Timeout fallback: if onAuthStateChanged doesn't fire within 10 seconds,
    // assume no user and proceed (prevents infinite loading screen)
    // Increased from 3s to 10s to give more time for network and silent sign-in
    console.log('[AuthStore] Setting up 10s timeout fallback...');
    const timeoutId = setTimeout(() => {
      console.log('[AuthStore] Timeout fired - checking initialization state...');
      const state = get();
      if (!state.isInitialized) {
        console.warn('[AuthStore] Auth initialization timeout - proceeding without auth state');
        set({ user: null, isInitialized: true });
      } else {
        console.log('[AuthStore] Timeout fired but already initialized, ignoring');
      }
    }, 10000);

    // Helper to attempt a Google silent sign-in if Firebase has no user
    const attemptSilentGoogleSignIn = async (): Promise<FirebaseAuthTypes.User | null> => {
      if (hasAttemptedSilentSignIn) {
        return null;
      }
      hasAttemptedSilentSignIn = true;
      console.log('[AuthStore] Attempting Google silent sign-in to restore session...');

      try {
        const silentResult = await GoogleSignin.signInSilently();
        const normalizedResult = normalizeGoogleSignInResult(silentResult);
        const idToken = normalizedResult.data?.idToken;
        const accessToken = normalizedResult.data?.accessToken ?? undefined;

        if (!idToken) {
          console.warn('[AuthStore] Silent sign-in succeeded but no ID token was returned');
          return null;
        }

        const credential = GoogleAuthProvider.credential(idToken, accessToken || undefined);
        const userCredential = await firebaseAuth.signInWithCredential(credential);
        const restoredUser = userCredential?.user ?? firebaseAuth.currentUser ?? null;
        console.log('[AuthStore] Silent Google sign-in succeeded - Firebase credential applied');
        return restoredUser;
      } catch (error: any) {
        const errorCode = error?.code;
        if (
          errorCode === statusCodes.SIGN_IN_REQUIRED ||
          errorCode === 'SIGN_IN_REQUIRED' ||
          errorCode === '4'
        ) {
          console.log('[AuthStore] No cached Google session to restore silently');
        } else {
          console.warn('[AuthStore] Google silent sign-in failed:', errorCode, error?.message || error);
        }
        return null;
      }
    };

    // Set up auth state listener for future changes
    console.log('[AuthStore] Setting up onAuthStateChanged listener...');
    console.log('[AuthListener] Registering Firebase auth state listener');
    try {
      unsubscribeAuthState = onAuthStateChanged(firebaseAuth, async (user) => {
        console.log('[AuthListener] onAuthStateChanged fired', {
          uid: user?.uid,
          email: user?.email,
        });
        console.log('[AuthStore] [Remediation] onAuthStateChanged callback reached');
        let nextUser = user;
        let uid = nextUser?.uid;
        console.log('[AuthStore] onAuthStateChanged callback fired:', uid ? `User ID: ${uid}` : 'No user');
        
        // If no Firebase user is found, try to sign in silently with Google
        // This handles cases where the Firebase session expired but the Google session is still valid
        if (!nextUser) {
          nextUser = await attemptSilentGoogleSignIn();
          uid = nextUser?.uid;
        }

        if (uid) {
          console.log('[AuthStore] Authenticated user UID available for Firestore operations:', uid);
        } else {
          console.warn('[AuthStore] No authenticated user - Firestore operations will fail');
        }
        
        clearTimeout(timeoutId);
        set({ user: nextUser ?? null, isInitialized: true });
      });
      console.log('[AuthStore] onAuthStateChanged listener registered successfully');
    } catch (error) {
      console.error('[AuthStore] ERROR: Failed to set up onAuthStateChanged listener:', error);
      // Clear timeout and set initialized to true to prevent infinite loading
      clearTimeout(timeoutId);
      set({ user: null, isInitialized: true });
    }

    // Return cleanup function
    const cleanup = () => {
      console.log('[AuthStore] Cleanup called');
      clearTimeout(timeoutId);
      if (unsubscribeAuthState) {
        unsubscribeAuthState();
        unsubscribeAuthState = null;
      }
    };
    return cleanup;
  },
}));
