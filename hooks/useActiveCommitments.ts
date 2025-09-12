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

// Global state to persist across component mounts
let globalCommitments: ActiveCommitment[] = [];
let globalLoading = true;
let globalError: string | null = null;
let globalListeners: Set<() => void> = new Set();
let currentUserId: string | null = null;
let isInitialized = false;

// Notify all listeners about state changes
function notifyListeners() {
  globalListeners.forEach(listener => listener());
}

// Update global state
function updateGlobalState(updates: {
  commitments?: ActiveCommitment[];
  loading?: boolean;
  error?: string | null;
}) {
  let hasChanges = false;
  
  if (updates.commitments !== undefined && updates.commitments !== globalCommitments) {
    globalCommitments = updates.commitments;
    hasChanges = true;
  }
  if (updates.loading !== undefined && updates.loading !== globalLoading) {
    globalLoading = updates.loading;
    hasChanges = true;
  }
  if (updates.error !== undefined && updates.error !== globalError) {
    globalError = updates.error;
    hasChanges = true;
  }
  
  if (hasChanges) {
    notifyListeners();
  }
}

// Clear state when user changes
function clearCommitmentsData() {
  updateGlobalState({
    commitments: [],
    loading: true,
    error: null
  });
  currentUserId = null;
  isInitialized = false;
}

export const useActiveCommitments = () => {
  const { getToken, firebaseUser } = useAuth();
  const [, forceUpdate] = useState({});

  // Force re-render when global state changes
  useEffect(() => {
    const listener = () => forceUpdate({});
    globalListeners.add(listener);
    return () => globalListeners.delete(listener);
  }, []);

  const fetchActiveCommitments = useCallback(async () => {
    if (!firebaseUser?.uid) {
      updateGlobalState({ loading: false });
      return;
    }

    try {
      updateGlobalState({ loading: true, error: null });

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

      updateGlobalState({ commitments: uniqueCommitments });
    } catch (err) {
      console.error('❌ Error fetching active commitments:', err);
      updateGlobalState({ 
        error: err instanceof Error ? err.message : 'Failed to fetch commitments',
        commitments: []
      });
    } finally {
      updateGlobalState({ loading: false });
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

  // Initialize commitments when user changes
  useEffect(() => {
    if (firebaseUser?.uid) {
      // If user changed, reset state and fetch
      if (currentUserId !== firebaseUser.uid) {
        clearCommitmentsData();
        currentUserId = firebaseUser.uid;
        isInitialized = false;
      }
      
      // Fetch if not already initialized for this user
      if (!isInitialized) {
        fetchActiveCommitments().then(() => {
          isInitialized = true;
        });
      }
    } else {
      clearCommitmentsData();
    }
  }, [firebaseUser?.uid, fetchActiveCommitments]);

  return {
    commitments: globalCommitments,
    loading: globalLoading,
    error: globalError,
    refetch: fetchActiveCommitments,
    checkInCommitment,
  };
};
