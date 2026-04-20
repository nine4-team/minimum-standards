import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';

const functions = getFunctions(getApp());

/**
 * Call a Cloud Function by name.
 * Returns the `.data` property from the callable result.
 */
export async function callFunction<T = any>(name: string, data?: any): Promise<T> {
  const callable = httpsCallable<any, T>(functions, name);
  const result = await callable(data);
  return result.data;
}
