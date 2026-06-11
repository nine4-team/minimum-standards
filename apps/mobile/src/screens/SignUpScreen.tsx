import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GoogleAuthProvider } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { AuthStackParamList } from '../navigation/types';
import { signUpSchema, SignUpFormData } from '../schemas/authSchemas';
import { AuthError } from '../utils/errors';
import { logAuthErrorToCrashlytics } from '../utils/crashlytics';
import { useTheme } from '../theme/useTheme';
import { typography } from '@nine4/ui-kit';
import { firebaseAuth } from '../firebase/firebaseApp';
import { normalizeGoogleSignInResult } from '../utils/googleSignInResult';
import { useAuthStore } from '../stores/authStore';

// Extend AuthError to handle Google Sign-In errors
function createAuthErrorFromAnyError(err: any): AuthError {
  // Log the error for debugging
  console.error('Google Sign-In error:', err);
  
  // Check if it's a Google Sign-In error (has code property)
  if (err?.code && typeof err.code === 'string') {
    return AuthError.fromFirebaseError(err);
  }
  // Otherwise wrap it as unknown error
  return AuthError.fromFirebaseError(err);
}

type NavigationProp = NativeStackNavigationProp<AuthStackParamList>;

export function SignUpScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const setUser = useAuthStore((state) => state.setUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: '',
      password: '',
      passwordConfirmation: '',
    },
  });

  const onSubmit = async (data: SignUpFormData) => {
    try {
      setLoading(true);
      setError(null);
      const userCredential = await firebaseAuth.createUserWithEmailAndPassword(data.email, data.password);
      setUser(userCredential?.user ?? firebaseAuth.currentUser ?? null);
      // User is automatically signed in, navigation handled by AppNavigator
    } catch (err) {
      const authError = AuthError.fromFirebaseError(err);
      logAuthErrorToCrashlytics(authError, 'sign_up');
      setError(authError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    // Log immediately to verify function is called
    console.log('=== GOOGLE SIGN-UP BUTTON PRESSED ===');
    console.log('[Google Sign-Up] Starting Google Sign-Up flow...');
    
    try {
      setLoading(true);
      setError(null);

      // Check if Google Play Services are available (Android only)
      if (Platform.OS === 'android') {
        console.log('[Google Sign-Up] Checking Google Play Services...');
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        console.log('[Google Sign-Up] Google Play Services available');
      }

      // Get the user's ID token
      console.log('[Google Sign-Up] Calling GoogleSignin.signIn() (no cached session wipe)...');
      const signInResult = await GoogleSignin.signIn();

      const normalizedResult = normalizeGoogleSignInResult(signInResult);
      if (!normalizedResult.success || !normalizedResult.data) {
        console.log('[Google Sign-Up] User cancelled sign-in during success response');
        return;
      }

      const {
        idToken: embeddedIdToken,
        accessToken: embeddedAccessToken,
        user,
      } = normalizedResult.data;

      console.log('[Google Sign-Up] Sign-in result received:', {
        hasEmbeddedIdToken: !!embeddedIdToken,
        user: user
          ? {
              email: user.email,
              name: user.name,
            }
          : null,
      });

      let tokens: { idToken?: string | null; accessToken?: string | null } = {};
      try {
        tokens = await GoogleSignin.getTokens();
      } catch (tokenError) {
        console.warn('[Google Sign-Up] Failed to fetch tokens via getTokens:', tokenError);
      }
      const resolvedIdToken = tokens.idToken || embeddedIdToken;
      const resolvedAccessToken = tokens.accessToken || embeddedAccessToken || undefined;

      if (!resolvedIdToken) {
        console.error('[Google Sign-Up] No ID token available after Google Sign-In');
        throw new Error('No ID token received from Google Sign-In');
      }

      // Create a Google credential with the token
      // accessToken is optional and may not be present on iOS
      console.log('[Google Sign-Up] Creating Firebase credential...');
      const googleCredential = GoogleAuthProvider.credential(
        resolvedIdToken,
        resolvedAccessToken
      );

      // Sign in/up the user with the credential (Firebase automatically creates account if new)
      console.log('[Google Sign-Up] Signing in with Firebase credential...');
      const userCredential = await firebaseAuth.signInWithCredential(googleCredential);
      setUser(userCredential?.user ?? firebaseAuth.currentUser ?? null);
      console.log('[Google Sign-Up] Successfully signed in with Firebase');
      // Navigation will be handled by AppNavigator based on auth state
    } catch (err: any) {
      console.error('[Google Sign-Up] Error occurred:', {
        code: err.code,
        message: err.message,
        error: err,
        stack: err.stack,
      });

      // Handle Google Sign-In specific errors
      if (err.code === 'SIGN_IN_CANCELLED' || err.code === '12501') {
        // User cancelled the sign-in flow, don't show error
        // 12501 is the Android error code for user cancellation
        console.log('[Google Sign-Up] User cancelled sign-in');
        setLoading(false);
        return;
      }

      const authError = createAuthErrorFromAnyError(err);
      logAuthErrorToCrashlytics(authError, 'google_sign_up');
      setError(authError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background.screen }]} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text.primary }]}>Sign Up</Text>
        <Text style={[styles.subtitle, { color: theme.text.secondary }]}>Create your account</Text>
      </View>

      <View style={[styles.card, { backgroundColor: theme.background.card, shadowColor: theme.shadow }]}>
        {error && (
          <View style={[styles.errorContainer, { backgroundColor: theme.status.missed.background }]}>
            <Text style={[styles.errorText, { color: theme.status.missed.text }]}>{error}</Text>
          </View>
        )}

        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.text.primary }]}>Email</Text>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.input.background,
                    borderColor: errors.email ? theme.input.borderError : theme.input.border,
                    color: theme.input.text,
                  },
                ]}
                placeholder="Enter your email"
                placeholderTextColor={theme.input.placeholder}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            )}
          />
          {errors.email && (
            <Text style={[styles.fieldError, { color: theme.status.missed.text }]}>{errors.email.message}</Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.text.primary }]}>Password</Text>
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.input.background,
                    borderColor: errors.password ? theme.input.borderError : theme.input.border,
                    color: theme.input.text,
                  },
                ]}
                placeholder="Enter your password"
                placeholderTextColor={theme.input.placeholder}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
                autoComplete="password-new"
              />
            )}
          />
          {errors.password && (
            <Text style={[styles.fieldError, { color: theme.status.missed.text }]}>{errors.password.message}</Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.text.primary }]}>Confirm Password</Text>
          <Controller
            control={control}
            name="passwordConfirmation"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.input.background,
                    borderColor: errors.passwordConfirmation ? theme.input.borderError : theme.input.border,
                    color: theme.input.text,
                  },
                ]}
                placeholder="Confirm your password"
                placeholderTextColor={theme.input.placeholder}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
                autoComplete="password-new"
              />
            )}
          />
          {errors.passwordConfirmation && (
            <Text style={[styles.fieldError, { color: theme.status.missed.text }]}>{errors.passwordConfirmation.message}</Text>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            { backgroundColor: theme.button.primary.background },
            loading && styles.buttonDisabled,
          ]}
          onPress={handleSubmit(onSubmit)}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.button.primary.text} />
          ) : (
            <Text style={[styles.primaryButtonText, { fontSize: typography.button.primary.fontSize, fontWeight: typography.button.primary.fontWeight, color: theme.button.primary.text }]}>Sign Up</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={[styles.dividerText, { color: theme.text.tertiary }]}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={[
            styles.secondaryButton,
            {
              backgroundColor: theme.button.secondary.background,
              borderColor: theme.border.primary,
            },
            loading && styles.buttonDisabled,
          ]}
          onPress={handleGoogleSignUp}
          disabled={loading}
        >
          <Text style={[styles.secondaryButtonText, { fontSize: typography.button.secondary.fontSize, fontWeight: typography.button.secondary.fontWeight, color: theme.button.secondary.text }]}>Sign up with Google</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.text.secondary }]}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
            <Text style={[styles.footerLink, { color: theme.link }]}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingTop: 48,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  card: {
    borderRadius: 12,
    padding: 24,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  errorContainer: {
    backgroundColor: '#fee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#c00',
    fontSize: 14,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  fieldError: {
    color: '#c00',
    fontSize: 12,
    marginTop: 4,
  },
  primaryButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    // fontSize and fontWeight come from typography.button.primary
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    // fontSize and fontWeight come from typography.button.secondary
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#999',
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});
