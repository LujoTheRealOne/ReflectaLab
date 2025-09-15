import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, onSnapshot, Timestamp } from 'firebase/firestore';

// Types
export interface CachedEntry {
  id: string;
  title: string;
  content: string;
  timestamp: string; // ISO string for JSON compatibility
  uid: string;
  linkedCoachingSessionId?: string;
  linkedCoachingMessageId?: string;
  lastUpdated?: string;
  _syncStatus: 'synced' | 'pending' | 'local-only';
  _lastSyncAttempt?: string;
}

export interface SyncState {
  lastSyncTime: string;
  syncInProgress: boolean;
  pendingUploads: string[]; // entry IDs
  failedSyncs: string[];
}

// Storage Keys
const STORAGE_KEYS = {
  ENTRIES: '@entries_cache',
  SYNC_STATE: '@sync_state',
  USER_DATA: '@user_data',
} as const;

class SyncService {
  private syncInProgress = false;
  private syncListeners: Array<(status: SyncState) => void> = [];
  private realTimeUnsubscribe: (() => void) | null = null;
  private lastCacheLogCount: number = 0;
  private cacheUpdateListeners: Array<(userId: string, entries: CachedEntry[]) => void> = [];

  // =====================
  // CACHE MANAGEMENT
  // =====================

  async getCachedEntries(userId: string): Promise<CachedEntry[]> {
    try {
      const cached = await AsyncStorage.getItem(`${STORAGE_KEYS.ENTRIES}_${userId}`);
      if (!cached) return [];
      
      const entries: CachedEntry[] = JSON.parse(cached);
      // Only log on first load or significant changes
      if (!this.lastCacheLogCount || Math.abs(entries.length - this.lastCacheLogCount) > 0) {
        console.log(`📱 Loaded ${entries.length} cached entries for user ${userId}`);
        this.lastCacheLogCount = entries.length;
      }
      return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      console.error('❌ Error loading cached entries:', error);
      return [];
    }
  }

  async setCachedEntries(userId: string, entries: CachedEntry[]): Promise<void> {
    try {
      // Deduplicate entries by ID to prevent duplicate keys in UI
      const uniqueEntries = entries.reduce((acc, entry) => {
        const existingIndex = acc.findIndex(e => e.id === entry.id);
        if (existingIndex >= 0) {
          // Keep the entry with most recent timestamp or better sync status
          const existing = acc[existingIndex];
          const entryTime = new Date(entry.timestamp).getTime();
          const existingTime = new Date(existing.timestamp).getTime();
          
          if (entryTime > existingTime || entry._syncStatus === 'synced') {
            acc[existingIndex] = entry;
          }
        } else {
          acc.push(entry);
        }
        return acc;
      }, [] as CachedEntry[]);
      
      const sortedEntries = uniqueEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      await AsyncStorage.setItem(`${STORAGE_KEYS.ENTRIES}_${userId}`, JSON.stringify(sortedEntries));
      
      // Only log on significant changes to reduce noise
      if (!this.lastCacheLogCount || Math.abs(sortedEntries.length - this.lastCacheLogCount) > 0) {
        console.log(`💾 Cached ${sortedEntries.length} unique entries for user ${userId}`);
        this.lastCacheLogCount = sortedEntries.length;
      }
      
      // Notify cache update listeners
      this.cacheUpdateListeners.forEach(listener => {
        try {
          listener(userId, sortedEntries);
        } catch (error) {
          console.error('❌ Cache update listener error:', error);
        }
      });
    } catch (error) {
      console.error('❌ Error caching entries:', error);
    }
  }

  onCacheUpdate(listener: (userId: string, entries: CachedEntry[]) => void): () => void {
    this.cacheUpdateListeners.push(listener);
    return () => {
      const index = this.cacheUpdateListeners.indexOf(listener);
      if (index >= 0) {
        this.cacheUpdateListeners.splice(index, 1);
      }
    };
  }

  async getSyncState(userId: string): Promise<SyncState> {
    try {
      const cached = await AsyncStorage.getItem(`${STORAGE_KEYS.SYNC_STATE}_${userId}`);
      if (!cached) {
        return {
          lastSyncTime: new Date(0).toISOString(),
          syncInProgress: false,
          pendingUploads: [],
          failedSyncs: [],
        };
      }
      return JSON.parse(cached);
    } catch (error) {
      console.error('❌ Error loading sync state:', error);
      return {
        lastSyncTime: new Date(0).toISOString(),
        syncInProgress: false,
        pendingUploads: [],
        failedSyncs: [],
      };
    }
  }

