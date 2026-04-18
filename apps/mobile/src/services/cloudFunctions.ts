// Centralized Cloud Functions callable stub.
//
// `@react-native-firebase/functions` is declared in package.json but install
// fails: v23.8+ requires Firebase/Auth=12.10.0 which in turn requires a higher
// iOS deployment target than this project currently sets. Fix is to bump the
// rest of the @react-native-firebase/* packages to 23.8.x and raise the iOS
// min target — tracked separately.
//
// When the package is eventually installed, only this file needs to change:
// replace the stub below with the real Firebase Functions import.

const functions: any = () => ({
  httpsCallable: (name: string) => async (data: any) => {
    throw Object.assign(new Error('Functions package not available'), {
      code: 'functions/unavailable',
    });
  },
});

/**
 * Call a Cloud Function by name.
 * Returns the `.data` property from the callable result.
 */
export async function callFunction<T = any>(name: string, data?: any): Promise<T> {
  const callable = functions().httpsCallable(name);
  const result = await callable(data);
  return result.data as T;
}
