/**
 * Commitment Cache Service - Manages commitment cache with offline sync support
 * 
 * This service provides offline-first commitment management with automatic sync
 * when the device comes back online.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActiveCommitment } from '@/hooks/useActiveCommitments';

// Storage key patterns
const COMMITMENT_CACHE_PREFIX = 'commitments_';
const PENDING_CHECKINS_PREFIX = 'pending_checkins_';
const COMMITMENT_METADATA = 'commitment_cache_metadata';

interface PendingCheckIn {
  id: string;
  commitmentId: string;
  completed: boolean;
  timestamp: number;
  userId: string;
  retryCount: number;
  coachingSessionId: string;
  messageId: string;
}

interface CommitmentCacheMetadata {
  [userId: string]: {
    lastSync: number;
    commitmentCount: number;
    pendingCheckInsCount: number;
  };
}

class CommitmentCacheService {
  private currentUserId: string | null = null;
  private syncInProgress = false;
  
  // 🚀 IN-MEMORY CACHE: Keep frequently accessed data in memory
  private memoryCache: Map<string, ActiveCommitment[]> = new Map();
  private pendingCheckInsCache: Map<string, PendingCheckIn[]> = new Map();

  // =====================
  // COMMITMENT CACHE MANAGEMENT
  // =====================

  /**
   * Load cached commitments for a user
   */
  async loadCommitments(userId: string): Promise<ActiveCommitment[]> {
    try {
      // 🚀 FAST PATH: Return from in-memory cache if available
      if (this.memoryCache.has(userId)) {
        const commitments = this.memoryCache.get(userId)!;
        console.log(`⚡ [COMMITMENT CACHE] Loaded ${commitments.length} commitments from memory for user:`, userId);
        return commitments;
      }

      // 🚀 SLOW PATH: Load from AsyncStorage and cache in memory
      const cacheKey = `${COMMITMENT_CACHE_PREFIX}${userId}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      
      if (!cached) {
        console.log('💾 [COMMITMENT CACHE] No cached commitments found for user:', userId);
        const emptyCommitments: ActiveCommitment[] = [];
        this.memoryCache.set(userId, emptyCommitments);
        return emptyCommitments;
      }
      
      const commitments: ActiveCommitment[] = JSON.parse(cached);
      
      // 🚀 CACHE IN MEMORY: Store for future fast access
      this.memoryCache.set(userId, commitments);
      
      console.log(`💾 [COMMITMENT CACHE] Loaded ${commitments.length} cached commitments for user:`, userId);
      
      return commitments;
    } catch (error) {
      console.error('❌ [COMMITMENT CACHE] Error loading cached commitments:', error);
      return [];
    }
  }

  /**
   * Save commitments to cache
   */
  async saveCommitments(commitments: ActiveCommitment[], userId: string): Promise<void> {
    try {
      // 🚀 FAST UPDATE: Update in-memory cache first
      this.memoryCache.set(userId, commitments);
      
      // 🚀 PERSIST: Save to AsyncStorage
      const cacheKey = `${COMMITMENT_CACHE_PREFIX}${userId}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(commitments));
      
      // Update metadata
      await this.updateMetadata(userId, {
        lastSync: Date.now(),
        commitmentCount: commitments.length,
      });
      
      console.log(`💾 [COMMITMENT CACHE] Saved ${commitments.length} commitments to cache for user:`, userId);
    } catch (error) {
      console.error('❌ [COMMITMENT CACHE] Error saving commitments to cache:', error);
    }
  }

  /**
   * Clear cached commitments for a user
   */
  async clearUserCommitments(userId: string): Promise<void> {
    try {
      // 🚀 CLEAR MEMORY: Remove from in-memory cache first
      this.memoryCache.delete(userId);
      
      // 🚀 CLEAR STORAGE: Remove from AsyncStorage
      const cacheKey = `${COMMITMENT_CACHE_PREFIX}${userId}`;
      await AsyncStorage.removeItem(cacheKey);
      
      console.log('💾 [COMMITMENT CACHE] Cleared cached commitments for user:', userId);
    } catch (error) {
      console.error('❌ [COMMITMENT CACHE] Error clearing cached commitments:', error);
    }
  }

  // =====================
  // OFFLINE SYNC MANAGEMENT
  // =====================

  /**
   * Queue a check-in for offline sync
   */
  async queueCheckIn(
    commitmentId: string,
    completed: boolean,
    userId: string,
    coachingSessionId: string
  ): Promise<void> {
    try {
      const pendingCheckIn: PendingCheckIn = {
        id: `checkin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        commitmentId,
        completed,
        timestamp: Date.now(),
        userId,
        retryCount: 0,
        coachingSessionId,
        messageId: `offline_checkin_${Date.now()}`
      };

      const pendingCheckIns = await this.getPendingCheckIns(userId);
      pendingCheckIns.push(pendingCheckIn);
      
      // 🚀 FAST UPDATE: Update in-memory cache first
      this.pendingCheckInsCache.set(userId, pendingCheckIns);
      
      // 🚀 PERSIST: Save to AsyncStorage
      const cacheKey = `${PENDING_CHECKINS_PREFIX}${userId}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(pendingCheckIns));
      
      // Update metadata
      await this.updateMetadata(userId, {
        pendingCheckInsCount: pendingCheckIns.length,
      });
      
      console.log('💾 [COMMITMENT OFFLINE] Queued check-in for offline sync:', {
        commitmentId,
        completed,
        userId,
        queueSize: pendingCheckIns.length
      });
    } catch (error) {
      console.error('❌ [COMMITMENT OFFLINE] Error queuing check-in:', error);
      throw error;
    }
  }

  /**
   * Get pending check-ins for a user
   */
  async getPendingCheckIns(userId: string): Promise<PendingCheckIn[]> {
    try {
      // 🚀 FAST PATH: Return from in-memory cache if available
      if (this.pendingCheckInsCache.has(userId)) {
        const pendingCheckIns = this.pendingCheckInsCache.get(userId)!;
        return pendingCheckIns;
      }

      // 🚀 SLOW PATH: Load from AsyncStorage and cache in memory
      const cacheKey = `${PENDING_CHECKINS_PREFIX}${userId}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      
      if (!cached) {
        const emptyCheckIns: PendingCheckIn[] = [];
        this.pendingCheckInsCache.set(userId, emptyCheckIns);
        return emptyCheckIns;
      }
      
      const pendingCheckIns: PendingCheckIn[] = JSON.parse(cached);
      
      // 🚀 CACHE IN MEMORY: Store for future fast access
      this.pendingCheckInsCache.set(userId, pendingCheckIns);
      
      return pendingCheckIns;
    } catch (error) {
      console.error('❌ [COMMITMENT OFFLINE] Error loading pending check-ins:', error);
      return [];
    }
  }

  /**
   * Remove a specific pending check-in (after successful sync)
   */
  async removePendingCheckIn(checkInId: string, userId: string): Promise<void> {
    try {
      const pendingCheckIns = await this.getPendingCheckIns(userId);
      const filteredCheckIns = pendingCheckIns.filter(checkIn => checkIn.id !== checkInId);
      
      // 🚀 FAST UPDATE: Update in-memory cache first
      this.pendingCheckInsCache.set(userId, filteredCheckIns);
      
      // 🚀 PERSIST: Save to AsyncStorage
      const cacheKey = `${PENDING_CHECKINS_PREFIX}${userId}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(filteredCheckIns));
      
      // Update metadata
      await this.updateMetadata(userId, {
        pendingCheckInsCount: filteredCheckIns.length,
      });
      
      console.log('💾 [COMMITMENT OFFLINE] Removed pending check-in:', checkInId);
    } catch (error) {
      console.error('❌ [COMMITMENT OFFLINE] Error removing pending check-in:', error);
    }
  }

  /**
   * Clear all pending check-ins for a user
   */
  async clearPendingCheckIns(userId: string): Promise<void> {
    try {
      // 🚀 CLEAR MEMORY: Remove from in-memory cache first
      this.pendingCheckInsCache.delete(userId);
      
      // 🚀 CLEAR STORAGE: Remove from AsyncStorage
      const cacheKey = `${PENDING_CHECKINS_PREFIX}${userId}`;
      await AsyncStorage.removeItem(cacheKey);
      
      // Update metadata
      await this.updateMetadata(userId, {
        pendingCheckInsCount: 0,
      });
      
      console.log('💾 [COMMITMENT OFFLINE] Cleared all pending check-ins for user:', userId);
    } catch (error) {
      console.error('❌ [COMMITMENT OFFLINE] Error clearing pending check-ins:', error);
    }
  }

  /**
   * Sync pending check-ins with the backend
   */
  async syncPendingCheckIns(
    userId: string,
    getToken: () => Promise<string | null>,
    isOnline: boolean = true
  ): Promise<{ synced: number; failed: number }> {
    if (!isOnline || this.syncInProgress) {
      console.log('💾 [COMMITMENT SYNC] Skipping sync - offline or sync in progress');
      return { synced: 0, failed: 0 };
    }

    this.syncInProgress = true;
    let syncedCount = 0;
    let failedCount = 0;

    try {
      const pendingCheckIns = await this.getPendingCheckIns(userId);
      
      if (pendingCheckIns.length === 0) {
        console.log('💾 [COMMITMENT SYNC] No pending check-ins to sync');
        return { synced: 0, failed: 0 };
      }

      console.log(`💾 [COMMITMENT SYNC] Starting sync of ${pendingCheckIns.length} pending check-ins`);

      const token = await getToken();
      if (!token) {
        console.error('❌ [COMMITMENT SYNC] No auth token available');
        return { synced: 0, failed: pendingCheckIns.length };
      }

      // Process each pending check-in
      for (const checkIn of pendingCheckIns) {
        try {
          const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}api/coaching/commitments/checkin`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              commitmentId: checkIn.commitmentId,
              completed: checkIn.completed,
              coachingSessionId: checkIn.coachingSessionId,
              messageId: checkIn.messageId,
              // Add offline sync metadata
              isOfflineSync: true,
              originalTimestamp: checkIn.timestamp
            }),
          });

          if (response.ok) {
            // Successfully synced - remove from pending
            await this.removePendingCheckIn(checkIn.id, userId);
            syncedCount++;
            console.log('✅ [COMMITMENT SYNC] Successfully synced check-in:', checkIn.id);
          } else {
            // Failed to sync - increment retry count
            checkIn.retryCount++;
            failedCount++;
            console.error('❌ [COMMITMENT SYNC] Failed to sync check-in:', checkIn.id, response.status);
            
            // Remove if too many retries (max 3)
            if (checkIn.retryCount >= 3) {
              await this.removePendingCheckIn(checkIn.id, userId);
              console.log('🗑️ [COMMITMENT SYNC] Removed check-in after max retries:', checkIn.id);
            }
          }
        } catch (error) {
          failedCount++;
          console.error('❌ [COMMITMENT SYNC] Error syncing check-in:', checkIn.id, error);
        }

        // Small delay between requests to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Update sync metadata
      if (syncedCount > 0) {
        await this.updateMetadata(userId, {
          lastSync: Date.now(),
        });
      }

      console.log(`💾 [COMMITMENT SYNC] Sync completed - synced: ${syncedCount}, failed: ${failedCount}`);
      
      return { synced: syncedCount, failed: failedCount };
    } catch (error) {
      console.error('❌ [COMMITMENT SYNC] Error during sync process:', error);
      return { synced: syncedCount, failed: failedCount };
    } finally {
      this.syncInProgress = false;
    }
  }

  // =====================
  // METADATA MANAGEMENT
  // =====================

  private async updateMetadata(userId: string, updates: Partial<CommitmentCacheMetadata[string]>): Promise<void> {
    try {
      const metadata = await this.getMetadata();
      
      metadata[userId] = {
        ...metadata[userId],
        ...updates,
      };
      
      await AsyncStorage.setItem(COMMITMENT_METADATA, JSON.stringify(metadata));
    } catch (error) {
      console.error('❌ [COMMITMENT CACHE] Error updating metadata:', error);
    }
  }

  private async getMetadata(): Promise<CommitmentCacheMetadata> {
    try {
      const cached = await AsyncStorage.getItem(COMMITMENT_METADATA);
      if (!cached) return {};
      
      return JSON.parse(cached);
    } catch (error) {
      console.error('❌ [COMMITMENT CACHE] Error loading metadata:', error);
      return {};
    }
  }

  /**
   * Get cache statistics for a user
   */
  async getCacheStats(userId: string): Promise<CommitmentCacheMetadata[string] | null> {
    try {
      const metadata = await this.getMetadata();
      return metadata[userId] || null;
    } catch (error) {
      console.error('❌ [COMMITMENT CACHE] Error getting cache stats:', error);
      return null;
    }
  }

  /**
   * Check if cache needs refresh (older than 1 hour)
   */
  async needsRefresh(userId: string): Promise<boolean> {
    try {
      const stats = await this.getCacheStats(userId);
      if (!stats) return true;
      
      const oneHour = 60 * 60 * 1000;
      return (Date.now() - stats.lastSync) > oneHour;
    } catch (error) {
      console.error('❌ [COMMITMENT CACHE] Error checking refresh need:', error);
      return true;
    }
  }

  /**
   * Clear all cache data for a user
   */
  async clearUserData(userId: string): Promise<void> {
    try {
      // 🚀 CLEAR ALL MEMORY: Remove from in-memory caches first
      this.memoryCache.delete(userId);
      this.pendingCheckInsCache.delete(userId);
      
      await Promise.all([
        this.clearUserCommitments(userId),
        this.clearPendingCheckIns(userId)
      ]);
      
      console.log('💾 [COMMITMENT CACHE] Cleared all data for user:', userId);
    } catch (error) {
      console.error('❌ [COMMITMENT CACHE] Error clearing user data:', error);
    }
  }
}

// Export singleton instance
export const commitmentCacheService = new CommitmentCacheService();

