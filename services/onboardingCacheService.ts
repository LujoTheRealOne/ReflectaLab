/**
 * Onboarding Cache Service - Manages life deep dive message persistence
 * 
 * This service provides secure cache management for onboarding chat messages
 * to ensure continuity across app restarts during the life deep dive session.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Define CoachingMessage interface locally to avoid circular imports
export interface OnboardingMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

// Storage key for onboarding messages
const ONBOARDING_CACHE_PREFIX = 'onboarding_messages_';
const ONBOARDING_PROGRESS_CACHE = 'onboarding_progress_';

interface OnboardingCacheData {
  sessionId: string;
  messages: OnboardingMessage[];
  progress: number;
  lastUpdated: number;
  userId: string;
}

class OnboardingCacheService {
  // 🚀 IN-MEMORY CACHE: Keep onboarding data in memory for fast access
  private onboardingCache: Map<string, OnboardingCacheData> = new Map();
  
  // Get storage key for specific user's onboarding
  private getStorageKey(userId: string): string {
    if (!userId || userId === 'anonymous-onboarding') {
      throw new Error('Invalid user ID for onboarding cache');
    }
    return `${ONBOARDING_CACHE_PREFIX}${userId}`;
  }

  // Get progress storage key for specific user
  private getProgressKey(userId: string): string {
    if (!userId || userId === 'anonymous-onboarding') {
      throw new Error('Invalid user ID for onboarding progress cache');
    }
    return `${ONBOARDING_PROGRESS_CACHE}${userId}`;
  }

  // Save onboarding messages and progress
  async saveOnboardingData(
    userId: string, 
    sessionId: string, 
    messages: OnboardingMessage[], 
    progress: number
  ): Promise<void> {
    try {
      if (!userId || userId === 'anonymous-onboarding') {
        console.warn('⚠️ Skipping onboarding cache save for invalid user ID:', userId);
        return;
      }

      const storageKey = this.getStorageKey(userId);
      
      const cacheData: OnboardingCacheData = {
        sessionId,
        messages,
        progress,
        lastUpdated: Date.now(),
        userId
      };
      
      // 🚀 FAST UPDATE: Update in-memory cache first
      this.onboardingCache.set(userId, cacheData);
      
      // 🚀 PERSIST: Save to AsyncStorage
      await AsyncStorage.setItem(storageKey, JSON.stringify(cacheData));
      
      console.log(`💾 Saved ${messages.length} onboarding messages for user:`, userId);
      console.log(`📊 Progress saved: ${progress}%`);
    } catch (error) {
      console.error('❌ Error saving onboarding data for user:', userId, error);
    }
  }

  // Load onboarding messages and progress
  async loadOnboardingData(userId: string): Promise<{
    sessionId: string | null;
    messages: OnboardingMessage[];
    progress: number;
  }> {
    try {
      if (!userId || userId === 'anonymous-onboarding') {
        console.warn('⚠️ Cannot load onboarding data for invalid user ID:', userId);
        return { sessionId: null, messages: [], progress: 7 };
      }

      // 🚀 FAST PATH: Return from in-memory cache if available
      if (this.onboardingCache.has(userId)) {
        const cachedData = this.onboardingCache.get(userId)!;
        const messages: OnboardingMessage[] = cachedData.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        console.log(`⚡ Loaded ${messages.length} onboarding messages from memory for user:`, userId);
        return {
          sessionId: cachedData.sessionId,
          messages,
          progress: cachedData.progress
        };
      }

      // 🚀 SLOW PATH: Load from AsyncStorage and cache in memory
      const storageKey = this.getStorageKey(userId);
      const storedData = await AsyncStorage.getItem(storageKey);
      
      if (!storedData) {
        console.log('📱 No cached onboarding data found for user:', userId);
        const emptyData = { sessionId: null, messages: [], progress: 7 };
        return emptyData;
      }
      
      const parsedData: OnboardingCacheData = JSON.parse(storedData);
      
      // 🚀 CACHE IN MEMORY: Store for future fast access
      this.onboardingCache.set(userId, parsedData);
      
      // Convert timestamps back to Date objects
      const messages: OnboardingMessage[] = parsedData.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
      
      console.log(`📱 Loaded ${messages.length} onboarding messages for user:`, userId);
      console.log(`📊 Progress loaded: ${parsedData.progress}%`);
      
      return {
        sessionId: parsedData.sessionId,
        messages,
        progress: parsedData.progress
      };
    } catch (error) {
      console.error('❌ Error loading onboarding data for user:', userId, error);
      return { sessionId: null, messages: [], progress: 7 };
    }
  }

  // Clear onboarding data for specific user
  async clearOnboardingData(userId: string): Promise<void> {
    try {
      if (!userId || userId === 'anonymous-onboarding') {
        console.warn('⚠️ Cannot clear onboarding data for invalid user ID:', userId);
        return;
      }

      // 🚀 CLEAR MEMORY: Remove from in-memory cache first
      this.onboardingCache.delete(userId);
      
      // 🚀 CLEAR STORAGE: Remove from AsyncStorage
      const storageKey = this.getStorageKey(userId);
      await AsyncStorage.removeItem(storageKey);
      
      console.log('🗑️ Cleared onboarding data for user:', userId);
    } catch (error) {
      console.error('❌ Error clearing onboarding data for user:', userId, error);
    }
  }

  // Check if user has saved onboarding data
  async hasOnboardingData(userId: string): Promise<boolean> {
    try {
      if (!userId || userId === 'anonymous-onboarding') {
        return false;
      }

      const storageKey = this.getStorageKey(userId);
      const storedData = await AsyncStorage.getItem(storageKey);
      
      return !!storedData;
    } catch (error) {
      console.error('❌ Error checking onboarding data for user:', userId, error);
      return false;
    }
  }

  // Get onboarding cache statistics
  async getOnboardingStats(userId: string): Promise<{
    hasData: boolean;
    messageCount: number;
    progress: number;
    lastUpdated: Date | null;
  }> {
    try {
      if (!userId || userId === 'anonymous-onboarding') {
        return { hasData: false, messageCount: 0, progress: 0, lastUpdated: null };
      }

      const data = await this.loadOnboardingData(userId);
      const storageKey = this.getStorageKey(userId);
      const storedRaw = await AsyncStorage.getItem(storageKey);
      
      if (!storedRaw) {
        return { hasData: false, messageCount: 0, progress: 0, lastUpdated: null };
      }

      const parsedData: OnboardingCacheData = JSON.parse(storedRaw);
      
      return {
        hasData: true,
        messageCount: data.messages.length,
        progress: data.progress,
        lastUpdated: new Date(parsedData.lastUpdated)
      };
    } catch (error) {
      console.error('❌ Error getting onboarding stats for user:', userId, error);
      return { hasData: false, messageCount: 0, progress: 0, lastUpdated: null };
    }
  }

  // Validate onboarding cache integrity
  async validateOnboardingCache(userId: string): Promise<boolean> {
    try {
      if (!userId || userId === 'anonymous-onboarding') {
        return false;
      }

      const data = await this.loadOnboardingData(userId);
      
      // Basic validation - check if data structure is correct
      if (!Array.isArray(data.messages)) {
        console.warn('⚠️ Invalid onboarding cache structure for user:', userId);
        await this.clearOnboardingData(userId);
        return false;
      }

      // Validate message structure
      for (const message of data.messages) {
        if (!message.id || !message.content || !message.role || !message.timestamp) {
          console.warn('⚠️ Invalid message structure in onboarding cache for user:', userId);
          await this.clearOnboardingData(userId);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('❌ Error validating onboarding cache for user:', userId, error);
      // Clear corrupted cache
      await this.clearOnboardingData(userId);
      return false;
    }
  }
}

// Export singleton instance
export const onboardingCacheService = new OnboardingCacheService();
export default onboardingCacheService;
