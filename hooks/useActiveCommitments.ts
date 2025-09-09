import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

export interface ActiveCommitment {
  id: string;
  title: string;
  description: string;
  type: 'one-time' | 'recurring';
  status: 'active' | 'completed' | 'failed';
  deadline?: string;
  cadence?: string;
  createdAt: Date;
  commitmentDueAt?: Date;
  currentStreakCount: number;
  numberOfTimesCompleted: number;
}

export const useActiveCommitments = () => {
  const [commitments, setCommitments] = useState<ActiveCommitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getToken, firebaseUser } = useAuth();

  const fetchActiveCommitments = useCallback(async () => {
    if (!firebaseUser?.uid) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      console.log('🎯 Fetching active commitments for user:', firebaseUser.uid);

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}api/coaching/commitments/checkin`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch commitments: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Active commitments fetched:', data);

      // Transform the data to match our interface
      const transformedCommitments: ActiveCommitment[] = (data.commitments || []).map((commitment: any) => ({
        id: commitment.id,
        title: commitment.title,
        description: commitment.description,
        type: commitment.type,
        status: commitment.status,
        deadline: commitment.deadline,
        cadence: commitment.cadence,
        createdAt: commitment.createdAt?.toDate ? commitment.createdAt.toDate() : new Date(commitment.createdAt),
        commitmentDueAt: commitment.commitmentDueAt?.toDate ? commitment.commitmentDueAt.toDate() : (commitment.commitmentDueAt ? new Date(commitment.commitmentDueAt) : undefined),
        currentStreakCount: commitment.currentStreakCount || 0,
        numberOfTimesCompleted: commitment.numberOfTimesCompleted || 0,
      }));

      // Remove duplicates based on ID
      const uniqueCommitments = transformedCommitments.filter((commitment, index, self) => 
        index === self.findIndex(c => c.id === commitment.id)
      );

      setCommitments(uniqueCommitments);
    } catch (err) {
      console.error('❌ Error fetching active commitments:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch commitments');
      setCommitments([]);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser?.uid, getToken]);

  const checkInCommitment = useCallback(async (commitmentId: string, completed: boolean) => {
    if (!firebaseUser?.uid) {
      throw new Error('User not authenticated');
    }

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      console.log('🎯 Checking in commitment:', { commitmentId, completed });

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}api/coaching/commitments/checkin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          commitmentId,
          completed,
          coachingSessionId: firebaseUser.uid,
          messageId: `settings_checkin_${Date.now()}`
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to check in commitment: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Commitment check-in successful:', result);

      // Refresh commitments after check-in
      await fetchActiveCommitments();

      return result;
    } catch (err) {
      console.error('❌ Error checking in commitment:', err);
      throw err;
    }
  }, [firebaseUser?.uid, getToken, fetchActiveCommitments]);

  // Fetch commitments when user changes or component mounts
  useEffect(() => {
    if (firebaseUser?.uid) {
      fetchActiveCommitments();
    }
  }, [firebaseUser?.uid]); // Only depend on userId, not the function

  return {
    commitments,
    loading,
    error,
    refetch: fetchActiveCommitments,
    checkInCommitment,
  };
};
