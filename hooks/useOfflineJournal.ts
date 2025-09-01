import { useState, useEffect, useCallback, useRef } from 'react';
import { OfflineJournalService } from '@/services/offlineJournalService';
import { JournalEntry, OfflineJournalEntry, SaveStatus, UseOfflineJournalReturn } from '@/types';
import { useNetworkConnectivity } from './useNetworkConnectivity';
import { useAuth } from './useAuth';
import { useAnalytics } from './useAnalytics';

export function useOfflineJournal(): UseOfflineJournalReturn {
  const { firebaseUser, isFirebaseReady } = useAuth();
  const { isConnected, isInternetReachable } = useNetworkConnectivity();
  const { trackEntryCreated, trackEntryUpdated } = useAnalytics();
  
  // State
  const [latestEntry, setLatestEntry] = useState<OfflineJournalEntry | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoadingEntry, setIsLoadingEntry] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isCreatingNewEntry, setIsCreatingNewEntry] = useState(false);
  
  // Refs
  const lastSavedContentRef = useRef<string>('');
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialSyncRef = useRef(false);
  
  // Check if we're offline
  const isOffline = !isConnected || !isInternetReachable;
  
  // Update sync stats
  const updateSyncStats = useCallback(async () => {
    try {
      const stats = await OfflineJournalService.getSyncStats();
      setPendingSyncCount(stats.pendingSync);
      setLastSyncTime(stats.lastSyncTime);
    } catch (error) {
      console.error('❌ Error updating sync stats:', error);
    }
  }, []);

  // Load latest entry from offline storage
  const loadLatestEntry = useCallback(async () => {
    if (!firebaseUser?.uid || isCreatingNewEntry) {
      setIsLoadingEntry(false);
      return;
    }

    try {
      setIsLoadingEntry(true);
      const entry = await OfflineJournalService.getLatestOfflineEntry(firebaseUser.uid);
      
      // Only update if entry is different to prevent infinite loops
      setLatestEntry(prevEntry => {
        if (prevEntry?.id !== entry?.id || prevEntry?.content !== entry?.content) {
          console.log('📱 Loaded latest offline entry:', entry?.id);
          return entry;
        }
        return prevEntry;
      });
      
      if (entry?.content) {
        lastSavedContentRef.current = entry.content;
      }
    } catch (error) {
      console.error('❌ Error loading latest entry:', error);
    } finally {
      setIsLoadingEntry(false);
    }
  }, [firebaseUser?.uid, isCreatingNewEntry]);

  // Save entry to offline storage with debouncing
  const saveEntry = useCallback(async (content: string, isNewEntry: boolean = false) => {
    if (!firebaseUser?.uid) {
      console.log('❌ No user for saving entry');
      return;
    }

    // Don't save if content hasn't changed
    if (content === lastSavedContentRef.current && !isNewEntry) {
      return;
    }

    // Clear existing timeout
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Debounce save operations (except for new entries)
    if (!isNewEntry) {
      setSaveStatus('saving');
      syncTimeoutRef.current = setTimeout(async () => {
        await performSave(content, isNewEntry);
      }, 200); // 200ms debounce - very fast
      return;
    }

    // Save immediately for new entries
    await performSave(content, isNewEntry);
  }, [firebaseUser?.uid, latestEntry?.id, isOffline, trackEntryCreated, trackEntryUpdated, updateSyncStats]);

  // Actual save function
  const performSave = useCallback(async (content: string, isNewEntry: boolean = false) => {
    try {
      setSaveStatus('saving');
      
      // Prepare entry data
      const entryData: Partial<JournalEntry> = {
        id: latestEntry?.id,
        uid: firebaseUser?.uid,
        content,
        timestamp: latestEntry?.timestamp ? new Date(latestEntry.timestamp) : new Date(),
        title: latestEntry?.title || ''
      };

      // If it's a new entry and we don't have an ID, one will be generated
      if (isNewEntry || !latestEntry) {
        entryData.id = latestEntry?.id || undefined; // Let service generate if needed
      }

      // Save offline
      const savedEntry = await OfflineJournalService.saveEntryOffline(entryData, isNewEntry || !latestEntry);
      
      // Update local state only if different
      setLatestEntry(prevEntry => {
        if (prevEntry?.id !== savedEntry.id || prevEntry?.content !== savedEntry.content) {
          return savedEntry;
        }
        return prevEntry;
      });
      
      lastSavedContentRef.current = content;
      
      // Track analytics (only for significant changes)
      if (content.length > 10) { // Only track if substantial content
        if (isNewEntry || !latestEntry) {
          trackEntryCreated({ entry_id: savedEntry.id });
        } else {
          trackEntryUpdated({ 
            entry_id: savedEntry.id, 
            content_length: content.length 
          });
        }
      }
      
      // Set status based on connection
      if (isOffline) {
        setSaveStatus('offline');
        console.log('📱 Entry saved offline (no internet):', savedEntry.id);
      } else {
        setSaveStatus('saved');
        console.log('📱 Entry saved offline (will sync):', savedEntry.id);
        
        // Trigger sync after a short delay
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current);
        }
        syncTimeoutRef.current = setTimeout(() => {
          syncNow();
        }, 1000);
      }
      
      // Update sync stats (throttled)
      updateSyncStats();
      
    } catch (error) {
      console.error('❌ Error saving entry offline:', error);
      setSaveStatus('unsaved');
    }
  }, [firebaseUser?.uid, latestEntry?.id, isOffline, trackEntryCreated, trackEntryUpdated, updateSyncStats]);

  // Create new entry
  const createNewEntry = useCallback(() => {
    setIsCreatingNewEntry(true);
    setLatestEntry(null);
    lastSavedContentRef.current = '';
    setSaveStatus('unsaved');
    console.log('📝 Created new entry');
    
    // Reset flag after a short delay
    setTimeout(() => {
      setIsCreatingNewEntry(false);
    }, 100);
  }, []);

  // Sync to Firestore
  const syncNow = useCallback(async () => {
    if (!firebaseUser || isOffline || isSyncing) {
      console.log('⏭️ Skipping sync:', { 
        hasUser: !!firebaseUser, 
        isOffline, 
        isSyncing 
      });
      return;
    }

    try {
      setIsSyncing(true);
      setSaveStatus('syncing');
      
      console.log('🔄 Starting sync to Firestore...');
      const result = await OfflineJournalService.syncToFirestore(firebaseUser);
      
      if (result.failed > 0) {
        setSaveStatus('sync_failed');
        console.log(`⚠️ Sync completed with failures: ${result.success} success, ${result.failed} failed`);
      } else {
        setSaveStatus('saved');
        console.log(`✅ Sync completed successfully: ${result.success} entries synced`);
      }
      
      // Update sync stats
      await updateSyncStats();
      
    } catch (error) {
      console.error('❌ Sync failed:', error);
      setSaveStatus('sync_failed');
    } finally {
      setIsSyncing(false);
    }
  }, [firebaseUser, isOffline, isSyncing, updateSyncStats]);

  // Download and merge from Firestore when coming back online
  const downloadAndMerge = useCallback(async () => {
    if (!firebaseUser || isOffline) return;

    try {
      console.log('📥 Downloading and merging from Firestore...');
      await OfflineJournalService.downloadAndMergeFromFirestore(firebaseUser);
      
      // Reload latest entry after merge
      await loadLatestEntry();
      await updateSyncStats();
      
      console.log('✅ Download and merge completed');
    } catch (error) {
      console.error('❌ Error during download and merge:', error);
    }
  }, [firebaseUser, isOffline, loadLatestEntry, updateSyncStats]);

  // Initialize offline journal (only once when user changes)
  useEffect(() => {
    if (isFirebaseReady && firebaseUser?.uid) {
      loadLatestEntry();
      updateSyncStats();
    }
  }, [isFirebaseReady, firebaseUser?.uid]); // Remove loadLatestEntry and updateSyncStats from deps to prevent loops

  // Handle network state changes (debounced and optimized)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const handleNetworkChange = async () => {
      if (!isOffline && firebaseUser?.uid && !hasInitialSyncRef.current) {
        // Coming back online - download and merge first, then sync
        console.log('🌐 Coming back online, starting sync...');
        await downloadAndMerge();
        await syncNow();
        hasInitialSyncRef.current = true;
      } else if (!isOffline && firebaseUser?.uid && hasInitialSyncRef.current) {
        // Already online, just sync pending changes (throttled)
        const pendingEntries = await OfflineJournalService.getUnsyncedEntries();
        if (pendingEntries.length > 0) {
          console.log(`🔄 Syncing ${pendingEntries.length} pending entries...`);
          await syncNow();
        }
      }
      
      // Update status based on connection
      if (isOffline && saveStatus === 'saved') {
        setSaveStatus('offline');
      } else if (!isOffline && saveStatus === 'offline') {
        setSaveStatus('saved');
      }
    };

    // Debounce network changes to prevent rapid firing
    timeoutId = setTimeout(handleNetworkChange, 2000);
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isOffline, firebaseUser?.uid, saveStatus]); // Remove function dependencies to prevent loops

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  // Force save current content immediately (for app state changes)
  const forceSave = useCallback(async (content: string) => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    if (content && content !== lastSavedContentRef.current) {
      await performSave(content, false);
    }
  }, [performSave]);

  return {
    // Entry management
    latestEntry,
    saveEntry,
    createNewEntry,
    forceSave, // New function for immediate save
    
    // Status
    saveStatus,
    isOffline,
    isSyncing,
    
    // Sync management
    syncNow,
    pendingSyncCount,
    lastSyncTime,
    
    // Loading states
    isLoadingEntry
  };
}
