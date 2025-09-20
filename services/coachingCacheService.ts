/**
 * Coaching Cache Service - Manages coaching message cache with user isolation
 * 
 * This service provides secure, user-isolated cache management for coaching messages
 * to prevent cross-user data contamination.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CoachingMessage } from '@/hooks/useAICoaching';

// Storage key pattern for coaching messages
const COACHING_CACHE_PREFIX = 'coaching_messages_';
const COACHING_CACHE_METADATA = 'coaching_cache_metadata';

interface CoachingCacheMetadata {
  [userId: string]: {
    lastAccessed: number;
    messageCount: number;
    lastUpdated: number;
  };
}

class CoachingCacheService {
  private currentUserId: string | null = null;
  
  // 🚀 IN-MEMORY CACHE: Keep frequently accessed coaching messages in memory
  private messagesCache: Map<string, CoachingMessage[]> = new Map();

  // Get storage key for specific user
  private getStorageKey(userId: string): string {
    if (!userId || userId === 'anonymous') {
      throw new Error('Invalid user ID for coaching cache');
    }
    return `${COACHING_CACHE_PREFIX}${userId}`;
  }

  // Set current active user
  setCurrentUser(userId: string | null): void {
    if (this.currentUserId !== userId) {
      console.log('🔄 Coaching cache user changed:', this.currentUserId, '→', userId);
      this.currentUserId = userId;
    }
  }

  // Get current user ID
  getCurrentUser(): string | null {
    return this.currentUserId;
  }

  // Save messages for specific user
  async saveMessages(messages: CoachingMessage[], userId: string): Promise<void> {
    try {
      if (!userId || userId === 'anonymous') {
        console.warn('⚠️ Skipping cache save for invalid user ID:', userId);
        return;
      }

      // Keep last 300 messages for better offline experience
      const messagesToSave = messages.slice(-300);
      
      // 🚀 FAST UPDATE: Update in-memory cache first
      this.messagesCache.set(userId, messagesToSave);
      
      // 🚀 PERSIST: Save to AsyncStorage
      const storageKey = this.getStorageKey(userId);
      await AsyncStorage.setItem(storageKey, JSON.stringify(messagesToSave));
      
      // Update metadata
      await this.updateMetadata(userId, messagesToSave.length);
      
      console.log(`💾 Saved ${messagesToSave.length} coaching messages for user:`, userId);
    } catch (error) {
      console.error('❌ Error saving coaching messages for user:', userId, error);
    }
  }

  // Load messages for specific user
  async loadMessages(userId: string): Promise<CoachingMessage[]> {
    try {
      if (!userId || userId === 'anonymous') {
        console.warn('⚠️ Cannot load messages for invalid user ID:', userId);
        return [];
      }

      // 🚀 FAST PATH: Return from in-memory cache if available
      if (this.messagesCache.has(userId)) {
        const messages = this.messagesCache.get(userId)!;
        console.log(`⚡ Loaded ${messages.length} coaching messages from memory for user:`, userId);
        return messages;
      }

      // 🚀 SLOW PATH: Load from AsyncStorage and cache in memory
      const storageKey = this.getStorageKey(userId);
      const storedMessages = await AsyncStorage.getItem(storageKey);
      
      if (!storedMessages) {
        console.log('📱 No cached coaching messages found for user:', userId);
        const emptyMessages: CoachingMessage[] = [];
        this.messagesCache.set(userId, emptyMessages);
        return emptyMessages;
      }
      
      const parsedMessages: CoachingMessage[] = JSON.parse(storedMessages).map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
      
      // 🚀 CACHE IN MEMORY: Store for future fast access
      this.messagesCache.set(userId, parsedMessages);
      
      // Update last accessed time
      await this.updateMetadata(userId, parsedMessages.length);
      
      console.log(`📱 Loaded ${parsedMessages.length} coaching messages for user:`, userId);
      return parsedMessages;
    } catch (error) {
      console.error('❌ Error loading coaching messages for user:', userId, error);
      return [];
    }
  }

  // Clear messages for specific user
  async clearUserMessages(userId: string): Promise<void> {
    try {
      if (!userId || userId === 'anonymous') {
        console.warn('⚠️ Cannot clear messages for invalid user ID:', userId);
        return;
      }

      // 🚀 CLEAR MEMORY: Remove from in-memory cache first
      this.messagesCache.delete(userId);
      
      // 🚀 CLEAR STORAGE: Remove from AsyncStorage
      const storageKey = this.getStorageKey(userId);
      await AsyncStorage.removeItem(storageKey);
      
      // Remove from metadata
      await this.removeFromMetadata(userId);
      
      console.log('🗑️ Cleared coaching messages for user:', userId);
    } catch (error) {
      console.error('❌ Error clearing coaching messages for user:', userId, error);
    }
  }

  // Clear all cached coaching messages (use with caution)
  async clearAllMessages(): Promise<void> {
    try {
      console.log('🧹 Clearing ALL coaching message caches...');
      
      // Get all cached user IDs from metadata
      const metadata = await this.getMetadata();
      const userIds = Object.keys(metadata);
      
      // Clear each user's cache
      const clearPromises = userIds.map(userId => this.clearUserMessages(userId));
      await Promise.all(clearPromises);
      
      // Clear metadata
      await AsyncStorage.removeItem(COACHING_CACHE_METADATA);
      
      console.log(`✅ Cleared coaching messages for ${userIds.length} users`);
    } catch (error) {
      console.error('❌ Error clearing all coaching messages:', error);
    }
  }

  // Get cache statistics
  async getCacheStats(): Promise<{ totalUsers: number; totalMessages: number; cacheSize: string }> {
    try {
      const metadata = await this.getMetadata();
      const userIds = Object.keys(metadata);
      
      let totalMessages = 0;
      userIds.forEach(userId => {
        totalMessages += metadata[userId].messageCount || 0;
      });
      
      // Estimate cache size (rough calculation)
      const avgMessageSize = 200; // bytes per message (rough estimate)
      const estimatedSize = totalMessages * avgMessageSize;
      const cacheSize = this.formatBytes(estimatedSize);
      
      return {
        totalUsers: userIds.length,
        totalMessages,
        cacheSize
      };
    } catch (error) {
      console.error('❌ Error getting cache stats:', error);
      return { totalUsers: 0, totalMessages: 0, cacheSize: '0 B' };
    }
  }

  // Clean up old cache entries (older than 30 days)
  async cleanupOldCaches(): Promise<void> {
    try {
      const metadata = await this.getMetadata();
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      let cleanedCount = 0;
      
      for (const [userId, data] of Object.entries(metadata)) {
        if (data.lastAccessed < thirtyDaysAgo) {
          await this.clearUserMessages(userId);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} old coaching caches`);
      }
    } catch (error) {
      console.error('❌ Error cleaning up old caches:', error);
    }
  }

  // Private helper methods
  private async getMetadata(): Promise<CoachingCacheMetadata> {
    try {
      const metadata = await AsyncStorage.getItem(COACHING_CACHE_METADATA);
      return metadata ? JSON.parse(metadata) : {};
    } catch (error) {
      console.error('❌ Error reading cache metadata:', error);
      return {};
    }
  }

  private async updateMetadata(userId: string, messageCount: number): Promise<void> {
    try {
      const metadata = await this.getMetadata();
      
      metadata[userId] = {
        lastAccessed: Date.now(),
        messageCount,
        lastUpdated: Date.now()
      };
      
      await AsyncStorage.setItem(COACHING_CACHE_METADATA, JSON.stringify(metadata));
    } catch (error) {
      console.error('❌ Error updating cache metadata:', error);
    }
  }

  private async removeFromMetadata(userId: string): Promise<void> {
    try {
      const metadata = await this.getMetadata();
      delete metadata[userId];
      await AsyncStorage.setItem(COACHING_CACHE_METADATA, JSON.stringify(metadata));
    } catch (error) {
      console.error('❌ Error removing from cache metadata:', error);
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Backend synchronization methods
  async syncWithBackend(userId: string): Promise<CoachingMessage[]> {
    try {
      if (!userId || userId === 'anonymous') {
        console.warn('⚠️ Cannot sync with backend for invalid user ID:', userId);
        return [];
      }

      console.log('🔄 Syncing coaching cache with backend for user:', userId);

      // Import Firestore dynamically to avoid circular dependencies
      const { db } = await import('../lib/firebase');
      const { collection, query, where, orderBy, getDocs } = await import('firebase/firestore');
      
      // Query for the user's default coaching session
      const sessionsRef = collection(db, 'coachingSessions');
      const sessionQuery = query(
        sessionsRef,
        where('userId', '==', userId),
        where('sessionType', '==', 'default-session'),
        orderBy('updatedAt', 'desc')
      );
      
      const sessionSnapshot = await getDocs(sessionQuery);
      
      if (sessionSnapshot.empty) {
        console.log('📱 No coaching session found in backend for user:', userId);
        return [];
      }
      
      const sessionDoc = sessionSnapshot.docs[0];
      const sessionData = sessionDoc.data();
      const backendMessages = sessionData.messages || [];
      
      console.log(`📥 Found ${backendMessages.length} messages in backend for user:`, userId);
      
      // Convert backend messages to CoachingMessage format
      const messages: CoachingMessage[] = backendMessages.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        role: msg.role,
        timestamp: new Date(msg.timestamp?.seconds ? msg.timestamp.seconds * 1000 : msg.timestamp)
      }));
      
      // Update cache with backend data
      await this.saveMessages(messages, userId);
      
      console.log(`✅ Successfully synced ${messages.length} messages from backend for user:`, userId);
      return messages;
      
    } catch (error) {
      console.error('❌ Error syncing with backend for user:', userId, error);
      return [];
    }
  }

  // Initialize session - ALWAYS backend first, never create from cache
  async initializeSession(userId: string): Promise<{ messages: CoachingMessage[]; sessionExists: boolean }> {
    try {
      if (!userId || userId === 'anonymous') {
        console.warn('⚠️ Cannot initialize session for invalid user ID:', userId);
        return { messages: [], sessionExists: false };
      }

      console.log('🚀 Initializing coaching session (BACKEND FIRST) for user:', userId);

      // 1. ALWAYS check backend first for existing session
      const backendMessages = await this.syncWithBackend(userId);
      
      if (backendMessages.length > 0) {
        console.log(`✅ Found existing session with ${backendMessages.length} messages in backend`);
        return { messages: backendMessages, sessionExists: true };
      }
      
      // 2. No backend session exists - this means NO session at all
      console.log('📝 No existing session found in backend - will create new session on first message');
      
      // Clear any stale cache that might exist (prevent cache from creating sessions)
      await this.clearUserMessages(userId);
      
      return { messages: [], sessionExists: false };
      
    } catch (error) {
      console.error('❌ Error initializing session for user:', userId, error);
      // On error, assume no session exists (fail safe)
      return { messages: [], sessionExists: false };
    }
  }

  // Initialize cache with backend sync (legacy - kept for compatibility)
  async initializeWithBackendSync(userId: string): Promise<CoachingMessage[]> {
    const result = await this.initializeSession(userId);
    return result.messages;
  }

  // Check if backend has newer data than cache
  async isBackendNewer(userId: string): Promise<boolean> {
    try {
      if (!userId || userId === 'anonymous') {
        return false;
      }

      const metadata = await this.getMetadata();
      const userMeta = metadata[userId];
      
      if (!userMeta) {
        return true; // No local cache, backend might have data
      }

      // Import Firestore dynamically
      const { db } = await import('../lib/firebase');
      const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
      
      const sessionsRef = collection(db, 'coachingSessions');
      const sessionQuery = query(
        sessionsRef,
        where('userId', '==', userId),
        where('sessionType', '==', 'default-session'),
        orderBy('updatedAt', 'desc'),
        limit(1)
      );
      
      const sessionSnapshot = await getDocs(sessionQuery);
      
      if (sessionSnapshot.empty) {
        return false; // No backend data
      }
      
      const sessionDoc = sessionSnapshot.docs[0];
      const sessionData = sessionDoc.data();
      const backendUpdatedAt = sessionData.updatedAt?.seconds * 1000 || 0;
      
      return backendUpdatedAt > userMeta.lastUpdated;
      
    } catch (error) {
      console.error('❌ Error checking if backend is newer:', error);
      return false;
    }
  }

  // User validation helper
  async validateUserCache(userId: string): Promise<boolean> {
    try {
      if (!userId || userId === 'anonymous') {
        return false;
      }

      const storageKey = this.getStorageKey(userId);
      const cachedData = await AsyncStorage.getItem(storageKey);
      
      if (!cachedData) {
        return true; // No cache is valid state
      }

      // Validate cache structure
      const messages = JSON.parse(cachedData);
      if (!Array.isArray(messages)) {
        console.warn('⚠️ Invalid cache structure for user:', userId);
        await this.clearUserMessages(userId);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Error validating user cache:', userId, error);
      // Clear corrupted cache
      await this.clearUserMessages(userId);
      return false;
    }
  }
}

// Export singleton instance
export const coachingCacheService = new CoachingCacheService();
export default coachingCacheService;
