import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { syncService, CachedEntry, SyncState } from '@/services/syncService';

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

export function useSync(): UseSyncReturn {
  const { firebaseUser } = useAuth();
  const [entries, setEntries] = useState<CachedEntry[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncState>({
    lastSyncTime: new Date(0).toISOString(),
    syncInProgress: false,
    pendingUploads: [],
    failedSyncs: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // =====================
  // INITIALIZATION
  // =====================

  const initializeSync = useCallback(async () => {
    if (!firebaseUser?.uid) {
      console.log('⏭️ No user, skipping sync initialization');
      setIsLoading(false);
      return;
    }

    console.log('🚀 Initializing sync for user:', firebaseUser.uid);
    setIsLoading(true);
    setError(null);

    try {
      // Load initial entries (cached + background sync)
      const initialEntries = await syncService.initialSync(firebaseUser.uid);
      setEntries(initialEntries);

      // Start real-time sync
      syncService.startRealTimeSync(firebaseUser.uid);

      // Load sync status
      const currentSyncStatus = await syncService.getSyncState(firebaseUser.uid);
      setSyncStatus(currentSyncStatus);

      console.log('✅ Sync initialized with', initialEntries.length, 'entries');
    } catch (err) {
      console.error('❌ Sync initialization failed:', err);
      setError(err instanceof Error ? err.message : 'Sync initialization failed');
    } finally {
      setIsLoading(false);
    }
  }, [firebaseUser?.uid]);

  // =====================
  // SYNC STATUS LISTENER
  // =====================

  useEffect(() => {
    if (!firebaseUser?.uid) return;

    console.log('👂 Setting up sync status listener');
    
    const unsubscribe = syncService.addSyncListener((status) => {
      // Only log significant sync status changes
      const isSignificantChange = status.syncInProgress !== syncStatus.syncInProgress || 
                                 status.pendingUploads.length !== syncStatus.pendingUploads.length ||
                                 status.failedSyncs.length !== syncStatus.failedSyncs.length;
      
      if (isSignificantChange) {
        console.log('📊 Sync status updated:', { 
          syncInProgress: status.syncInProgress, 
          pendingUploads: status.pendingUploads.length,
          failedSyncs: status.failedSyncs.length 
        });
      }
      setSyncStatus(status);
    });

    return unsubscribe;
  }, [firebaseUser?.uid, syncStatus]);

  // =====================
  // ENTRIES UPDATE HANDLER
  // =====================

  const updateEntriesFromCache = useCallback(async () => {
    if (!firebaseUser?.uid) return;
    
    try {
      const cachedEntries = await syncService.getCachedEntries(firebaseUser.uid);
      setEntries(cachedEntries);
    } catch (error) {
      console.error('❌ Error loading cached entries:', error);
    }
  }, [firebaseUser?.uid]);

  // Update entries when sync status changes (more efficient than polling)
  useEffect(() => {
    if (!syncStatus.syncInProgress && firebaseUser?.uid) {
      updateEntriesFromCache();
    }
  }, [syncStatus.syncInProgress, updateEntriesFromCache, firebaseUser?.uid]);

  // =====================
  // APP STATE MANAGEMENT
  // =====================

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (!firebaseUser?.uid) return;

      console.log('📱 App state changed to:', nextAppState);

      if (nextAppState === 'active') {
        console.log('📱 App became active, refreshing sync');
        // Refresh when app becomes active
        initializeSync();
      } else if (nextAppState === 'background') {
        console.log('📱 App went to background, stopping real-time sync');
        // Stop real-time sync to save battery
        syncService.stopRealTimeSync();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [firebaseUser?.uid, initializeSync]);

  // =====================
  // USER CHANGE HANDLER
  // =====================

  useEffect(() => {
    if (firebaseUser?.uid) {
      initializeSync();
    } else {
      // User signed out, clear data
      console.log('🧹 User signed out, clearing sync data');
      setEntries([]);
      setSyncStatus({
        lastSyncTime: new Date(0).toISOString(),
        syncInProgress: false,
        pendingUploads: [],
        failedSyncs: [],
      });
      setIsLoading(false);
      setError(null);
      syncService.stopRealTimeSync();
    }
  }, [firebaseUser?.uid, initializeSync]);

  // =====================
  // CLEANUP ON UNMOUNT
  // =====================

  useEffect(() => {
    return () => {
      console.log('🧹 useSync cleanup');
      syncService.stopRealTimeSync();
    };
  }, []);

  // =====================
  // PUBLIC METHODS
  // =====================

  const refreshEntries = useCallback(async () => {
    if (!firebaseUser?.uid) return;

    console.log('🔄 Manual refresh requested');
    setError(null);

    try {
      const refreshedEntries = await syncService.initialSync(firebaseUser.uid);
      setEntries(refreshedEntries);
    } catch (err) {
      console.error('❌ Manual refresh failed:', err);
      setError(err instanceof Error ? err.message : 'Refresh failed');
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
      setEntries(updatedEntries);
      
      return entryId;
    } catch (err) {
      console.error('❌ Add entry failed:', err);
      setError(err instanceof Error ? err.message : 'Add entry failed');
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
      setEntries(updatedEntries);
    } catch (err) {
      console.error('❌ Update entry failed:', err);
      setError(err instanceof Error ? err.message : 'Update entry failed');
      throw err;
    }
  }, [firebaseUser?.uid]);

  const getEntryById = useCallback((entryId: string): CachedEntry | undefined => {
    return entries.find(entry => entry.id === entryId);
  }, [entries]);

  return {
    entries,
    syncStatus,
    isLoading,
    error,
    refreshEntries,
    addEntry,
    updateEntry,
    getEntryById,
  };
}

export default useSync;
