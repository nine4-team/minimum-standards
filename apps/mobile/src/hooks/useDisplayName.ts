import { useCallback, useEffect, useState } from 'react';
import { doc } from '@react-native-firebase/firestore';
import { firebaseAuth, firebaseFirestore } from '../firebase/firebaseApp';
import * as groupsService from '../services/groupsService';

export function useDisplayName() {
  const [displayName, setDisplayNameState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const userId = firebaseAuth.currentUser?.uid;

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const userRef = doc(firebaseFirestore, 'users', userId);
    const unsubscribe = userRef.onSnapshot(
      (snap) => {
        const data = snap.data();
        setDisplayNameState(data?.displayName ?? null);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  const setDisplayName = useCallback(async (name: string) => {
    await groupsService.updateDisplayName(name);
    setDisplayNameState(name);
  }, []);

  return { displayName, loading, setDisplayName };
}
