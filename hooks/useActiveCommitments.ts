import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './useAuth';
import { useNetworkConnectivity } from './useNetworkConnectivity';
import { commitmentCacheService } from '@/services/commitmentCacheService';
import { authCache } from '@/services/authCache';

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

// Helper functions for cadence-based check-in tracking
function getPeriodKey(cadence: string): string {
  const now = new Date();
  
  switch (cadence) {
    case 'daily':
      return now.toDateString(); // e.g., "Wed Oct 25 2023"
    case 'weekly':
      // Get the Monday of current week
      const monday = new Date(now);
      monday.setDate(now.getDate() - now.getDay() + 1);
      return `week_${monday.toDateString()}`;
    case 'monthly':
      return `month_${now.getFullYear()}_${now.getMonth()}`;
    default:
      return now.toDateString(); // Default to daily
  }
}

async function getPeriodCheckinsKey(cadence: string): Promise<string> {
  const periodKey = getPeriodKey(cadence);
  return `commitment_checkins_${periodKey}`;
}

async function getPeriodCheckins(cadence: string): Promise<Set<string>> {
  try {
    const key = await getPeriodCheckinsKey(cadence);
    const stored = await AsyncStorage.getItem(key);
    if (stored) {
      const checkinArray = JSON.parse(stored);
      return new Set(checkinArray);
    }
  } catch (error) {
    console.error('Error getting period checkins:', error);
  }
  return new Set();
}

async function markCheckedInForPeriod(commitmentId: string, cadence: string): Promise<void> {
  try {
    const key = await getPeriodCheckinsKey(cadence);
    const periodCheckins = await getPeriodCheckins(cadence);
    periodCheckins.add(commitmentId);
    await AsyncStorage.setItem(key, JSON.stringify(Array.from(periodCheckins)));
    console.log(`✅ Marked commitment as checked in for ${cadence}:`, commitmentId);
  } catch (error) {
    console.error('Error marking checked in for period:', error);
  }
}

