import { useState, useEffect, useCallback, useMemo } from 'react';
// import { AppState, AppStateStatus } from 'react-native'; // Disabled for instant loading
import { useAuth } from '@/hooks/useAuth';
import { syncService, CachedEntry, SyncState } from '@/services/syncService';

// Global state to persist across component mounts
let globalEntries: CachedEntry[] = [];
let globalSyncStatus: SyncState = {
  lastSyncTime: new Date(0).toISOString(),
  syncInProgress: false,
  pendingUploads: [],
  failedSyncs: [],
};
let globalIsLoading = true;
let globalError: string | null = null;
let globalListeners: Set<() => void> = new Set();
let currentUserId: string | null = null;
let isInitialized = false;

export interface UseSyncReturn {
  entries: CachedEntry[];
  syncStatus: SyncState;
  isLoading: boolean;
  error: string | null;
  refreshEntries: () => Promise<void>;
  addEntry: (entry: Omit<CachedEntry, 'id' | '_syncStatus'>) => Promise<string>;
  updateEntry: (entryId: string, updates: Partial<CachedEntry>) => Promise<void>;
  getEntryById: (entryId: string) => CachedEntry | undefined;
}

// Notify all listeners about state changes
function notifyListeners() {
  globalListeners.forEach(listener => listener());
}

