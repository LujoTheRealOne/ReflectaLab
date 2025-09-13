import AsyncStorage from '@react-native-async-storage/async-storage';

// Types for cached settings data
export interface CachedUserData {
  user: {
    id: string;
    firstName?: string;
    lastName?: string;
    emailAddresses: Array<{ emailAddress: string }>;
    imageUrl?: string;
  } | null;
  firebaseUser: {
    uid: string;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
  } | null;
}

export interface CachedSubscriptionData {
  isPro: boolean;
  initialized: boolean;
  customerInfo: any;
  activeSubscriptions: any[];
  currentOffering: any;
}

export interface CachedPermissionsData {
  notificationStatus: 'granted' | 'denied' | 'undetermined';
  expoPushToken: string | null;
  lastChecked: string;
}

export interface CachedSettingsData {
  userData: CachedUserData;
  subscriptionData: CachedSubscriptionData;
  permissionsData: CachedPermissionsData;
  appVersion: string;
  lastUpdated: string;
}

// Storage Keys
const CACHE_KEYS = {
  SETTINGS_DATA: '@settings_cache',
  USER_PREFERENCES: '@user_preferences',
} as const;

class SettingsCache {
  private cacheData: CachedSettingsData | null = null;
  private listeners: Array<(data: CachedSettingsData | null) => void> = [];

  // =====================
  // CACHE MANAGEMENT
  // =====================

  async getCachedSettings(userId: string): Promise<CachedSettingsData | null> {
    try {
      // Return in-memory cache if available
      if (this.cacheData) {
        return this.cacheData;
      }

      // Load from AsyncStorage
      const cached = await AsyncStorage.getItem(`${CACHE_KEYS.SETTINGS_DATA}_${userId}`);
      if (!cached) return null;
      
      const data: CachedSettingsData = JSON.parse(cached);
      this.cacheData = data;
      
      console.log('⚙️ Loaded cached settings for user:', userId);
      return data;
    } catch (error) {
      console.error('❌ Error loading cached settings:', error);
      return null;
    }
  }

  async setCachedSettings(userId: string, data: CachedSettingsData): Promise<void> {
    try {
      this.cacheData = data;
      await AsyncStorage.setItem(`${CACHE_KEYS.SETTINGS_DATA}_${userId}`, JSON.stringify(data));
      console.log('💾 Cached settings for user:', userId);
      
      // Notify listeners
      this.notifyListeners(data);
    } catch (error) {
      console.error('❌ Error caching settings:', error);
    }
  }

  async updateUserData(userId: string, userData: CachedUserData): Promise<void> {
    const currentCache = await this.getCachedSettings(userId);
    if (!currentCache) return;

    const updatedCache: CachedSettingsData = {
      ...currentCache,
      userData,
      lastUpdated: new Date().toISOString(),
    };

    await this.setCachedSettings(userId, updatedCache);
  }

  async updateSubscriptionData(userId: string, subscriptionData: CachedSubscriptionData): Promise<void> {
    const currentCache = await this.getCachedSettings(userId);
    if (!currentCache) return;

    const updatedCache: CachedSettingsData = {
      ...currentCache,
      subscriptionData,
      lastUpdated: new Date().toISOString(),
    };

    await this.setCachedSettings(userId, updatedCache);
  }

  async updatePermissionsData(userId: string, permissionsData: CachedPermissionsData): Promise<void> {
    const currentCache = await this.getCachedSettings(userId);
    if (!currentCache) return;

    const updatedCache: CachedSettingsData = {
      ...currentCache,
      permissionsData,
      lastUpdated: new Date().toISOString(),
    };

    await this.setCachedSettings(userId, updatedCache);
  }

  // =====================
  // LISTENERS
  // =====================

  addListener(listener: (data: CachedSettingsData | null) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(data: CachedSettingsData | null): void {
    this.listeners.forEach(listener => listener(data));
  }

  // =====================
  // UTILITIES
  // =====================

  async clearCache(userId: string): Promise<void> {
    try {
      this.cacheData = null;
      await AsyncStorage.removeItem(`${CACHE_KEYS.SETTINGS_DATA}_${userId}`);
      await AsyncStorage.removeItem(`${CACHE_KEYS.USER_PREFERENCES}_${userId}`);
      console.log('🧹 Cleared settings cache for user:', userId);
      this.notifyListeners(null);
    } catch (error) {
      console.error('❌ Error clearing settings cache:', error);
    }
  }

  isCacheValid(data: CachedSettingsData | null): boolean {
    if (!data) return false;
    
    const cacheAge = Date.now() - new Date(data.lastUpdated).getTime();
    const maxCacheAge = 5 * 60 * 1000; // 5 minutes
    
    return cacheAge < maxCacheAge;
  }

  getDefaultCache(userId: string): CachedSettingsData {
    return {
      userData: {
        user: null,
        firebaseUser: { uid: userId, email: null, displayName: null, photoURL: null },
      },
      subscriptionData: {
        isPro: false,
        initialized: false,
        customerInfo: null,
        activeSubscriptions: [],
        currentOffering: null,
      },
      permissionsData: {
        notificationStatus: 'undetermined',
        expoPushToken: null,
        lastChecked: new Date().toISOString(),
      },
      appVersion: '1.0.0',
      lastUpdated: new Date().toISOString(),
    };
  }
}

export const settingsCache = new SettingsCache();
export default settingsCache;
