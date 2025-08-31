import AsyncStorage from '@react-native-async-storage/async-storage';
import { JournalEntry, OfflineJournalEntry, SyncQueueItem, SyncResult, SyncStats } from '@/types';
import { db } from '@/lib/firebase';
import { doc, setDoc, updateDoc, serverTimestamp, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import { OfflineAuthService } from './offlineAuthService';

export class OfflineJournalService {
  private static OFFLINE_ENTRIES_KEY = 'offline_journal_entries';
  private static SYNC_QUEUE_KEY = 'journal_sync_queue';
  private static LAST_SYNC_KEY = 'last_journal_sync';

  // Save journal entry offline
  static async saveEntryOffline(entry: Partial<JournalEntry>, isNewEntry: boolean = false): Promise<OfflineJournalEntry> {
    try {
      // Security check: Verify user identity
      if (entry.uid && !(await OfflineAuthService.verifyOfflineUserIdentity(entry.uid))) {
        throw new Error('Unauthorized: User identity verification failed');
      }

      const entryId = entry.id || Crypto.randomUUID();
      const now = new Date().toISOString();
      
      const offlineEntry: OfflineJournalEntry = {
        id: entryId,
        uid: entry.uid || '',
        content: entry.content || '',
        timestamp: entry.timestamp ? entry.timestamp.toISOString() : now,
        lastUpdated: now,
        title: entry.title || '',
        linkedCoachingMessageId: entry.linkedCoachingMessageId,
        linkedCoachingSessionId: entry.linkedCoachingSessionId,
        isSynced: false,
        needsSync: true,
        isNewEntry,
        syncAttempts: 0
      };

      // Get existing offline entries
      const existingEntries = await this.getOfflineEntries();
      
      // Update or add the entry
      const updatedEntries = {
        ...existingEntries,
        [entryId]: offlineEntry
      };

      // Save to AsyncStorage
      await AsyncStorage.setItem(this.OFFLINE_ENTRIES_KEY, JSON.stringify(updatedEntries));
      
      // Add to sync queue
      await this.addToSyncQueue(entryId, isNewEntry ? 'create' : 'update');

      console.log('📱 Entry saved offline:', entryId);
      return offlineEntry;
    } catch (error) {
      console.error('❌ Error saving entry offline:', error);
      throw error;
    }
  }

  // Get all offline entries
  static async getOfflineEntries(): Promise<Record<string, OfflineJournalEntry>> {
    try {
      const entriesJson = await AsyncStorage.getItem(this.OFFLINE_ENTRIES_KEY);
      return entriesJson ? JSON.parse(entriesJson) : {};
    } catch (error) {
      console.error('❌ Error getting offline entries:', error);
      return {};
    }
  }

  // Get latest offline entry for a user
  static async getLatestOfflineEntry(uid: string): Promise<OfflineJournalEntry | null> {
    try {
      // Security check: Verify user identity
      if (!(await OfflineAuthService.verifyOfflineUserIdentity(uid))) {
        console.warn('⚠️ Unauthorized access attempt to get latest entry for uid:', uid);
        return null;
      }

      const entries = await this.getOfflineEntries();
      const userEntries = Object.values(entries)
        .filter(entry => entry.uid === uid)
        .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
      
      return userEntries[0] || null;
    } catch (error) {
      console.error('❌ Error getting latest offline entry:', error);
      return null;
    }
  }

  // Get unsynced entries
  static async getUnsyncedEntries(): Promise<OfflineJournalEntry[]> {
    try {
      const entries = await this.getOfflineEntries();
      return Object.values(entries).filter(entry => entry.needsSync && !entry.isSynced);
    } catch (error) {
      console.error('❌ Error getting unsynced entries:', error);
      return [];
    }
  }

  // Add entry to sync queue
  private static async addToSyncQueue(entryId: string, action: 'create' | 'update'): Promise<void> {
    try {
      const queueJson = await AsyncStorage.getItem(this.SYNC_QUEUE_KEY);
      const queue: SyncQueueItem[] = queueJson ? JSON.parse(queueJson) : [];
      
      // Remove existing queue item for this entry (to avoid duplicates)
      const filteredQueue = queue.filter(item => item.entryId !== entryId);
      
      // Add new queue item
      filteredQueue.push({
        entryId,
        action,
        timestamp: new Date().toISOString(),
        attempts: 0
      });

      await AsyncStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(filteredQueue));
    } catch (error) {
      console.error('❌ Error adding to sync queue:', error);
    }
  }

  // Get sync queue
  static async getSyncQueue(): Promise<SyncQueueItem[]> {
    try {
      const queueJson = await AsyncStorage.getItem(this.SYNC_QUEUE_KEY);
      return queueJson ? JSON.parse(queueJson) : [];
    } catch (error) {
      console.error('❌ Error getting sync queue:', error);
      return [];
    }
  }

  // Sync offline entries to Firestore
  static async syncToFirestore(firebaseUser: any): Promise<{ success: number; failed: number }> {
    if (!firebaseUser) {
      console.log('❌ No Firebase user for syncing');
      return { success: 0, failed: 0 };
    }

    let userEntries: OfflineJournalEntry[] = [];

    try {
      const unsyncedEntries = await this.getUnsyncedEntries();
      userEntries = unsyncedEntries.filter(entry => entry.uid === firebaseUser.uid);
      
      if (userEntries.length === 0) {
        console.log('✅ No entries to sync');
        return { success: 0, failed: 0 };
      }

      console.log(`🔄 Syncing ${userEntries.length} entries to Firestore...`);
      
      let successCount = 0;
      let failedCount = 0;

      for (const entry of userEntries) {
        try {
          // Prepare Firestore data
          const firestoreData = {
            uid: entry.uid,
            content: entry.content,
            timestamp: serverTimestamp(),
            lastUpdated: serverTimestamp(),
            ...(entry.title && { title: entry.title }),
            ...(entry.linkedCoachingMessageId && { linkedCoachingMessageId: entry.linkedCoachingMessageId }),
            ...(entry.linkedCoachingSessionId && { linkedCoachingSessionId: entry.linkedCoachingSessionId })
          };

          const docRef = doc(db, 'journal_entries', entry.id);

          if (entry.isNewEntry) {
            await setDoc(docRef, firestoreData);
            console.log('✅ Created new entry in Firestore:', entry.id);
          } else {
            await updateDoc(docRef, {
              content: entry.content,
              lastUpdated: serverTimestamp()
            });
            console.log('✅ Updated existing entry in Firestore:', entry.id);
          }

          // Mark as synced
          await this.markAsSynced(entry.id);
          successCount++;
          
        } catch (error) {
          console.error('❌ Failed to sync entry:', entry.id, error);
          await this.incrementSyncAttempts(entry.id);
          failedCount++;
        }
      }

      // Update last sync timestamp
      await AsyncStorage.setItem(this.LAST_SYNC_KEY, new Date().toISOString());
      
      console.log(`🔄 Sync completed: ${successCount} success, ${failedCount} failed`);
      return { success: successCount, failed: failedCount };
      
    } catch (error) {
      console.error('❌ Error during sync:', error);
      return { success: 0, failed: userEntries.length };
    }
  }

  // Mark entry as synced
  private static async markAsSynced(entryId: string): Promise<void> {
    try {
      const entries = await this.getOfflineEntries();
      if (entries[entryId]) {
        entries[entryId].isSynced = true;
        entries[entryId].needsSync = false;
        entries[entryId].lastSyncAttempt = new Date().toISOString();
        
        await AsyncStorage.setItem(this.OFFLINE_ENTRIES_KEY, JSON.stringify(entries));
        
        // Remove from sync queue
        await this.removeFromSyncQueue(entryId);
      }
    } catch (error) {
      console.error('❌ Error marking entry as synced:', error);
    }
  }

  // Increment sync attempts
  private static async incrementSyncAttempts(entryId: string): Promise<void> {
    try {
      const entries = await this.getOfflineEntries();
      if (entries[entryId]) {
        entries[entryId].syncAttempts += 1;
        entries[entryId].lastSyncAttempt = new Date().toISOString();
        
        await AsyncStorage.setItem(this.OFFLINE_ENTRIES_KEY, JSON.stringify(entries));
      }
    } catch (error) {
      console.error('❌ Error incrementing sync attempts:', error);
    }
  }

  // Remove from sync queue
  private static async removeFromSyncQueue(entryId: string): Promise<void> {
    try {
      const queueJson = await AsyncStorage.getItem(this.SYNC_QUEUE_KEY);
      const queue: SyncQueueItem[] = queueJson ? JSON.parse(queueJson) : [];
      
      const filteredQueue = queue.filter(item => item.entryId !== entryId);
      await AsyncStorage.setItem(this.SYNC_QUEUE_KEY, JSON.stringify(filteredQueue));
    } catch (error) {
      console.error('❌ Error removing from sync queue:', error);
    }
  }

  // Download and merge entries from Firestore (when coming back online)
  static async downloadAndMergeFromFirestore(firebaseUser: any): Promise<void> {
    if (!firebaseUser) return;

    try {
      console.log('📥 Downloading entries from Firestore...');
      
      // Get entries from Firestore
      const entriesQuery = query(
        collection(db, 'journal_entries'),
        where('uid', '==', firebaseUser.uid),
        orderBy('timestamp', 'desc')
      );

      const querySnapshot = await getDocs(entriesQuery);
      const firestoreEntries: JournalEntry[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        firestoreEntries.push({
          id: doc.id,
          uid: data.uid,
          content: data.content,
          timestamp: data.timestamp?.toDate() || new Date(),
          lastUpdated: data.lastUpdated?.toDate() || new Date(),
          title: data.title || '',
          linkedCoachingMessageId: data.linkedCoachingMessageId,
          linkedCoachingSessionId: data.linkedCoachingSessionId
        });
      });

      // Get offline entries
      const offlineEntries = await this.getOfflineEntries();
      
      // Merge: Firestore entries take precedence if they're newer
      for (const firestoreEntry of firestoreEntries) {
        const offlineEntry = offlineEntries[firestoreEntry.id];
        
        if (!offlineEntry || 
            (offlineEntry.isSynced && new Date(firestoreEntry.lastUpdated) > new Date(offlineEntry.lastUpdated))) {
          
          // Convert Firestore entry to offline format and mark as synced
          const mergedEntry: OfflineJournalEntry = {
            ...firestoreEntry,
            timestamp: firestoreEntry.timestamp.toISOString(),
            lastUpdated: firestoreEntry.lastUpdated.toISOString(),
            isSynced: true,
            needsSync: false,
            isNewEntry: false,
            syncAttempts: 0,
            linkedCoachingSessionId: firestoreEntry.linkedCoachingSessionId
          };
          
          offlineEntries[firestoreEntry.id] = mergedEntry;
        }
      }

      // Save merged entries
      await AsyncStorage.setItem(this.OFFLINE_ENTRIES_KEY, JSON.stringify(offlineEntries));
      console.log('✅ Entries merged from Firestore');
      
    } catch (error) {
      console.error('❌ Error downloading from Firestore:', error);
    }
  }

  // Delete an offline entry
  static async deleteOfflineEntry(entryId: string): Promise<void> {
    try {
      const entries = await this.getOfflineEntries();
      
      if (entries[entryId]) {
        delete entries[entryId];
        await AsyncStorage.setItem(this.OFFLINE_ENTRIES_KEY, JSON.stringify(entries));
        
        // Remove from sync queue
        await this.removeFromSyncQueue(entryId);
        
        console.log('🗑️ Entry deleted from offline storage:', entryId);
      }
    } catch (error) {
      console.error('❌ Error deleting offline entry:', error);
      throw error;
    }
  }

  // Clear all offline data (use with caution)
  static async clearOfflineData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        this.OFFLINE_ENTRIES_KEY,
        this.SYNC_QUEUE_KEY,
        this.LAST_SYNC_KEY
      ]);
      console.log('🗑️ Offline data cleared');
    } catch (error) {
      console.error('❌ Error clearing offline data:', error);
    }
  }

  // Get sync statistics
  static async getSyncStats(): Promise<SyncStats> {
    try {
      const entries = await this.getOfflineEntries();
      const allEntries = Object.values(entries);
      const syncedEntries = allEntries.filter(entry => entry.isSynced);
      const pendingSync = allEntries.filter(entry => entry.needsSync && !entry.isSynced);
      const lastSyncTime = await AsyncStorage.getItem(this.LAST_SYNC_KEY);

      return {
        totalEntries: allEntries.length,
        syncedEntries: syncedEntries.length,
        pendingSync: pendingSync.length,
        lastSyncTime
      };
    } catch (error) {
      console.error('❌ Error getting sync stats:', error);
      return {
        totalEntries: 0,
        syncedEntries: 0,
        pendingSync: 0,
        lastSyncTime: null
      };
    }
  }
}