// Update global state
function updateGlobalState(updates: {
  entries?: CachedEntry[];
  syncStatus?: SyncState;
  isLoading?: boolean;
  error?: string | null;
}) {
  let hasChanges = false;
  
  if (updates.entries !== undefined && updates.entries !== globalEntries) {
    globalEntries = updates.entries;
    hasChanges = true;
  }
  if (updates.syncStatus !== undefined && updates.syncStatus !== globalSyncStatus) {
    globalSyncStatus = updates.syncStatus;
    hasChanges = true;
  }
  if (updates.isLoading !== undefined && updates.isLoading !== globalIsLoading) {
    globalIsLoading = updates.isLoading;
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

// Initialize sync for user
async function initializeSyncForUser(userId: string) {
  if (currentUserId === userId && isInitialized) {
    console.log('🚀 Sync already initialized for user:', userId);
    return;
  }

  console.log('🚀 Initializing sync for user:', userId);
  currentUserId = userId;
  updateGlobalState({ isLoading: true, error: null });

  try {
    // Load initial entries from cache only - no background sync
    const initialEntries = await syncService.initialSync(userId);
    updateGlobalState({ entries: initialEntries });

    // Real-time sync disabled for instant loading - only manual refresh will sync
    // syncService.startRealTimeSync(userId);

    // Load sync status
    const currentSyncStatus = await syncService.getSyncState(userId);
    updateGlobalState({ syncStatus: currentSyncStatus });

    // Setup sync status listener
    syncService.addSyncListener((status) => {
      updateGlobalState({ syncStatus: status });
    });

    isInitialized = true;
    console.log('✅ Sync initialized with', initialEntries.length, 'entries');
  } catch (err) {
    console.error('❌ Sync initialization failed:', err);
    updateGlobalState({ error: err instanceof Error ? err.message : 'Sync initialization failed' });
  } finally {
    updateGlobalState({ isLoading: false });
  }
}

// Clear sync data
function clearSyncData() {
  console.log('🧹 Clearing global sync data');
  globalEntries = [];
  globalSyncStatus = {
    lastSyncTime: new Date(0).toISOString(),
    syncInProgress: false,
    pendingUploads: [],
    failedSyncs: [],
  };
  globalIsLoading = true;
  globalError = null;
  currentUserId = null;
  isInitialized = false;
  syncService.stopRealTimeSync();
  notifyListeners();
}

// Update entries from cache
async function updateEntriesFromCache() {
  if (!currentUserId) return;
  
  try {
    const cachedEntries = await syncService.getCachedEntries(currentUserId);
    updateGlobalState({ entries: cachedEntries });
  } catch (error) {
    console.error('❌ Error loading cached entries:', error);
  }
}

// Disable app state listener to prevent auto-sync on app resume
// let appStateListenerSetup = false;
// function setupAppStateListener() {
//   if (appStateListenerSetup) return;
  
//   const handleAppStateChange = (nextAppState: AppStateStatus) => {
//     if (!currentUserId) return;

//     console.log('📱 App state changed to:', nextAppState);

//     if (nextAppState === 'active') {
//       console.log('📱 App became active, refreshing sync');
//       initializeSyncForUser(currentUserId);
//     } else if (nextAppState === 'background') {
//       console.log('📱 App went to background, stopping real-time sync');
//       syncService.stopRealTimeSync();
//     }
//   };

//   AppState.addEventListener('change', handleAppStateChange);
//   appStateListenerSetup = true;
// }

export function useSyncSingleton(): UseSyncReturn {
  const { firebaseUser } = useAuth();
  const [, forceUpdate] = useState({});

  // Force re-render when global state changes
  useEffect(() => {
    const listener = () => forceUpdate({});
    globalListeners.add(listener);
    return () => globalListeners.delete(listener);
  }, []);

  // Disable app state listener to prevent auto-sync
  // useEffect(() => {
  //   setupAppStateListener();
  // }, []);

  // Initialize sync when user changes
  useEffect(() => {
    if (firebaseUser?.uid) {
      initializeSyncForUser(firebaseUser.uid);
    } else {
      clearSyncData();
    }
  }, [firebaseUser?.uid]);

  // Remove automatic cache updates - only manual refresh or user actions will trigger updates
  // useEffect(() => {
  //   if (!globalSyncStatus.syncInProgress && currentUserId) {
  //     updateEntriesFromCache();
  //   }
  // }, [globalSyncStatus.syncInProgress]);

  // Public methods
  const refreshEntries = useCallback(async () => {
    if (!firebaseUser?.uid) return;

    console.log('🔄 Manual refresh requested - performing background sync');
    updateGlobalState({ error: null });

    try {
      // Manual refresh should actually sync with server
      await syncService.performBackgroundSync(firebaseUser.uid);
      const refreshedEntries = await syncService.getCachedEntries(firebaseUser.uid);
      updateGlobalState({ entries: refreshedEntries });
    } catch (err) {
      console.error('❌ Manual refresh failed:', err);
      updateGlobalState({ error: err instanceof Error ? err.message : 'Refresh failed' });
    }
  }, [firebaseUser?.uid]);

  const addEntry = useCallback(async (entry: Omit<CachedEntry, 'id' | '_syncStatus'>): Promise<string> => {
    if (!firebaseUser?.uid) {
      throw new Error('No authenticated user');
    }

    console.log('➕ Adding new entry');
    
    try {
      const entryId = await syncService.addLocalEntry(firebaseUser.uid, entry);
      
      // Refresh entries to show the new entry immediately
      const updatedEntries = await syncService.getCachedEntries(firebaseUser.uid);
      updateGlobalState({ entries: updatedEntries });
      
      return entryId;
    } catch (err) {
      console.error('❌ Add entry failed:', err);
      updateGlobalState({ error: err instanceof Error ? err.message : 'Add entry failed' });
      throw err;
    }
  }, [firebaseUser?.uid]);

  const updateEntry = useCallback(async (entryId: string, updates: Partial<CachedEntry>): Promise<void> => {
    if (!firebaseUser?.uid) {
      throw new Error('No authenticated user');
    }

    console.log('✏️ Updating entry:', entryId);
    
    try {
      await syncService.updateLocalEntry(firebaseUser.uid, entryId, updates);
      
      // Refresh entries to show the updated entry immediately
      const updatedEntries = await syncService.getCachedEntries(firebaseUser.uid);
      updateGlobalState({ entries: updatedEntries });
    } catch (err) {
      console.error('❌ Update entry failed:', err);
      updateGlobalState({ error: err instanceof Error ? err.message : 'Update entry failed' });
      throw err;
    }
  }, [firebaseUser?.uid]);

  const getEntryById = useCallback((entryId: string): CachedEntry | undefined => {
    return globalEntries.find(entry => entry.id === entryId);
  }, []);

  return {
    entries: globalEntries,
    syncStatus: globalSyncStatus,
    isLoading: globalIsLoading,
    error: globalError,
    refreshEntries,
    addEntry,
    updateEntry,
    getEntryById,
  };
}

export default useSyncSingleton;