  async setSyncState(userId: string, state: SyncState): Promise<void> {
    try {
      await AsyncStorage.setItem(`${STORAGE_KEYS.SYNC_STATE}_${userId}`, JSON.stringify(state));
      this.notifySyncListeners(state);
    } catch (error) {
      console.error('❌ Error saving sync state:', error);
    }
  }

  // =====================
  // SYNC LISTENERS
  // =====================

  addSyncListener(listener: (status: SyncState) => void): () => void {
    this.syncListeners.push(listener);
    return () => {
      this.syncListeners = this.syncListeners.filter(l => l !== listener);
    };
  }

  private notifySyncListeners(state: SyncState): void {
    // Only notify if there are actual listeners to prevent unnecessary updates
    if (this.syncListeners.length > 0) {
      this.syncListeners.forEach(listener => listener(state));
    }
  }

  // =====================
  // INITIAL SYNC (App Launch)
  // =====================

  async initialSync(userId: string): Promise<CachedEntry[]> {
    console.log('🔄 Starting initial sync for user:', userId);
    
    try {
      // Return cached entries immediately - no background sync unless requested
      const cachedEntries = await this.getCachedEntries(userId);
      console.log('✅ Initial sync completed instantly from cache');
      
      return cachedEntries;
    } catch (error) {
      console.error('❌ Initial sync error:', error);
      return [];
    }
  }

  async performBackgroundSync(userId: string): Promise<void> {
    if (this.syncInProgress) {
      console.log('⏭️ Sync already in progress, skipping');
      return;
    }

    this.syncInProgress = true;
    const syncState = await this.getSyncState(userId);
    
    try {
      await this.setSyncState(userId, { ...syncState, syncInProgress: true });
      
      console.log('🔄 Performing background sync...');
      
      // Fetch latest entries from Firestore
      const latestEntries = await this.fetchEntriesFromFirestore(userId);
      
      // Merge with local cache (keep local-only entries)
      const mergedEntries = await this.mergeEntries(userId, latestEntries);
      
      // Update cache
      await this.setCachedEntries(userId, mergedEntries);
      
      // Update sync state
      await this.setSyncState(userId, {
        lastSyncTime: new Date().toISOString(),
        syncInProgress: false,
        pendingUploads: syncState.pendingUploads,
        failedSyncs: [],
      });
      
      console.log('✅ Background sync completed');
      
    } catch (error) {
      console.error('❌ Background sync failed:', error);
      
      await this.setSyncState(userId, {
        ...syncState,
        syncInProgress: false,
        failedSyncs: [...syncState.failedSyncs, new Date().toISOString()],
      });
    } finally {
      this.syncInProgress = false;
    }
  }

  // =====================
  // OFFLINE-FIRST SYNC
  // =====================

  async syncSingleEntryToBackend(userId: string, entryId: string): Promise<void> {
    try {
      console.log(`🔄 Syncing entry ${entryId} to backend...`);
      
      // Get entry from cache
      const cachedEntries = await this.getCachedEntries(userId);
      const entry = cachedEntries.find(e => e.id === entryId);
      
      if (!entry) {
        throw new Error(`Entry ${entryId} not found in cache`);
      }

      // Import Firebase functions dynamically
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      
      // Upload to Firestore
      const entryRef = doc(db, 'journal_entries', entryId);
      await setDoc(entryRef, {
        id: entryId,
        uid: userId,
        title: entry.title || '',
        content: entry.content,
        timestamp: serverTimestamp(),
        linkedCoachingSessionId: entry.linkedCoachingSessionId || null,
        linkedCoachingMessageId: entry.linkedCoachingMessageId || null,
        lastUpdated: serverTimestamp(),
      });

      // Update sync status in cache
      const updatedEntries = cachedEntries.map(e => 
        e.id === entryId 
          ? { ...e, _syncStatus: 'synced' as const, _lastSyncAttempt: new Date().toISOString() }
          : e
      );
      
      await this.setCachedEntries(userId, updatedEntries);
      console.log(`✅ Entry ${entryId} synced to backend successfully`);
      
    } catch (error) {
      console.error(`❌ Failed to sync entry ${entryId} to backend:`, error);
      
      // Mark as failed in cache
      const cachedEntries = await this.getCachedEntries(userId);
      const updatedEntries = cachedEntries.map(e => 
        e.id === entryId 
          ? { ...e, _syncStatus: 'pending' as const, _lastSyncAttempt: new Date().toISOString() }
          : e
      );
      await this.setCachedEntries(userId, updatedEntries);
      
      throw error;
    }
  }

