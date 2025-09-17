import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  lastCheckedInAt?: Date; // Track when user last checked in
}

// AsyncStorage key for daily check-ins
const DAILY_CHECKINS_KEY = 'commitment_daily_checkins';

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

// Helper functions for AsyncStorage-based daily check-in tracking
async function getTodayCheckinsKey(): Promise<string> {
  const today = new Date().toDateString(); // e.g., "Wed Oct 25 2023"
  return `${DAILY_CHECKINS_KEY}_${today}`;
}

async function getTodayCheckins(): Promise<Set<string>> {
  try {
    const key = await getTodayCheckinsKey();
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const checkinArray = JSON.parse(stored);
      return new Set(checkinArray);
    }
  } catch (error) {
    console.error('Error getting today checkins:', error);
  }
  return new Set();
}

async function markCheckedInToday(commitmentId: string): Promise<void> {
  try {
    const key = await getTodayCheckinsKey();
    const todayCheckins = await getTodayCheckins();
    todayCheckins.add(commitmentId);
    await AsyncStorage.setItem(key, JSON.stringify(Array.from(todayCheckins)));
    console.log('✅ Marked commitment as checked in today:', commitmentId);
  } catch (error) {
    console.error('Error marking checked in today:', error);
  }
}

// Helper function to check if user has already checked in today
async function hasCheckedInToday(commitment: ActiveCommitment): Promise<boolean> {
  if (commitment.type !== 'recurring') {
    return false;
  }
  
  const todayCheckins = await getTodayCheckins();
  return todayCheckins.has(commitment.id);
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
  // FIXED: Use Clerk user ID for consistency with web and backend
  const { getToken, user, firebaseUser } = useAuth();
  const [, forceUpdate] = useState({});

  // Force re-render when global state changes
  useEffect(() => {
    const listener = () => forceUpdate({});
    globalListeners.add(listener);
    return () => {
      globalListeners.delete(listener);
    };
  }, []);

  const fetchActiveCommitments = useCallback(async () => {
    // FIXED: Use Clerk user ID instead of Firebase UID
    const userId = user?.id || firebaseUser?.uid;
    if (!userId) {
      updateGlobalState({ loading: false });
      return;
    }

    try {
      updateGlobalState({ loading: true, error: null });

      const token = await getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      console.log('🎯 Fetching active commitments for user:', userId);

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
  }, [user?.id, firebaseUser?.uid, getToken]);

  const checkInCommitment = useCallback(async (commitmentId: string, completed: boolean) => {
    // FIXED: Use Clerk user ID instead of Firebase UID
    const userId = user?.id || firebaseUser?.uid;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    // Check if already checked in today for recurring commitments
    const commitment = globalCommitments.find(c => c.id === commitmentId);
    if (commitment && commitment.type === 'recurring') {
      const alreadyCheckedIn = await hasCheckedInToday(commitment);
      if (alreadyCheckedIn) {
        console.log('⚠️ Already checked in today for commitment:', commitmentId);
        throw new Error('You have already checked in for this habit today. Please try again tomorrow.');
      }
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
          // FIXED: Use Clerk user ID for coachingSessionId (consistent with web)
          coachingSessionId: user?.id || firebaseUser?.uid,
          messageId: `settings_checkin_${Date.now()}`
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to check in commitment: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Commitment check-in successful:', result);

      // Mark as checked in today for recurring commitments
      if (commitment && commitment.type === 'recurring') {
        await markCheckedInToday(commitmentId);
      }

      // Update the local commitment with check-in time
      const updatedCommitments = globalCommitments.map(commitment => 
        commitment.id === commitmentId 
          ? { ...commitment, lastCheckedInAt: new Date() }
          : commitment
      );
      updateGlobalState({ commitments: updatedCommitments });

      // Refresh commitments after check-in
      await fetchActiveCommitments();

      return result;
    } catch (err) {
      console.error('❌ Error checking in commitment:', err);
      throw err;
    }
  }, [user?.id, firebaseUser?.uid, getToken, fetchActiveCommitments]);

  // Initialize commitments when user changes
  useEffect(() => {
    const userId = user?.id || firebaseUser?.uid;
    if (userId) {
      // If user changed, reset state and fetch
      if (currentUserId !== userId) {
        clearCommitmentsData();
        currentUserId = userId;
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
  }, [user?.id, firebaseUser?.uid, fetchActiveCommitments]);

  return {
    commitments: globalCommitments,
    loading: globalLoading,
    error: globalError,
    isInitialized,
    refetch: fetchActiveCommitments,
    checkInCommitment,
    hasCheckedInToday, // Export the helper function
  };
};