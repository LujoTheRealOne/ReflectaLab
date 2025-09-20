import { useState, useEffect, useCallback, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native'; // Re-enabled for backend sync
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
  deleteEntry: (entryId: string) => Promise<void>;
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
    // Load initial entries from cache and start background sync
    const initialEntries = await syncService.initialSync(userId);
    updateGlobalState({ entries: initialEntries });

    // FORCE UPLOAD: Upload only offline entries to backend on app start
    console.log('📤 FORCE UPLOAD STARTED: Uploading offline entries to backend...');
    try {
      const startTime = Date.now();
      await syncService.forceUploadAllCachedEntries(userId);
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      console.log(`✅ FORCE UPLOAD COMPLETED: Offline entries uploaded in ${duration} seconds`);
    } catch (error) {
      console.error('❌ FORCE UPLOAD FAILED:', error);
      // Don't throw - app should still work even if upload fails
    }

    // Disable real-time sync to prevent loops - will use manual refresh only
    console.log('🔄 Real-time sync disabled to prevent loops...');
    // syncService.startRealTimeSync(userId);

    // Load sync status (force syncInProgress to false)
    const currentSyncStatus = await syncService.getSyncState(userId);
    updateGlobalState({ 
      syncStatus: { 
        ...currentSyncStatus, 
        syncInProgress: false 
      } 
    });

    // Disable sync status listener to prevent continuous updates
    // syncService.addSyncListener((status) => {
    //   updateGlobalState({ syncStatus: status });
    // });

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

// Enable app state listener for backend sync on app resume
let appStateListenerSetup = false;
function setupAppStateListener() {
  if (appStateListenerSetup) return;
  
  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (!currentUserId) return;

    console.log('📱 App state changed to:', nextAppState);

    if (nextAppState === 'active') {
      console.log('📱 App became active, refreshing sync with backend');
      initializeSyncForUser(currentUserId);
    } else if (nextAppState === 'background') {
      console.log('📱 App went to background, performing final sync');
      // Perform one final sync before going to background
      syncService.performBackgroundSync(currentUserId).then(() => {
        console.log('📱 Background sync completed');
        syncService.stopRealTimeSync();
      }).catch(error => {
        console.error('📱 Background sync failed:', error);
        syncService.stopRealTimeSync();
      });
    }
  };

  AppState.addEventListener('change', handleAppStateChange);
  appStateListenerSetup = true;
}

