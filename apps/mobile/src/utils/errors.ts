/**
 * Normalized error classes for Firebase errors.
 * These classes wrap Firebase SDK errors with stable codes for analytics and retry logic.
 */

/**
 * Base interface for Firebase errors with a code property.
 */
interface FirebaseErrorLike {
  code?: string;
  message?: string;
}

/**
 * Base class for normalized Firebase errors.
 */
export abstract class NormalizedFirebaseError extends Error {
  abstract readonly code: string;
  readonly originalError: unknown;

  constructor(message: string, originalError: unknown) {
    super(message);
    this.name = this.constructor.name;
    Object.defineProperty(this, 'originalError', {
      value: originalError,
      writable: false,
      enumerable: false,
      configurable: false,
    });
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error class for Firebase Auth errors.
 * Wraps Firebase Auth SDK errors with stable code and user-friendly message.
 */
export class AuthError extends NormalizedFirebaseError {
  readonly code: string;

  constructor(code: string, message: string, originalError: unknown) {
    super(message, originalError);
    this.code = code;
  }

  /**
   * Creates an AuthError from a Firebase Auth error.
   */
  static fromFirebaseError(error: unknown): AuthError {
    if (error instanceof AuthError) {
      return error;
    }

    // Firebase Auth errors have a code property
    const firebaseError = error as FirebaseErrorLike;
    const code = firebaseError.code || 'auth/unknown-error';
    const message = getAuthErrorMessage(code, firebaseError.message);
    
    return new AuthError(code, message, error);
  }
}

/**
 * Error class for Firestore errors.
 * Wraps Firestore SDK errors with stable code and user-friendly message.
 */
export class FirestoreError extends NormalizedFirebaseError {
  readonly code: string;

  constructor(code: string, message: string, originalError: unknown) {
    super(message, originalError);
    this.code = code;
  }

  /**
   * Creates a FirestoreError from a Firebase Firestore error.
   */
  static fromFirebaseError(error: unknown): FirestoreError {
    if (error instanceof FirestoreError) {
      return error;
    }

    // Firestore errors have a code property
    const firestoreError = error as FirebaseErrorLike;
    const rawCode = firestoreError.code || 'firestore/unknown-error';
    const code = rawCode.startsWith('firestore/')
      ? rawCode
      : `firestore/${rawCode}`;
    const message = getFirestoreErrorMessage(code);
    
    return new FirestoreError(code, message, error);
  }

  /**
   * Checks if this error is a transient error that can be retried.
   */
  isRetryable(): boolean {
    const retryableCodes = [
      'firestore/unavailable',
      'firestore/deadline-exceeded',
      'firestore/resource-exhausted',
      'firestore/aborted',
      'firestore/internal',
    ];
    return retryableCodes.includes(this.code);
  }

  /**
   * Checks if this error is a permission error.
   */
  isPermissionError(): boolean {
    return this.code === 'firestore/permission-denied';
  }
}

/**
 * Maps Firebase Auth error codes to user-friendly messages.
 */
function sanitizeUserVisibleErrorMessage(message: string): string {
  // Be conservative: avoid accidentally echoing user identifiers back to the UI.
  // (Firebase errors sometimes include emails.)
  const emailRedacted = message.replace(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    '[redacted email]'
  );
  // Keep UX concise; long native errors are rarely helpful.
  return emailRedacted.length > 200 ? `${emailRedacted.slice(0, 200)}…` : emailRedacted;
}

function getAuthErrorMessage(code: string, rawMessage?: string): string {
  const messageMap: Record<string, string> = {
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/weak-password': 'Password is too weak.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/operation-not-allowed':
      'This sign-in method is not enabled right now. Please contact support.',
    'auth/too-many-requests': 'Too many requests. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your connection and retry.',
    'auth/invalid-credential': 'Invalid credentials.',
    'auth/account-exists-with-different-credential':
      'An account already exists for this email using a different sign-in method. Try signing in with email/password, then link Google in settings.',
    'auth/credential-already-in-use':
      'This Google account is already linked to another account. Try signing in with Google instead.',
    'auth/provider-already-linked': 'This sign-in method is already linked to your account.',
    'auth/requires-recent-login': 'Please sign in again to continue.',
    // Google Sign-In specific errors
    'SIGN_IN_CANCELLED': 'Sign in was cancelled.',
    '12501': 'Sign in was cancelled.', // Android error code for user cancellation
    'IN_PROGRESS': 'Another sign in is in progress.',
    'PLAY_SERVICES_NOT_AVAILABLE': 'Google Play Services is not available.',
    'SIGN_IN_REQUIRED': 'Please sign in to continue.',
    '10': 'Google Sign-In configuration error. Please contact support.',
    'DEVELOPER_ERROR': 'Google Sign-In configuration error. Verify SHA1/package name and web client ID.',
    '7': 'Network error. Check your connection and retry.',
    '8': 'An internal error occurred. Please try again.',
    '12500': 'Sign in failed. Please try again.',

    // iOS GoogleSignIn (GIDSignIn) error codes sometimes surface as negative integers.
    // These are intentionally user-facing since they explain why Google sign-in can't proceed.
    '-5': 'Sign in was cancelled.',
    '-4': 'No previous Google sign-in found on this device. Please try signing in again.',
    '-2': 'Sign in could not access saved credentials. Please try again.',
    '-1': 'Google Sign-In failed. Please try again.',
  };

  const mapped = messageMap[code];
  if (mapped) {
    return mapped;
  }

  const safeRawMessage =
    typeof rawMessage === 'string' && rawMessage.trim().length > 0
      ? sanitizeUserVisibleErrorMessage(rawMessage.trim())
      : undefined;

  // Provide a supportable error string even for unknown codes.
  // Including the code helps us debug without being overly technical.
  if (safeRawMessage) {
    return `${safeRawMessage} (code: ${code})`;
  }
  return `Authentication failed (code: ${code}). Please try again.`;
}

/**
 * Maps Firebase Firestore error codes to user-friendly messages.
 */
function getFirestoreErrorMessage(code: string): string {
  const messageMap: Record<string, string> = {
    'firestore/permission-denied': 'You do not have permission to perform this action.',
    'firestore/unavailable': 'Service temporarily unavailable. Please try again.',
    'firestore/deadline-exceeded': 'Request timed out. Please try again.',
    'firestore/resource-exhausted': 'Too many requests. Please try again later.',
    'firestore/aborted': 'Request was cancelled. Please try again.',
    'firestore/out-of-range': 'Request is out of range.',
    'firestore/unimplemented': 'This operation is not supported.',
    'firestore/internal': 'An internal error occurred. Please try again.',
    'firestore/not-found': 'The requested resource was not found.',
    'firestore/already-exists': 'This resource already exists.',
    'firestore/failed-precondition': 'Operation cannot be completed in current state.',
    'firestore/cancelled': 'Operation was cancelled.',
    'firestore/data-loss': 'Data loss detected.',
    'firestore/unauthenticated': 'Authentication required. Please sign in.',
  };

  return messageMap[code] || 'A database error occurred. Please try again.';
}

/**
 * Converts any Firebase error to a normalized error class.
 * Determines if it's an Auth or Firestore error based on the error structure.
 */
export function normalizeFirebaseError(error: unknown): AuthError | FirestoreError {
  const firebaseError = error as FirebaseErrorLike;
  
  if (!firebaseError.code) {
    // If no code, try to determine from error message or structure
    const errorMessage = firebaseError.message || String(error);
    if (errorMessage.includes('auth') || errorMessage.includes('Auth')) {
      return AuthError.fromFirebaseError(error);
    }
    return FirestoreError.fromFirebaseError(error);
  }

  // Determine error type from code prefix
  if (firebaseError.code.startsWith('auth/')) {
    return AuthError.fromFirebaseError(error);
  } else if (firebaseError.code.startsWith('firestore/') || firebaseError.code.startsWith('cancelled') || firebaseError.code.startsWith('unknown')) {
    return FirestoreError.fromFirebaseError(error);
  }

  // Default to FirestoreError for unknown Firebase errors
  return FirestoreError.fromFirebaseError(error);
}
