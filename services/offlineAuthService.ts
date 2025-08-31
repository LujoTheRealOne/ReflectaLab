import AsyncStorage from '@react-native-async-storage/async-storage';
import { User as FirebaseUser } from 'firebase/auth';
import { UserAccount, CachedUserData, OfflineAuthSession } from '@/types';

export class OfflineAuthService {
  private static CACHED_USER_KEY = 'cached_user_data';
  private static OFFLINE_SESSION_KEY = 'offline_session';
  private static MAX_OFFLINE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

  // Cache user data when successfully authenticated online
  static async cacheUserData(
    firebaseUser: FirebaseUser, 
    userAccount: UserAccount | null, 
    clerkUserId: string | null
  ): Promise<void> {
    try {
      const cachedData: CachedUserData = {
        firebaseUser: {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        },
        userAccount,
        lastAuthTime: new Date().toISOString(),
        clerkUserId,
      };

      await AsyncStorage.setItem(this.CACHED_USER_KEY, JSON.stringify(cachedData));
      console.log('🔐 User data cached successfully for offline use');
    } catch (error) {
      console.error('❌ Error caching user data:', error);
    }
  }

  // Verify cached user identity when offline
  static async verifyCachedUser(): Promise<CachedUserData | null> {
    try {
      const cachedDataJson = await AsyncStorage.getItem(this.CACHED_USER_KEY);
      if (!cachedDataJson) {
        console.log('🔒 No cached user data found');
        return null;
      }

      const cachedData: CachedUserData = JSON.parse(cachedDataJson);
      
      // Check if cached data is not too old
      const lastAuthTime = new Date(cachedData.lastAuthTime);
      const now = new Date();
      const timeSinceAuth = now.getTime() - lastAuthTime.getTime();

      if (timeSinceAuth > this.MAX_OFFLINE_DURATION) {
        console.log('🔒 Cached user data expired, clearing cache');
        await this.clearCachedUser();
        return null;
      }

      console.log('🔐 Valid cached user found:', {
        uid: cachedData.firebaseUser.uid,
        email: cachedData.firebaseUser.email,
        timeSinceAuth: Math.round(timeSinceAuth / (1000 * 60 * 60)) + ' hours ago'
      });

      return cachedData;
    } catch (error) {
      console.error('❌ Error verifying cached user:', error);
      return null;
    }
  }

  // Start offline session with cached user
  static async startOfflineSession(cachedUser: CachedUserData): Promise<void> {
    try {
      const offlineSession = {
        uid: cachedUser.firebaseUser.uid,
        startTime: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
      };

      await AsyncStorage.setItem(this.OFFLINE_SESSION_KEY, JSON.stringify(offlineSession));
      console.log('📱 Offline session started for user:', cachedUser.firebaseUser.uid);
    } catch (error) {
      console.error('❌ Error starting offline session:', error);
    }
  }

  // Update offline session activity
  static async updateOfflineActivity(): Promise<void> {
    try {
      const sessionJson = await AsyncStorage.getItem(this.OFFLINE_SESSION_KEY);
      if (sessionJson) {
        const session = JSON.parse(sessionJson);
        session.lastActivity = new Date().toISOString();
        await AsyncStorage.setItem(this.OFFLINE_SESSION_KEY, JSON.stringify(session));
      }
    } catch (error) {
      console.error('❌ Error updating offline activity:', error);
    }
  }

  // Get current offline session
  static async getOfflineSession(): Promise<any | null> {
    try {
      const sessionJson = await AsyncStorage.getItem(this.OFFLINE_SESSION_KEY);
      return sessionJson ? JSON.parse(sessionJson) : null;
    } catch (error) {
      console.error('❌ Error getting offline session:', error);
      return null;
    }
  }

  // End offline session
  static async endOfflineSession(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.OFFLINE_SESSION_KEY);
      console.log('📱 Offline session ended');
    } catch (error) {
      console.error('❌ Error ending offline session:', error);
    }
  }

  // Clear cached user data (on sign out or security reasons)
  static async clearCachedUser(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([this.CACHED_USER_KEY, this.OFFLINE_SESSION_KEY]);
      console.log('🗑️ Cached user data cleared');
    } catch (error) {
      console.error('❌ Error clearing cached user:', error);
    }
  }

  // Check if user can work offline (has valid cached data)
  static async canWorkOffline(): Promise<boolean> {
    const cachedUser = await this.verifyCachedUser();
    return cachedUser !== null;
  }

  // Security check: Verify the user making offline journal entries is the same cached user
  static async verifyOfflineUserIdentity(entryUserId: string): Promise<boolean> {
    try {
      const cachedUser = await this.verifyCachedUser();
      if (!cachedUser) {
        console.log('🔒 No cached user to verify against');
        return false;
      }

      const isValid = cachedUser.firebaseUser.uid === entryUserId;
      if (!isValid) {
        console.warn('⚠️ Security warning: Entry user ID does not match cached user!', {
          entryUserId,
          cachedUserId: cachedUser.firebaseUser.uid
        });
      }

      return isValid;
    } catch (error) {
      console.error('❌ Error verifying offline user identity:', error);
      return false;
    }
  }

  // Get user data for offline mode
  static async getOfflineUserData(): Promise<{
    firebaseUser: CachedUserData['firebaseUser'] | null;
    userAccount: UserAccount | null;
  }> {
    const cachedUser = await this.verifyCachedUser();
    if (!cachedUser) {
      return { firebaseUser: null, userAccount: null };
    }

    return {
      firebaseUser: cachedUser.firebaseUser,
      userAccount: cachedUser.userAccount,
    };
  }
}