// Helper function to check if user has already checked in for the current period
async function hasCheckedInThisPeriod(commitment: ActiveCommitment): Promise<boolean> {
  if (commitment.type !== 'recurring' || !commitment.cadence) {
    return false;
  }
  
  const periodCheckins = await getPeriodCheckins(commitment.cadence);
  return periodCheckins.has(commitment.id);
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
  const { getToken, getTokenWithCache, user, firebaseUser } = useAuth();
  const { isConnected, isInternetReachable } = useNetworkConnectivity();
  const [, forceUpdate] = useState({});
  
  // Network status
  const isOnline = isConnected === true && isInternetReachable === true;

  // Force re-render when global state changes
  useEffect(() => {
    const listener = () => forceUpdate({});
    globalListeners.add(listener);
    return () => {
      globalListeners.delete(listener);
    };
  }, []);

  // 🚀 CACHE-FIRST: Helper function to sync commitments from backend
  const syncCommitmentsFromBackend = useCallback(async (userId: string) => {
    try {
      // Use enhanced token getter that handles caching automatically
      const token = await getTokenWithCache();
      if (!token) {
        throw new Error('No authentication token available (online or cached)');
      }

      console.log('🎯 Syncing active commitments from backend for user:', userId);

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
      console.log('✅ Active commitments synced from backend:', data);

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

      // Update global state and cache
      updateGlobalState({ commitments: uniqueCommitments, loading: false });
      await commitmentCacheService.saveCommitments(uniqueCommitments, userId);
      
      // Sync any pending check-ins while we're here
      if (isOnline) {
        const syncResult = await commitmentCacheService.syncPendingCheckIns(userId, getToken, true);
        if (syncResult.synced > 0) {
          console.log(`💾 [COMMITMENT SYNC] Synced ${syncResult.synced} pending check-ins`);
          // Refresh commitments after syncing pending check-ins
          setTimeout(() => syncCommitmentsFromBackend(userId), 1000);
        }
      }
      
      isInitialized = true;
    } catch (err) {
      console.error('❌ Error syncing commitments from backend:', err);
      updateGlobalState({ 
        error: err instanceof Error ? err.message : 'Failed to sync commitments',
        loading: false
      });
      isInitialized = true;
    }
  }, [getToken, isOnline]);

  const fetchActiveCommitments = useCallback(async () => {
    // FIXED: Use Clerk user ID instead of Firebase UID
    const userId = user?.id || firebaseUser?.uid;
    if (!userId) {
      updateGlobalState({ loading: false });
      return;
    }

    updateGlobalState({ loading: true, error: null });
    await syncCommitmentsFromBackend(userId);
  }, [user?.id, firebaseUser?.uid, syncCommitmentsFromBackend]);

  const checkInCommitment = useCallback(async (commitmentId: string, completed: boolean) => {
    // FIXED: Use Clerk user ID instead of Firebase UID
    const userId = user?.id || firebaseUser?.uid;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const commitment = globalCommitments.find(c => c.id === commitmentId);
    const coachingSessionId = user?.id || firebaseUser?.uid;

    console.log('🎯 Checking in commitment:', { commitmentId, completed, isOnline });

    // 🚀 OFFLINE-FIRST: Handle offline check-ins
    if (!isOnline) {
      console.log('📱 [COMMITMENT OFFLINE] Offline check-in - queuing for sync');
      
      try {
        // Queue check-in for offline sync
        await commitmentCacheService.queueCheckIn(
          commitmentId,
          completed,
          userId,
          coachingSessionId!
        );

        // Mark as checked in locally for recurring commitments
        if (commitment && commitment.type === 'recurring' && commitment.cadence) {
          await markCheckedInForPeriod(commitmentId, commitment.cadence);
        }

        // Update local state optimistically
        const updatedCommitments = globalCommitments.map(c => 
          c.id === commitmentId 
            ? { 
                ...c, 
                lastCheckedInAt: new Date(),
                // Don't update streaks offline - wait for sync
              }
            : c
        );
        updateGlobalState({ commitments: updatedCommitments });

        console.log('✅ [COMMITMENT OFFLINE] Check-in queued for sync when online');
        return { success: true, offline: true };
      } catch (error) {
        console.error('❌ [COMMITMENT OFFLINE] Error queuing offline check-in:', error);
        throw error;
      }
    }

    // 🚀 ONLINE: Process check-in immediately
    try {
      // Use enhanced token getter that handles caching automatically
      const token = await getTokenWithCache();
      if (!token) {
        throw new Error('No authentication token available (online or cached)');
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}api/coaching/commitments/checkin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          commitmentId,
          completed,
          coachingSessionId,
          messageId: `settings_checkin_${Date.now()}`
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to check in commitment: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Commitment check-in successful:', result);

      // Mark as checked in for this period for recurring commitments
      if (commitment && commitment.type === 'recurring' && commitment.cadence) {
        await markCheckedInForPeriod(commitmentId, commitment.cadence);
      }

      // Update the local commitment with check-in time and new streak count
      const updatedCommitments = globalCommitments.map(c => 
        c.id === commitmentId 
          ? { 
              ...c, 
              lastCheckedInAt: new Date(),
              currentStreakCount: result.commitment?.currentStreakCount || c.currentStreakCount,
              numberOfTimesCompleted: result.commitment?.numberOfTimesCompleted || c.numberOfTimesCompleted
            }
          : c
      );
      updateGlobalState({ commitments: updatedCommitments });

      // Update cache with latest data
      await commitmentCacheService.saveCommitments(updatedCommitments, userId);

      return result;
    } catch (err) {
      console.error('❌ Error checking in commitment:', err);
      throw err;
    }
  }, [user?.id, firebaseUser?.uid, getToken, isOnline]);

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
        // 🚀 CACHE-FIRST: Load from cache immediately, then sync in background
        (async () => {
          try {
            updateGlobalState({ loading: true, error: null });

            console.log('💾 [COMMITMENT CACHE] Loading cached commitments first...');
            const cachedCommitments = await commitmentCacheService.loadCommitments(userId);
            
            if (cachedCommitments.length > 0) {
              console.log(`💾 [COMMITMENT CACHE] Found ${cachedCommitments.length} cached commitments - displaying immediately`);
              
              // Show cached commitments immediately for fast UI
              updateGlobalState({ commitments: cachedCommitments, loading: false });
              isInitialized = true;
              
              // Start background sync to get fresh data (non-blocking) only if online
              if (isOnline) {
                setTimeout(async () => {
                  try {
                    console.log('🔄 [COMMITMENT BACKGROUND] Starting background sync...');
                    await syncCommitmentsFromBackend(userId);
                  } catch (error) {
                    console.error('⚠️ [COMMITMENT BACKGROUND] Background sync failed:', error);
                  }
                }, 2000); // 2 second delay to let UI load first
              } else {
                console.log('📱 [COMMITMENT OFFLINE] Offline - using cached data only');
              }
              
            } else if (isOnline) {
              // No cache and online - try to load from backend
              console.log('📱 [COMMITMENT INIT] No cache found - loading from backend...');
              await syncCommitmentsFromBackend(userId);
            } else {
              // No cache and offline - show empty state
              console.log('📱 [COMMITMENT OFFLINE] No cache and offline - showing empty state');
              updateGlobalState({ commitments: [], loading: false });
              isInitialized = true;
            }
            
          } catch (error) {
            console.error('❌ [COMMITMENT INIT] Initialization failed:', error);
            updateGlobalState({ 
              error: error instanceof Error ? error.message : 'Failed to load commitments',
              commitments: [],
              loading: false
            });
            isInitialized = true;
          }
        })();
      }
    } else {
      clearCommitmentsData();
    }
  }, [user?.id, firebaseUser?.uid]); // 🚀 FIXED: Removed fetchActiveCommitments from deps to prevent infinite loop

  // 🚀 OFFLINE-FIRST: Sync pending check-ins when coming back online
  useEffect(() => {
    if (isOnline && currentUserId && isInitialized) {
      const syncPendingWhenOnline = async () => {
        try {
          console.log('🌐 [COMMITMENT SYNC] Device back online - syncing pending check-ins');
          const syncResult = await commitmentCacheService.syncPendingCheckIns(currentUserId, getTokenWithCache, true);
          
          if (syncResult.synced > 0) {
            console.log(`💾 [COMMITMENT SYNC] Synced ${syncResult.synced} pending check-ins`);
            // Refresh commitments to get updated streak counts
            await syncCommitmentsFromBackend(currentUserId);
          }
        } catch (error) {
          console.error('❌ [COMMITMENT SYNC] Error syncing pending check-ins:', error);
        }
      };

      // Small delay to avoid immediate sync on app start
      const timeoutId = setTimeout(syncPendingWhenOnline, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [isOnline, currentUserId, isInitialized, getToken, syncCommitmentsFromBackend]);

  return {
    commitments: globalCommitments,
    loading: globalLoading,
    error: globalError,
    isInitialized,
    refetch: fetchActiveCommitments,
    checkInCommitment,
    hasCheckedInThisPeriod, // Export the updated helper function
    // 🚀 OFFLINE-FIRST: Export sync utilities
    isOnline,
    syncPendingCheckIns: () => currentUserId ? commitmentCacheService.syncPendingCheckIns(currentUserId, getToken, isOnline) : Promise.resolve({ synced: 0, failed: 0 }),
    getPendingCheckInsCount: () => currentUserId ? commitmentCacheService.getPendingCheckIns(currentUserId).then(checkIns => checkIns.length) : Promise.resolve(0),
  };
};