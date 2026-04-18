import { useEffect, useState } from 'react';
import {
  collection,
  query,
  where,
} from '@react-native-firebase/firestore';
import { firebaseAuth, firebaseFirestore } from '../firebase/firebaseApp';

export interface GroupSummary {
  id: string;
  name: string;
  memberCount: number;
  isAdmin: boolean;
  inviteCode: string;
  createdAtMs: number;
}

export function useMyGroups() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const userId = firebaseAuth.currentUser?.uid;

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setGroups([]);
      return;
    }

    setLoading(true);
    setError(null);

    const groupsQuery = query(
      collection(firebaseFirestore, 'accountabilityGroups'),
      where('memberUids', 'array-contains', userId)
    );

    const unsubscribe = groupsQuery.onSnapshot(
      (snapshot) => {
        const items: GroupSummary[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Record<string, any>;
          const memberUids: string[] = data.memberUids || [];
          items.push({
            id: docSnap.id,
            name: data.name || '',
            memberCount: memberUids.length,
            isAdmin: data.createdByUid === userId,
            inviteCode: data.inviteCode || '',
            createdAtMs: data.createdAtMs || 0,
          });
        });
        items.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setGroups(items);
        setLoading(false);
      },
      (err) => {
        setError(err instanceof Error ? err : new Error('Failed to load groups'));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { groups, loading, error };
}
