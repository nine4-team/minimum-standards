import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Config from 'react-native-config';
import { Platform } from 'react-native';
import { googleSignInWebClientId } from '../config/googleSignIn';

type GoogleSignInConfigPlatform = 'ios' | 'android' | 'macos' | 'windows' | 'web' | 'native';

export function buildGoogleSignInConfig({
  platform,
  webClientId,
  iosClientId,
}: {
  platform: GoogleSignInConfigPlatform;
  webClientId: string;
  iosClientId?: string;
}) {
  return {
    webClientId,
    ...(platform === 'ios' && iosClientId ? { iosClientId } : {}),
    offlineAccess: false,
    scopes: ['email', 'profile'],
  };
}

/**
 * Initializes Google Sign-In with Firebase configuration.
 * Call this once during app startup (e.g., in App.tsx).
 * 
 * Note: Configure the Android webClientId in your .env file.
 * Get it from Firebase Console > Authentication > Sign-in method > Google > Web client ID
 */
export function initializeGoogleSignIn() {
  console.log('[Google Sign-In] Initializing Google Sign-In...');
  const webClientId = Config.GOOGLE_SIGN_IN_WEB_CLIENT_ID || googleSignInWebClientId;
  const iosClientId =
    Config.GOOGLE_SIGN_IN_IOS_CLIENT_ID ||
    '1055581806274-1n5keauch2qufmqirdcnvrdl8221q6m6.apps.googleusercontent.com';

  // `webClientId` is required to obtain a Google ID token for Firebase auth.
  if (!webClientId) {
    console.error(
      '[Google Sign-In] ERROR: webClientId not configured. ' +
      'Set GOOGLE_SIGN_IN_WEB_CLIENT_ID in your .env file. ' +
      'See .env.example for reference.'
    );
    return;
  }

  const redactedWebClientId = webClientId ? `${webClientId.substring(0, 20)}...` : '(not set)';
  console.log('[Google Sign-In] Configuring Google Sign-In', {
    platform: Platform.OS,
    hasWebClientId: !!webClientId,
    webClientId: redactedWebClientId,
    hasIosClientId: !!iosClientId,
  });
  try {
    GoogleSignin.configure(
      buildGoogleSignInConfig({
        platform: Platform.OS,
        webClientId,
        iosClientId,
      })
    );
    console.log('[Google Sign-In] Google Sign-In configured successfully');
  } catch (error) {
    console.error('[Google Sign-In] Error configuring Google Sign-In:', error);
  }
}