  async forceUploadAllCachedEntries(userId: string): Promise<void> {
    try {
      console.log('📤 FORCE UPLOAD: Starting upload of offline entries to backend...');
      
      const cachedEntries = await this.getCachedEntries(userId);
      const offlineEntries = cachedEntries.filter(e => e._syncStatus === 'local-only' || e._syncStatus === 'pending');
      
      if (offlineEntries.length === 0) {
        console.log('✅ No offline entries found, all synced');
        return;
      }

      console.log(`📤 Found ${offlineEntries.length} offline entries, uploading...`);
      
      let successCount = 0;
      let failCount = 0;
      
      // Upload entries one by one to avoid overwhelming the backend
      for (const entry of offlineEntries) {
        try {
          await this.syncSingleEntryToBackend(userId, entry.id);
          successCount++;
          console.log(`✅ ${successCount}/${offlineEntries.length} offline entries uploaded`);
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 150));
          
        } catch (error) {
          failCount++;
          console.error(`❌ Failed to upload offline entry ${entry.id}:`, error);
        }
      }
      
      console.log(`📤 FORCE UPLOAD COMPLETED: ${successCount} success, ${failCount} failed`);
      
    } catch (error) {
      console.error('❌ FORCE UPLOAD FAILED:', error);
      throw error;
    }
  }

  // =====================
  // FIRESTORE OPERATIONS
  // =====================

  private async fetchEntriesFromFirestore(userId: string): Promise<CachedEntry[]> {
    try {
      const entriesQuery = query(
        collection(db, 'journal_entries'),
        where('uid', '==', userId),
        orderBy('timestamp', 'desc')
      );

      const querySnapshot = await getDocs(entriesQuery);
      const entries: CachedEntry[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        entries.push({
          id: doc.id,
          title: data.title || '',
          content: data.content || '',
          timestamp: data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
          uid: data.uid,
          linkedCoachingSessionId: data.linkedCoachingSessionId,
          linkedCoachingMessageId: data.linkedCoachingMessageId,
          lastUpdated: data.lastUpdated?.toDate?.()?.toISOString(),
          _syncStatus: 'synced',
        });
      });

      console.log(`📥 Fetched ${entries.length} entries from Firestore`);
      return entries;
    } catch (error) {
      console.error('❌ Error fetching from Firestore:', error);
      throw error;
    }
  }

  private async mergeEntries(userId: string, firestoreEntries: CachedEntry[]): Promise<CachedEntry[]> {
    const cachedEntries = await this.getCachedEntries(userId);
    const merged = new Map<string, CachedEntry>();

    // Add Firestore entries (they're the source of truth for synced data)
    firestoreEntries.forEach(entry => {
      merged.set(entry.id, entry);
    });

    // Add local-only entries that haven't been synced yet
    cachedEntries.forEach(entry => {
      if (entry._syncStatus === 'local-only' || entry._syncStatus === 'pending') {
        merged.set(entry.id, entry);
      }
    });

    return Array.from(merged.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  // =====================
  // REAL-TIME SYNC
  // =====================

  startRealTimeSync(userId: string): void {
    if (this.realTimeUnsubscribe) {
      console.log('🔄 Real-time sync already active');
      return;
    }

    console.log('🔴 Starting real-time sync for user:', userId);

    const entriesQuery = query(
      collection(db, 'journal_entries'),
      where('uid', '==', userId),
      orderBy('timestamp', 'desc')
    );

    this.realTimeUnsubscribe = onSnapshot(entriesQuery, async (snapshot) => {
      try {
        console.log('🔴 Real-time update received:', snapshot.docs.length, 'entries');
        
        const latestEntries: CachedEntry[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          latestEntries.push({
            id: doc.id,
            title: data.title || '',
            content: data.content || '',
            timestamp: data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
            uid: data.uid,
            linkedCoachingSessionId: data.linkedCoachingSessionId,
            linkedCoachingMessageId: data.linkedCoachingMessageId,
            lastUpdated: data.lastUpdated?.toDate?.()?.toISOString(),
            _syncStatus: 'synced',
          });
        });

        // Merge and update cache
        const mergedEntries = await this.mergeEntries(userId, latestEntries);
        await this.setCachedEntries(userId, mergedEntries);
        
      } catch (error) {
        console.error('❌ Real-time sync error:', error);
      }
    }, (error) => {
      console.error('❌ Real-time sync listener error:', error);
    });
  }

  stopRealTimeSync(): void {
    if (this.realTimeUnsubscribe) {
      console.log('🔴 Stopping real-time sync');
      this.realTimeUnsubscribe();
      this.realTimeUnsubscribe = null;
    }
  }

  // =====================
  // OPTIMISTIC UPDATES
  // =====================

  async addLocalEntry(userId: string, entry: (Omit<CachedEntry, '_syncStatus'> & { _syncStatus?: CachedEntry['_syncStatus'] }) | Omit<CachedEntry, 'id' | '_syncStatus'>): Promise<string> {
    // If entry has an id, use it (for synced entries), otherwise generate one (for new entries)
    const entryId = 'id' in entry ? entry.id : `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const syncStatus = ('_syncStatus' in entry && entry._syncStatus) ? entry._syncStatus : 'local-only';
    
    const localEntry: CachedEntry = {
      ...entry,
      id: entryId,
      _syncStatus: syncStatus,
    };

    console.log('📝 Adding local entry:', entryId, 'status:', syncStatus);

    // Add to cache immediately (check for duplicates)
    const cachedEntries = await this.getCachedEntries(userId);
    const existingIndex = cachedEntries.findIndex(e => e.id === entryId);
    
    let updatedEntries: CachedEntry[];
    if (existingIndex >= 0) {
      // Update existing entry instead of creating duplicate
      updatedEntries = [...cachedEntries];
      updatedEntries[existingIndex] = localEntry;
      console.log('📝 Updated existing cached entry:', entryId);
    } else {
      // Add new entry
      updatedEntries = [localEntry, ...cachedEntries];
      console.log('🆕 Added new entry to cache');
    }
    
    await this.setCachedEntries(userId, updatedEntries);

    // Queue for sync only if it's a local-only entry
    if (syncStatus === 'local-only') {
      const syncState = await this.getSyncState(userId);
      await this.setSyncState(userId, {
        ...syncState,
        pendingUploads: [...syncState.pendingUploads, entryId],
      });
    }

    return entryId;
  }

  async updateLocalEntry(userId: string, entryId: string, updates: Partial<CachedEntry>): Promise<void> {
    console.log('✏️ Updating local entry:', entryId);

    const cachedEntries = await this.getCachedEntries(userId);
    const entryIndex = cachedEntries.findIndex(e => e.id === entryId);
    
    if (entryIndex === -1) {
      console.warn(`⚠️ Entry ${entryId} not found in cache for update`);
      return;
    }
    
    const updatedEntries = [...cachedEntries];
    updatedEntries[entryIndex] = {
      ...updatedEntries[entryIndex],
      ...updates,
      _syncStatus: updatedEntries[entryIndex]._syncStatus === 'synced' ? 'pending' : updatedEntries[entryIndex]._syncStatus,
    };

    await this.setCachedEntries(userId, updatedEntries);
    console.log('📝 Updated existing entry in cache');

    // Queue for sync if not already pending
    const syncState = await this.getSyncState(userId);
    if (!syncState.pendingUploads.includes(entryId)) {
      await this.setSyncState(userId, {
        ...syncState,
        pendingUploads: [...syncState.pendingUploads, entryId],
      });
    }
  }

  async deleteLocalEntry(userId: string, entryId: string): Promise<void> {
    console.log('🗑️ Deleting local entry:', entryId);

    const cachedEntries = await this.getCachedEntries(userId);
    const entryIndex = cachedEntries.findIndex(e => e.id === entryId);
    
    if (entryIndex === -1) {
      console.warn(`⚠️ Entry ${entryId} not found in cache for deletion`);
      return;
    }
    
    // Remove entry from cache
    const updatedEntries = cachedEntries.filter(e => e.id !== entryId);
    await this.setCachedEntries(userId, updatedEntries);
    console.log('🗑️ Deleted entry from cache');

    // Remove from pending uploads if it was there
    const syncState = await this.getSyncState(userId);
    const updatedPendingUploads = syncState.pendingUploads.filter(id => id !== entryId);
    await this.setSyncState(userId, {
      ...syncState,
      pendingUploads: updatedPendingUploads,
    });
  }

  // =====================
  // CLEANUP
  // =====================

  async clearUserData(userId: string): Promise<void> {
    console.log('🧹 Clearing cached data for user:', userId);
    
    try {
      await AsyncStorage.multiRemove([
        `${STORAGE_KEYS.ENTRIES}_${userId}`,
        `${STORAGE_KEYS.SYNC_STATE}_${userId}`,
        `${STORAGE_KEYS.USER_DATA}_${userId}`,
      ]);
      
      this.stopRealTimeSync();
      console.log('✅ User data cleared');
    } catch (error) {
      console.error('❌ Error clearing user data:', error);
    }
  }
}

// Export singleton instance
export const syncService = new SyncService();
export default syncService;
