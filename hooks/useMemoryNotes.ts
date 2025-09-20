// 🧠 MEMORY NOTES HOOK
// Pure in-memory notes management with backend sync

import { useState, useEffect, useCallback } from 'react';
import { memoryNotesService, MemoryNote } from '@/services/memoryNotesService';
import { useAuth } from './useAuth';
import { useNetworkConnectivity } from './useNetworkConnectivity';

export interface UseMemoryNotesReturn {
  notes: MemoryNote[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  addNote: (note: Omit<MemoryNote, 'id' | 'syncStatus'>) => Promise<string>;
  updateNote: (noteId: string, updates: Partial<MemoryNote>) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  refreshNotes: () => Promise<void>;
  syncPendingNotes: () => Promise<{ synced: number; failed: number }>;
  
  // State
  pendingUploadsCount: number;
  lastSyncTime: string | null;
  isSyncing: boolean;
}

// Global state for memory notes
let globalNotes: MemoryNote[] = [];
let globalIsLoading = false;
let globalError: string | null = null;
let globalPendingUploadsCount = 0;
let globalLastSyncTime: string | null = null;
let globalIsSyncing = false;
let currentUserId: string | null = null;

// Global listeners for state updates
const globalListeners = new Set<() => void>();

function updateGlobalState(updates: {
  notes?: MemoryNote[];
  isLoading?: boolean;
  error?: string | null;
  pendingUploadsCount?: number;
  lastSyncTime?: string | null;
  isSyncing?: boolean;
}) {
  if (updates.notes !== undefined) globalNotes = updates.notes;
  if (updates.isLoading !== undefined) globalIsLoading = updates.isLoading;
  if (updates.error !== undefined) globalError = updates.error;
  if (updates.pendingUploadsCount !== undefined) globalPendingUploadsCount = updates.pendingUploadsCount;
  if (updates.lastSyncTime !== undefined) globalLastSyncTime = updates.lastSyncTime;
  if (updates.isSyncing !== undefined) globalIsSyncing = updates.isSyncing;
  
  // Notify all listeners
  globalListeners.forEach(listener => {
    try {
      listener();
    } catch (error) {
      console.error('❌ Global listener error:', error);
    }
  });
}

function clearGlobalState() {
  updateGlobalState({
    notes: [],
    isLoading: false,
    error: null,
    pendingUploadsCount: 0,
    lastSyncTime: null,
    isSyncing: false,
  });
}

async function initializeUserNotes(userId: string) {
  if (currentUserId === userId) {
    console.log('⏭️ User already initialized, skipping');
    return;
  }
  
  console.log(`🚀 Initializing memory notes for user: ${userId}`);
  currentUserId = userId;
  
  updateGlobalState({ isLoading: true, error: null });
  
  try {
    // Initialize user and load their notes
    const notes = await memoryNotesService.initializeUser(userId);
    const syncState = memoryNotesService.getSyncState(userId);
    
    updateGlobalState({
      notes,
      isLoading: false,
      pendingUploadsCount: syncState.pendingUploads.length,
      lastSyncTime: syncState.lastSyncTime !== new Date(0).toISOString() ? syncState.lastSyncTime : null,
    });
    
    console.log(`✅ Memory notes initialized with ${notes.length} notes`);
  } catch (error) {
    console.error('❌ Error initializing memory notes:', error);
    updateGlobalState({
      isLoading: false,
      error: error instanceof Error ? error.message : 'Failed to initialize notes',
    });
  }
}

// Setup network listener for auto-sync
let networkListenerSetup = false;

function setupNetworkListener() {
  if (networkListenerSetup) return;
  networkListenerSetup = true;
  
  console.log('🌐 Setting up network listener for auto-sync');
  
  // This will be handled by the hook's useEffect
}

export function useMemoryNotes(): UseMemoryNotesReturn {
  const { firebaseUser } = useAuth();
  const { isConnected, isInternetReachable } = useNetworkConnectivity();
  const [, forceUpdate] = useState({});

  // Force re-render when global state changes
  useEffect(() => {
    const listener = () => forceUpdate({});
    globalListeners.add(listener);
    return () => globalListeners.delete(listener);
  }, []);

  // Setup network listener
  useEffect(() => {
    setupNetworkListener();
  }, []);

  // Listen for memory updates
  useEffect(() => {
    if (!firebaseUser?.uid) return;
    
    const unsubscribe = memoryNotesService.onCacheUpdate((userId, notes) => {
      if (userId === firebaseUser.uid) {
        console.log('🧠 Memory updated, refreshing UI with', notes.length, 'notes');
        const syncState = memoryNotesService.getSyncState(userId);
        updateGlobalState({ 
          notes,
          pendingUploadsCount: syncState.pendingUploads.length,
        });
      }
    });
    
    return unsubscribe;
  }, [firebaseUser?.uid]);

  // Initialize user when they sign in
  useEffect(() => {
    if (firebaseUser?.uid) {
      initializeUserNotes(firebaseUser.uid);
    } else {
      // Clear data when user signs out
      if (currentUserId) {
        console.log('🧹 User signed out, clearing memory notes');
        memoryNotesService.clearUserData(currentUserId);
        currentUserId = null;
        clearGlobalState();
      }
    }
  }, [firebaseUser?.uid]);

  // Auto-sync when network reconnects
  useEffect(() => {
    const isOnline = isConnected === true && isInternetReachable === true;
    
    if (isOnline && firebaseUser?.uid && currentUserId === firebaseUser.uid) {
      // Debounce network changes to avoid excessive syncing
      const syncTimeout = setTimeout(async () => {
        try {
          console.log('🌐 Network connected - triggering auto-sync for pending notes');
          
          const syncState = memoryNotesService.getSyncState(firebaseUser.uid);
          if (syncState.pendingUploads.length > 0) {
            updateGlobalState({ isSyncing: true });
            
            const result = await memoryNotesService.syncPendingNotes(firebaseUser.uid);
            console.log(`✅ Auto-sync completed: ${result.synced} synced, ${result.failed} failed`);
            
            // Update state
            const updatedSyncState = memoryNotesService.getSyncState(firebaseUser.uid);
            updateGlobalState({
              isSyncing: false,
              pendingUploadsCount: updatedSyncState.pendingUploads.length,
              lastSyncTime: updatedSyncState.lastSyncTime,
            });
          }
        } catch (error) {
          console.error('❌ Auto-sync failed:', error);
          updateGlobalState({ isSyncing: false });
        }
      }, 2000); // 2 second delay to let network stabilize
      
      return () => clearTimeout(syncTimeout);
    }
  }, [isConnected, isInternetReachable, firebaseUser?.uid]);

  // Public methods
  const addNote = useCallback(async (note: Omit<MemoryNote, 'syncStatus'> | Omit<MemoryNote, 'id' | 'syncStatus'>): Promise<string> => {
    if (!firebaseUser?.uid) {
      throw new Error('No authenticated user');
    }

    const isOnline = isConnected === true && isInternetReachable === true;
    
    // Use provided ID or generate new one
    const noteId = 'id' in note ? note.id : `${isOnline ? 'note' : 'offline'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const memoryNote: MemoryNote = {
      ...note,
      id: noteId,
      syncStatus: isOnline ? 'pending' : 'local-only',
      createdOffline: !isOnline,
      timestamp: note.timestamp || new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };

    console.log(`➕ Adding note to memory: ${noteId} (${isOnline ? 'online' : 'offline'})`);
    
    // Add to memory
    memoryNotesService.addNote(firebaseUser.uid, memoryNote);
    
    // Try to sync immediately if online
    if (isOnline) {
      try {
        updateGlobalState({ isSyncing: true });
        await memoryNotesService.syncPendingNotes(firebaseUser.uid);
        
        const syncState = memoryNotesService.getSyncState(firebaseUser.uid);
        updateGlobalState({
          isSyncing: false,
          pendingUploadsCount: syncState.pendingUploads.length,
          lastSyncTime: syncState.lastSyncTime,
        });
      } catch (error) {
        console.error('❌ Immediate sync failed:', error);
        updateGlobalState({ isSyncing: false });
      }
    }
    
    return noteId;
  }, [firebaseUser?.uid, isConnected, isInternetReachable]);

  const updateNote = useCallback(async (noteId: string, updates: Partial<MemoryNote>): Promise<void> => {
    if (!firebaseUser?.uid) {
      throw new Error('No authenticated user');
    }

    const isOnline = isConnected === true && isInternetReachable === true;
    
    const updateData = {
      ...updates,
      lastUpdated: new Date().toISOString(),
      syncStatus: isOnline ? 'pending' : 'local-only',
    };

    console.log(`📝 Updating note in memory: ${noteId}`);
    
    // Update in memory
    memoryNotesService.updateNote(firebaseUser.uid, noteId, updateData);
    
    // Try to sync immediately if online
    if (isOnline) {
      try {
        updateGlobalState({ isSyncing: true });
        await memoryNotesService.syncPendingNotes(firebaseUser.uid);
        
        const syncState = memoryNotesService.getSyncState(firebaseUser.uid);
        updateGlobalState({
          isSyncing: false,
          pendingUploadsCount: syncState.pendingUploads.length,
          lastSyncTime: syncState.lastSyncTime,
        });
      } catch (error) {
        console.error('❌ Immediate sync failed:', error);
        updateGlobalState({ isSyncing: false });
      }
    }
  }, [firebaseUser?.uid, isConnected, isInternetReachable]);

  const deleteNote = useCallback(async (noteId: string): Promise<void> => {
    if (!firebaseUser?.uid) {
      throw new Error('No authenticated user');
    }

    console.log(`🗑️ Deleting note from memory: ${noteId}`);
    memoryNotesService.deleteNote(firebaseUser.uid, noteId);
    
    // TODO: Handle backend deletion when online
  }, [firebaseUser?.uid]);

  const refreshNotes = useCallback(async (): Promise<void> => {
    if (!firebaseUser?.uid) return;

    console.log('🔄 Manual refresh requested');
    updateGlobalState({ isLoading: true, error: null });

    try {
      const notes = await memoryNotesService.loadNotesFromBackend(firebaseUser.uid);
      const syncState = memoryNotesService.getSyncState(firebaseUser.uid);
      
      updateGlobalState({
        notes,
        isLoading: false,
        pendingUploadsCount: syncState.pendingUploads.length,
        lastSyncTime: syncState.lastSyncTime !== new Date(0).toISOString() ? syncState.lastSyncTime : null,
      });
      
      console.log(`✅ Manual refresh completed with ${notes.length} notes`);
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
      updateGlobalState({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Refresh failed',
      });
    }
  }, [firebaseUser?.uid]);

  const syncPendingNotes = useCallback(async (): Promise<{ synced: number; failed: number }> => {
    if (!firebaseUser?.uid) {
      return { synced: 0, failed: 0 };
    }

    console.log('🔄 Manual sync requested');
    updateGlobalState({ isSyncing: true });

    try {
      const result = await memoryNotesService.syncPendingNotes(firebaseUser.uid);
      
      const syncState = memoryNotesService.getSyncState(firebaseUser.uid);
      updateGlobalState({
        isSyncing: false,
        pendingUploadsCount: syncState.pendingUploads.length,
        lastSyncTime: syncState.lastSyncTime,
      });
      
      console.log(`✅ Manual sync completed: ${result.synced} synced, ${result.failed} failed`);
      return result;
    } catch (error) {
      console.error('❌ Manual sync failed:', error);
      updateGlobalState({ isSyncing: false });
      return { synced: 0, failed: 0 };
    }
  }, [firebaseUser?.uid]);

  return {
    notes: globalNotes,
    isLoading: globalIsLoading,
    error: globalError,
    addNote,
    updateNote,
    deleteNote,
    refreshNotes,
    syncPendingNotes,
    pendingUploadsCount: globalPendingUploadsCount,
    lastSyncTime: globalLastSyncTime,
    isSyncing: globalIsSyncing,
  };
}
