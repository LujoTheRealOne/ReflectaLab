import AsyncStorage from '@react-native-async-storage/async-storage';

// Types for cached auth data
export interface CachedAuthData {
  firebaseUser: {
    uid: string;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
  };
  clerkUser: {
    id: string;
    firstName?: string;
    lastName?: string;
    emailAddresses: Array<{ emailAddress: string }>;
    imageUrl?: string;
  };
  userAccount: {
    uid: string;
    firstName?: string;
    lastName?: string;
    onboardingData?: any;
    createdAt?: any;
  };
  lastValidated: string;
  deviceId: string;
}

// Storage Keys
const CACHE_KEYS = {
  AUTH_DATA: '@auth_cache',
  SESSION_TOKEN: '@session_token',
} as const;

class AuthCache {
  private cacheData: CachedAuthData | null = null;
  private readonly CACHE_VALIDITY = 24 * 60 * 60 * 1000; // 24 hours

  // =====================
  // CACHE MANAGEMENT
  // =====================

  async getCachedAuth(): Promise<CachedAuthData | null> {
    try {
      // Return in-memory cache if available
      if (this.cacheData && this.isCacheValid(this.cacheData)) {
        return this.cacheData;
      }

      // Load from AsyncStorage
      const cached = await AsyncStorage.getItem(CACHE_KEYS.AUTH_DATA);
      if (!cached) return null;
      
      const data: CachedAuthData = JSON.parse(cached);
      
      // Validate cache age
      if (!this.isCacheValid(data)) {
        console.log('🔐 Auth cache expired, clearing...');
        await this.clearCache();
        return null;
      }
      
      this.cacheData = data;
      console.log('🔐 Loaded valid auth cache for user:', data.firebaseUser.uid);
      return data;
    } catch (error) {
      console.error('❌ Error loading auth cache:', error);
      return null;
    }
  }

  async setCachedAuth(data: CachedAuthData): Promise<void> {
    try {
      this.cacheData = data;
      await AsyncStorage.setItem(CACHE_KEYS.AUTH_DATA, JSON.stringify(data));
      console.log('💾 Cached auth data for user:', data.firebaseUser.uid);
    } catch (error) {
      console.error('❌ Error caching auth data:', error);
    }
  }

  async updateAuthCache(updates: Partial<CachedAuthData>): Promise<void> {
    const currentCache = await this.getCachedAuth();
    if (!currentCache) return;

    const updatedCache: CachedAuthData = {
      ...currentCache,
      ...updates,
      lastValidated: new Date().toISOString(),
    };

    await this.setCachedAuth(updatedCache);
  }

  // =====================
  // VALIDATION
  // =====================

  isCacheValid(data: CachedAuthData | null): boolean {
    if (!data) return false;
    
    const cacheAge = Date.now() - new Date(data.lastValidated).getTime();
    return cacheAge < this.CACHE_VALIDITY;
  }

  isUserMatching(userId: string): boolean {
    return this.cacheData?.firebaseUser.uid === userId;
  }

  // =====================
  // OFFLINE CAPABILITIES
  // =====================

  async canWorkOffline(): Promise<boolean> {
    const cachedAuth = await this.getCachedAuth();
    return !!cachedAuth && this.isCacheValid(cachedAuth);
  }

  async getOfflineUserInfo(): Promise<{
    uid: string;
    name: string;
    email: string;
  } | null> {
    const cachedAuth = await this.getCachedAuth();
    if (!cachedAuth) return null;

    return {
      uid: cachedAuth.firebaseUser.uid,
      name: `${cachedAuth.userAccount.firstName || ''}`.trim() || 
            cachedAuth.firebaseUser.displayName || 
            'User',
      email: cachedAuth.clerkUser.emailAddresses[0]?.emailAddress || 
             cachedAuth.firebaseUser.email || 
             'No email',
    };
  }

  // =====================
  // SESSION MANAGEMENT
  // =====================

  async saveSessionToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_KEYS.SESSION_TOKEN, token);
      console.log('💾 Session token cached');
    } catch (error) {
      console.error('❌ Error caching session token:', error);
    }
  }

  async getSessionToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(CACHE_KEYS.SESSION_TOKEN);
    } catch (error) {
      console.error('❌ Error loading session token:', error);
      return null;
    }
  }

  // =====================
  // CLEANUP
  // =====================

  async clearCache(): Promise<void> {
    try {
      this.cacheData = null;
      await AsyncStorage.multiRemove([
        CACHE_KEYS.AUTH_DATA,
        CACHE_KEYS.SESSION_TOKEN,
      ]);
      console.log('🧹 Auth cache cleared');
    } catch (error) {
      console.error('❌ Error clearing auth cache:', error);
    }
  }

  // =====================
  // UTILITIES
  // =====================

  createCacheData(
    firebaseUser: any,
    clerkUser: any,
    userAccount: any
  ): CachedAuthData {
    return {
      firebaseUser: {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
      },
      clerkUser: {
        id: clerkUser.id,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        emailAddresses: clerkUser.emailAddresses,
        imageUrl: clerkUser.imageUrl,
      },
      userAccount: {
        uid: userAccount.uid,
        firstName: userAccount.firstName,
        lastName: userAccount.lastName,
        onboardingData: userAccount.onboardingData,
        createdAt: userAccount.createdAt,
      },
      lastValidated: new Date().toISOString(),
      deviceId: Math.random().toString(36).substr(2, 9),
    };
  }
}

export const authCache = new AuthCache();
export default authCache;
