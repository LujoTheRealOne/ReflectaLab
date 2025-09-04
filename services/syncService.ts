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
      await AsyncStorage.setItem(`${STORAGE_KEYS.ENTRIES}_${userId}`, JSON.stringify(entries));
      console.log(`💾 Cached ${entries.length} entries for user ${userId}`);
    } catch (error) {
      console.error('❌ Error caching entries:', error);
    }
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
      // Start with cached entries for immediate UI
      const cachedEntries = await this.getCachedEntries(userId);
      
      // Sync in background without blocking UI
      this.performBackgroundSync(userId);
      
      return cachedEntries;
    } catch (error) {
      console.error('❌ Initial sync error:', error);
      return [];
    }
  }

  private async performBackgroundSync(userId: string): Promise<void> {
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

  async addLocalEntry(userId: string, entry: Omit<CachedEntry, 'id' | '_syncStatus'>): Promise<string> {
    const entryId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const localEntry: CachedEntry = {
      ...entry,
      id: entryId,
      _syncStatus: 'local-only',
    };

    console.log('📝 Adding local entry:', entryId);

    // Add to cache immediately
    const cachedEntries = await this.getCachedEntries(userId);
    const updatedEntries = [localEntry, ...cachedEntries];
    await this.setCachedEntries(userId, updatedEntries);

    // Queue for sync
    const syncState = await this.getSyncState(userId);
    await this.setSyncState(userId, {
      ...syncState,
      pendingUploads: [...syncState.pendingUploads, entryId],
    });

    return entryId;
  }

  async updateLocalEntry(userId: string, entryId: string, updates: Partial<CachedEntry>): Promise<void> {
    console.log('✏️ Updating local entry:', entryId);

    const cachedEntries = await this.getCachedEntries(userId);
    const updatedEntries = cachedEntries.map(entry => {
      if (entry.id === entryId) {
        return {
          ...entry,
          ...updates,
          _syncStatus: entry._syncStatus === 'synced' ? 'pending' : entry._syncStatus,
        };
      }
      return entry;
    });

    await this.setCachedEntries(userId, updatedEntries);

    // Queue for sync if not already pending
    const syncState = await this.getSyncState(userId);
    if (!syncState.pendingUploads.includes(entryId)) {
      await this.setSyncState(userId, {
        ...syncState,
        pendingUploads: [...syncState.pendingUploads, entryId],
      });
    }
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