export function useSyncSingleton(): UseSyncReturn {
  const { firebaseUser } = useAuth();
  const [, forceUpdate] = useState({});
  
  // 🚀 NETWORK CONNECTIVITY: Import network hook
  const { isConnected, isInternetReachable } = require('@/hooks/useNetworkConnectivity').useNetworkConnectivity();

  // Force re-render when global state changes
  useEffect(() => {
    const listener = () => forceUpdate({});
    globalListeners.add(listener);
    return () => globalListeners.delete(listener);
  }, []);

  // Enable app state listener for backend sync
  useEffect(() => {
    setupAppStateListener();
  }, []);

  // Listen for cache updates to automatically refresh UI
  useEffect(() => {
    if (!firebaseUser?.uid) return;
    
    const unsubscribe = syncService.onCacheUpdate((userId, entries) => {
      if (userId === firebaseUser.uid) {
        console.log('🔄 Cache updated, refreshing UI with', entries.length, 'entries');
        updateGlobalState({ entries });
      }
    });
    
    return unsubscribe;
  }, [firebaseUser?.uid]);

  // Initialize sync when user changes
  useEffect(() => {
    if (firebaseUser?.uid) {
      initializeSyncForUser(firebaseUser.uid);
    } else {
      clearSyncData();
    }
  }, [firebaseUser?.uid]);
  
  // 🚀 NETWORK LISTENER: Auto-sync when coming back online
  useEffect(() => {
    const isOnline = isConnected === true && isInternetReachable === true;
    
    if (isOnline && firebaseUser?.uid) {
      // Debounce network changes to avoid excessive syncing
      const syncTimeout = setTimeout(async () => {
        try {
          console.log('🌐 Network connected - triggering background sync for pending uploads');
          await syncService.performBackgroundSync(firebaseUser.uid);
          
          // Refresh UI with updated entries
          const refreshedEntries = await syncService.getCachedEntries(firebaseUser.uid);
          updateGlobalState({ entries: refreshedEntries });
          
          console.log('✅ Auto-sync completed after network reconnection');
        } catch (error) {
          console.error('❌ Auto-sync failed after network reconnection:', error);
        }
      }, 2000); // 2 second delay to let network stabilize
      
      return () => clearTimeout(syncTimeout);
    }
  }, [isConnected, isInternetReachable, firebaseUser?.uid]);

  // Disable automatic cache updates to reduce loops - only manual refresh
  // useEffect(() => {
  //   if (!globalSyncStatus.syncInProgress && currentUserId) {
  //     console.log('🔄 Sync completed, updating cache from backend...');
  //     updateEntriesFromCache();
  //   }
  // }, [globalSyncStatus.syncInProgress]);

  // Public methods
  const refreshEntries = useCallback(async () => {
    if (!firebaseUser?.uid) return;

    console.log('🔄 Manual refresh requested - performing full backend sync');
    updateGlobalState({ error: null });

    try {
      // Force a full sync with server
      await syncService.performBackgroundSync(firebaseUser.uid);
      
      // Get updated entries from cache
      const refreshedEntries = await syncService.getCachedEntries(firebaseUser.uid);
      updateGlobalState({ entries: refreshedEntries });
      
      console.log('✅ Manual refresh completed with', refreshedEntries.length, 'entries');
    } catch (err) {
      console.error('❌ Manual refresh failed:', err);
      updateGlobalState({ error: err instanceof Error ? err.message : 'Refresh failed' });
    }
  }, [firebaseUser?.uid]);

  const addEntry = useCallback(async (entry: Omit<CachedEntry, 'id' | '_syncStatus'>): Promise<string> => {
    if (!firebaseUser?.uid) {
      throw new Error('No authenticated user');
    }

    console.log('➕ Adding new entry (direct Firestore + cache)');
    
    try {
      // Import Firebase functions
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      const Crypto = await import('expo-crypto');
      
      // Generate entry ID
      const entryId = Crypto.randomUUID();
      
      // Save directly to Firestore (like old system)
      const entryRef = doc(db, 'journal_entries', entryId);
      await setDoc(entryRef, {
        uid: firebaseUser.uid,
        content: entry.content,
        timestamp: serverTimestamp(),
        title: entry.title || '',
        linkedCoachingSessionId: entry.linkedCoachingSessionId || null,
        linkedCoachingMessageId: entry.linkedCoachingMessageId || null,
        lastUpdated: serverTimestamp(),
      });
      
      console.log('✅ Entry saved to Firestore:', entryId);
      
      // Also add to cache for offline access and refresh UI
      await syncService.addLocalEntry(firebaseUser.uid, {
        ...entry,
        id: entryId,
        _syncStatus: 'synced'
      } as any);
      
      console.log('✅ Entry added to cache (auto UI refresh via listener)');
      
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

    console.log('✏️ Updating entry (direct Firestore + cache):', entryId);
    
    try {
      // Import Firebase functions
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      // Update directly in Firestore (like old system)
      const entryRef = doc(db, 'journal_entries', entryId);
      await updateDoc(entryRef, {
        content: updates.content,
        lastUpdated: serverTimestamp(),
        ...(updates.title !== undefined && { title: updates.title }),
        ...(updates.linkedCoachingSessionId !== undefined && { linkedCoachingSessionId: updates.linkedCoachingSessionId }),
        ...(updates.linkedCoachingMessageId !== undefined && { linkedCoachingMessageId: updates.linkedCoachingMessageId }),
      });
      
      console.log('✅ Entry updated in Firestore:', entryId);
      
      // Also update cache for offline access and refresh UI
      await syncService.updateLocalEntry(firebaseUser.uid, entryId, {
        ...updates,
        _syncStatus: 'synced'
      });
      
      console.log('✅ Entry updated in cache (auto UI refresh via listener)');
    } catch (err) {
      console.error('❌ Update entry failed:', err);
      updateGlobalState({ error: err instanceof Error ? err.message : 'Update entry failed' });
      throw err;
    }
  }, [firebaseUser?.uid]);

  const deleteEntry = useCallback(async (entryId: string): Promise<void> => {
    if (!firebaseUser?.uid) {
      throw new Error('No authenticated user');
    }

    console.log('🗑️ Deleting entry (direct Firestore + cache):', entryId);
    
    try {
      // Import Firebase functions
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      // Delete from Firestore
      const entryRef = doc(db, 'journal_entries', entryId);
      await deleteDoc(entryRef);
      
      console.log('✅ Entry deleted from Firestore:', entryId);
      
      // Also delete from cache and refresh UI
      await syncService.deleteLocalEntry(firebaseUser.uid, entryId);
      
      console.log('✅ Entry deleted from cache (auto UI refresh via listener)');
    } catch (err) {
      console.error('❌ Delete entry failed:', err);
      updateGlobalState({ error: err instanceof Error ? err.message : 'Delete entry failed' });
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
    deleteEntry,
    getEntryById,
  };
}

export default useSyncSingleton;
