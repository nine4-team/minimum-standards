import {
  collection,
  doc,
  getDocs,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { ActivityHistoryDoc } from '@minimum-standards/shared-model';
import {
  ActivityHistoryFirestoreBindings,
  GetActivityHistoryDocParams,
  GetLatestHistoryForStandardParams,
  ListenActivityHistoryForStandardParams,
  SoftDeleteActivityHistoryDocParams,
  WriteActivityHistoryPeriodParams,
  createActivityHistoryHelpers,
} from '@minimum-standards/firestore-model';
import { firebaseFirestore } from '../firebase/firebaseApp';

const reactNativeBindings: ActivityHistoryFirestoreBindings = {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc: (reference: FirebaseFirestoreTypes.DocumentReference) => reference.get(),
  onSnapshot,
  setDoc: (
    reference: FirebaseFirestoreTypes.DocumentReference,
    data: ActivityHistoryDoc,
    options?: { merge?: boolean }
  ) => reference.set(data, options),
};

const {
  writeActivityHistoryPeriod: writeActivityHistoryPeriodInternal,
  getActivityHistoryDoc: getActivityHistoryDocInternal,
  softDeleteActivityHistoryDoc: softDeleteActivityHistoryDocInternal,
  getLatestHistoryForStandard: getLatestHistoryForStandardInternal,
  listenActivityHistoryForStandard: listenActivityHistoryForStandardInternal,
} = createActivityHistoryHelpers(reactNativeBindings);

export function writeActivityHistoryPeriod(
  params: Omit<WriteActivityHistoryPeriodParams, 'firestore'>
) {
  return writeActivityHistoryPeriodInternal({
    ...params,
    firestore: firebaseFirestore,
  });
}

export function getActivityHistoryDoc(
  params: Omit<GetActivityHistoryDocParams, 'firestore'>
) {
  return getActivityHistoryDocInternal({
    ...params,
    firestore: firebaseFirestore,
  });
}

export function softDeleteActivityHistoryDoc(
  params: Omit<SoftDeleteActivityHistoryDocParams, 'firestore'>
) {
  return softDeleteActivityHistoryDocInternal({
    ...params,
    firestore: firebaseFirestore,
  });
}

export function getLatestHistoryForStandard(
  params: Omit<GetLatestHistoryForStandardParams, 'firestore'>
) {
  // Validate params before calling internal function
  // This catches issues early and provides better error messages
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new Error(
      '[getLatestHistoryForStandard] Expected object parameter with { userId, standardId }. ' +
      'If you see this, you may have a stale bundle. ' +
      'See troubleshooting/activity-history-engine-call-error.md for resolution.'
    );
  }

  if (!params.userId || typeof params.userId !== 'string') {
    throw new Error(
      '[getLatestHistoryForStandard] userId is required and must be a string. ' +
      'This may indicate a stale bundle. See troubleshooting/activity-history-engine-call-error.md'
    );
  }

  if (!params.standardId || typeof params.standardId !== 'string') {
    throw new Error(
      '[getLatestHistoryForStandard] standardId is required and must be a string. ' +
      'This may indicate a stale bundle. See troubleshooting/activity-history-engine-call-error.md'
    );
  }

  return getLatestHistoryForStandardInternal({
    ...params,
    firestore: firebaseFirestore,
  });
}

export function listenActivityHistoryForStandard(
  params: Omit<ListenActivityHistoryForStandardParams, 'firestore'>
) {
  return listenActivityHistoryForStandardInternal({
    ...params,
    firestore: firebaseFirestore,
  });
}
