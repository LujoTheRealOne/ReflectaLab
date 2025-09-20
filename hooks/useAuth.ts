import { signInWithClerkToken, signOutFromFirebase, onFirebaseAuthStateChanged, getCurrentFirebaseUser } from '@/lib/clerk-firebase-auth';
import { syncService } from '@/services/syncService';
import { settingsCache } from '@/services/settingsCache';
import { authCache } from '@/services/authCache';
import { useAuth as useClerkAuth, useOAuth, useUser } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState, useEffect, useRef } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { FirestoreService } from '@/lib/firestore';
import { UserAccount } from '@/types/journal';
import { useAnalytics } from './useAnalytics';
import { useNetworkConnectivity } from './useNetworkConnectivity';
import { AppState } from 'react-native';

// This is required for Expo web
WebBrowser.maybeCompleteAuthSession();

// Global tracking to prevent duplicates across hook re-renders
const GLOBAL_TRACKED_SIGN_INS = new Set<string>();
let GLOBAL_LAST_TRACKED_USER: string | null = null;

export function useAuth() {
  const { signOut, isSignedIn, getToken, isLoaded: isClerkLoaded } = useClerkAuth();
  const { user } = useUser();
  const { startOAuthFlow: startGoogleOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const { startOAuthFlow: startAppleOAuthFlow } = useOAuth({ strategy: 'oauth_apple' });
  const { isConnected, isInternetReachable } = useNetworkConnectivity();
  const [isLoading, setIsLoading] = useState(false);
  const [shouldShowGetStarted, setShouldShowGetStarted] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null); // Start as null until we know from backend
  const [isCacheLoaded, setIsCacheLoaded] = useState(false);
  const [isOptimisticLoad, setIsOptimisticLoad] = useState(false);
  const [offlineFirebaseUser, setOfflineFirebaseUser] = useState<FirebaseUser | null>(null);
  
  // 🚀 DEBOUNCED: Helper function to clear progress when onboarding is completed
  const progressClearTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastClearUserRef = useRef<string | null>(null);
  
  const clearProgressIfCompleted = useCallback(async (account: UserAccount, needsOnboardingValue: boolean) => {
    if (!needsOnboardingValue && account.onboardingData?.onboardingCompleted === true) {
      // 🚀 PREVENT SPAM: Skip if already cleared for this user recently
      if (lastClearUserRef.current === account.uid) {
        return;
      }
      
      // Clear any pending timeout
      if (progressClearTimeoutRef.current) {
        clearTimeout(progressClearTimeoutRef.current);
      }
      
      // Debounced clear operation
      progressClearTimeoutRef.current = setTimeout(async () => {
        try {
          const AsyncStorage = await import('@react-native-async-storage/async-storage');
          await AsyncStorage.default.removeItem('@onboarding_progress');
          lastClearUserRef.current = account.uid;
          console.log('🧹 Successfully cleared onboarding progress (debounced)');
        } catch (error) {
          console.error('❌ Failed to clear onboarding progress:', error);
        }
      }, 1000); // 1 second debounce
    }
  }, []);
  
  // Enhanced authentication state
  const [authError, setAuthError] = useState<string | null>(null);
  const [userAccountLoading, setUserAccountLoading] = useState(false);
  const [authAttempts, setAuthAttempts] = useState(0);
  const [isSigningOut, setIsSigningOut] = useState(false);
  
  // Timeout and cleanup refs
  const userAccountTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const firebaseRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSignOutTimeRef = useRef<number>(0);
  const maxAuthAttempts = 3;
  const userAccountTimeout = 10000; // 10 seconds
  const signOutCooldownMs = 2000; // 2 seconds cooldown after sign out
  
  // Note: Analytics tracking now uses global variables to prevent duplicates across hook re-renders
  
  const { trackSignUp, trackSignIn, trackSignOut, trackFirstTimeAppOpened } = useAnalytics();

  // 🚀 CACHE-FIRST: Load cached auth data immediately and skip Firebase if valid
  useEffect(() => {
    const loadCachedAuthData = async () => {
      try {
        const cachedAuth = await authCache.getCachedAuth();
        if (cachedAuth && authCache.isCacheValid(cachedAuth)) {
          // 🚀 REDUCED LOGGING: Only log once per app session
          if (!GLOBAL_LAST_TRACKED_USER) {
            console.log('⚡ Valid cache found - using cache-first approach');
          }
          
          // Set complete state from cache immediately
          setUserAccount({
            ...cachedAuth.userAccount,
            firstName: cachedAuth.userAccount.firstName || '',
            onboardingData: cachedAuth.userAccount.onboardingData || {
              onboardingCompleted: false,
              onboardingCompletedAt: 0,
              whatDoYouDoInLife: [],
              selfReflectionPracticesTried: [],
              stressInLife: 0.5,
              clarityInLife: 0.5,
            },
            createdAt: cachedAuth.userAccount.createdAt || new Date(),
            updatedAt: new Date(),
            coachingConfig: {
              challengeDegree: 'moderate',
              harshToneDegree: 'supportive',
              coachingMessageFrequency: 'daily',
              enableCoachingMessages: true,
              lastCoachingMessageSentAt: 0,
              coachingMessageTimePreference: 'morning',
            },
            mobilePushNotifications: {
              enabled: false,
              expoPushTokens: [],
              lastNotificationSentAt: 0,
            },
            userTimezone: 'America/New_York',
          });
          
          // Set onboarding status from cache
          const needsOnboardingFromCache = !cachedAuth.userAccount.onboardingData?.onboardingCompleted;
          setNeedsOnboarding(needsOnboardingFromCache);
          setIsOptimisticLoad(true);
          setUserAccountLoading(false); // Mark as ready immediately
          
          // 🚀 OFFLINE-FIRST: Create offline Firebase user from cache for offline usage
          const mockFirebaseUser = {
            uid: cachedAuth.firebaseUser.uid,
            email: cachedAuth.firebaseUser.email,
            displayName: cachedAuth.firebaseUser.displayName,
            photoURL: cachedAuth.firebaseUser.photoURL,
            emailVerified: true,
            isAnonymous: false,
            metadata: {
              creationTime: new Date().toISOString(),
              lastSignInTime: new Date().toISOString(),
            },
            providerData: [],
            refreshToken: 'offline-token',
            tenantId: null,
            // Add missing methods for offline compatibility
            delete: async () => { throw new Error('Delete not available offline'); },
            getIdToken: async () => 'offline-token',
            getIdTokenResult: async () => ({ token: 'offline-token' } as any),
            reload: async () => { /* no-op offline */ },
            toJSON: () => ({ uid: cachedAuth.firebaseUser.uid }),
          } as unknown as FirebaseUser;
          
          setOfflineFirebaseUser(mockFirebaseUser);
          // 🚀 REDUCED LOGGING: Only log once per app session
          if (!GLOBAL_LAST_TRACKED_USER) {
            console.log('✅ Cache-first auth completed with offline Firebase user');
          }
          
          // 🚀 CACHE-FIRST: Skip Firebase entirely if cache is fresh (< 1 hour)
          const cacheAge = Date.now() - new Date(cachedAuth.lastValidated).getTime();
          if (cacheAge < 3600000) { // 1 hour
            // 🚀 REDUCED LOGGING: Only log once per app session
            if (!GLOBAL_LAST_TRACKED_USER) {
              console.log('🏆 Cache is very fresh - skipping all Firebase operations');
            }
            return; // Skip Firebase entirely
          }
        } else {
          console.log('❌ No valid cache - will need Firebase auth');
        }
      } catch (error) {
        console.error('❌ Error loading cached auth data:', error);
      } finally {
        setIsCacheLoaded(true);
      }
    };

    loadCachedAuthData();
  }, []);

  // Listen to Firebase auth state changes (optimized to prevent spam)
  useEffect(() => {
    let lastUserId: string | null = null;
    
    const unsubscribe = onFirebaseAuthStateChanged((user) => {
      // 🚀 REDUCED LOGGING: Only log if user actually changed (not just re-fired) and max 3 times
      if (user?.uid !== lastUserId) {
        const logCount = (global as any).__authStateLogCount || 0;
        if (logCount < 3) {
          console.log('🔥 Firebase auth state changed:', { uid: user?.uid, hasUser: !!user });
          (global as any).__authStateLogCount = logCount + 1;
        }
        lastUserId = user?.uid || null;
      }
      
      setFirebaseUser(user);
      setIsFirebaseReady(true);
      
      // Reset auth-dependent state when user signs out
      if (!user) {
        // Immediately reset all user-related state
        setUserAccount(null);
        setNeedsOnboarding(false);
        setAuthError(null);
        setUserAccountLoading(false);
        setAuthAttempts(0);
        
        // Clear global tracking state so next user can be tracked properly
        GLOBAL_TRACKED_SIGN_INS.clear();
        GLOBAL_LAST_TRACKED_USER = null;
        
        // Reset signing out state when Firebase user is actually gone
        setIsSigningOut(false);
        
        console.log('🔄 Auth state reset completed for sign out, tracking state cleared for next user');
        
        // Clear any pending timeouts
        if (userAccountTimeoutRef.current) {
          clearTimeout(userAccountTimeoutRef.current);
          userAccountTimeoutRef.current = null;
        }
        if (firebaseRetryTimeoutRef.current) {
          clearTimeout(firebaseRetryTimeoutRef.current);
          firebaseRetryTimeoutRef.current = null;
        }
      }
    });

    return unsubscribe;
  }, []);

  // Auto sign in to Firebase when Clerk user is available
  useEffect(() => {
    const signInToFirebase = async () => {
      // Prevent auto sign-in during logout process
      if (isSigningOut) {
        console.log('⏭️ Skipping auto sign-in - currently signing out');
        return;
      }
      
      // Additional safety check - don't auto sign-in if we just came from a sign out
      if (!isFirebaseReady) {
        console.log('⏭️ Skipping auto sign-in - Firebase not ready yet');
        return;
      }
      
      // Cooldown period after sign out to prevent immediate re-sign-in
      const timeSinceSignOut = Date.now() - lastSignOutTimeRef.current;
      if (timeSinceSignOut < signOutCooldownMs) {
        console.log(`⏭️ Skipping auto sign-in - cooldown period (${Math.round((signOutCooldownMs - timeSinceSignOut) / 1000)}s remaining)`);
        return;
      }
      
      if (isSignedIn && user && !firebaseUser && authAttempts < maxAuthAttempts) {
        try {
          setIsLoading(true);
          setAuthError(null);
          
          const token = await getToken();
          if (token) {
            console.log(`🔄 Firebase sign-in attempt ${authAttempts + 1}/${maxAuthAttempts}`);
            await signInWithClerkToken(token);
            setAuthAttempts(0); // Reset on success
          }
        } catch (error) {
          const nextAttempt = authAttempts + 1;
          setAuthAttempts(nextAttempt);
          
          console.error(`❌ Firebase sign-in failed (attempt ${nextAttempt}/${maxAuthAttempts}):`, error);
          
          if (nextAttempt >= maxAuthAttempts) {
            setAuthError('Authentication failed. Please try signing out and back in.');
          } else {
            // Retry after exponential backoff
            const retryDelay = Math.min(1000 * Math.pow(2, nextAttempt - 1), 5000);
            firebaseRetryTimeoutRef.current = setTimeout(() => {
              signInToFirebase();
            }, retryDelay);
          }
        } finally {
          setIsLoading(false);
        }
      }
    };

    signInToFirebase();
    
    // Cleanup function
    return () => {
      if (firebaseRetryTimeoutRef.current) {
        clearTimeout(firebaseRetryTimeoutRef.current);
        firebaseRetryTimeoutRef.current = null;
      }
    };
  }, [isSignedIn, user?.id, getToken, authAttempts, isSigningOut]); // 🚀 FIXED: Removed firebaseUser from deps to prevent infinite loop

  // 🚀 OPTIMIZATION: Initialize user document - prevent infinite loops
  const isInitializedRef = useRef(false);
  const lastInitUserRef = useRef<string | null>(null);
  
  useEffect(() => {
    const initializeUserDocument = async () => {
      // Skip user account loading during sign out
      if (isSigningOut) {
        return;
      }
      
      if (!firebaseUser?.uid) return;

      // 🚀 PREVENT INFINITE LOOP: Skip if already initialized for this user
      if (isInitializedRef.current && lastInitUserRef.current === firebaseUser.uid) {
        return;
      }

      // 🚀 CACHE-FIRST: If we have fresh cache data, skip all Firebase operations
      if (isOptimisticLoad && !isInitializedRef.current) {
        // 🚀 REDUCED LOGGING: Only log once per user session
        if (!GLOBAL_LAST_TRACKED_USER || GLOBAL_LAST_TRACKED_USER !== firebaseUser.uid) {
          console.log('🏆 Cache-first: Skipping Firebase operations - using cache only');
        }
        isInitializedRef.current = true;
        lastInitUserRef.current = firebaseUser.uid;
        
        // Only do background sync if cache is older than 1 hour
        const cachedAuth = await authCache.getCachedAuth();
        if (cachedAuth) {
          const cacheAge = Date.now() - new Date(cachedAuth.lastValidated).getTime();
          if (cacheAge > 3600000) { // 1 hour
            console.log('⏰ Cache is older than 1 hour - scheduling background sync');
            setTimeout(() => performBackgroundAuthSync(), 15000); // 🚀 OPTIMIZED: 15 second delay to let UI load first
          } else {
            // 🚀 REDUCED LOGGING: Skip frequent "cache fresh" logs
            if (!GLOBAL_LAST_TRACKED_USER || GLOBAL_LAST_TRACKED_USER !== firebaseUser.uid) {
              console.log('🚀 Cache is fresh - no background sync needed');
            }
          }
        }
        return;
      }

      const isOnline = isConnected === true && isInternetReachable === true;

      if (isOnline) {
        // =====================
        // ONLINE: Fetch backend data (one-time only)
        // =====================
        if (isCacheLoaded && userAccount && !isInitializedRef.current) {
          console.log('⚡ Cache loaded - fetching fresh data in background (one-time)');
          isInitializedRef.current = true;
          lastInitUserRef.current = firebaseUser.uid;
          setTimeout(() => performFullAuthInit(), 500);
        } else if (!userAccount && !isInitializedRef.current) {
          console.log('🌐 Online - fetching fresh data from backend');
          isInitializedRef.current = true;
          lastInitUserRef.current = firebaseUser.uid;
          await performFullAuthInit();
        }
      } else {
        // =====================
        // OFFLINE: Use cached data only (one-time)
        // =====================
        if (!userAccount && !isInitializedRef.current) {
          try {
            const cachedAuth = await authCache.getCachedAuth();
            
            if (cachedAuth && authCache.isUserMatching(firebaseUser.uid)) {
              console.log('⚡ Using cached auth data (offline mode)');
              
              // Set state from cache immediately
              const fullUserAccount: UserAccount = {
                ...cachedAuth.userAccount,
                firstName: cachedAuth.userAccount.firstName || '',
                onboardingData: cachedAuth.userAccount.onboardingData || {
                  onboardingCompleted: false,
                  onboardingCompletedAt: 0,
                  whatDoYouDoInLife: [],
                  selfReflectionPracticesTried: [],
                  stressInLife: 0.5,
                  clarityInLife: 0.5,
                },
                createdAt: cachedAuth.userAccount.createdAt || new Date(),
                updatedAt: new Date(),
                coachingConfig: {
                  challengeDegree: 'moderate',
                  harshToneDegree: 'supportive',
                  coachingMessageFrequency: 'daily',
                  enableCoachingMessages: true,
                  lastCoachingMessageSentAt: 0,
                  coachingMessageTimePreference: 'morning',
                },
                mobilePushNotifications: {
                  enabled: false,
                  expoPushTokens: [],
                  lastNotificationSentAt: 0,
                },
                userTimezone: 'America/New_York',
              };
              
              setUserAccount(fullUserAccount);
              setUserAccountLoading(false);
              isInitializedRef.current = true;
              lastInitUserRef.current = firebaseUser.uid;
              
              // Skip duplicate analytics tracking (global)
              if (!GLOBAL_TRACKED_SIGN_INS.has(firebaseUser.uid)) {
                GLOBAL_TRACKED_SIGN_INS.add(firebaseUser.uid);
                GLOBAL_LAST_TRACKED_USER = firebaseUser.uid;
              }
              
              return;
            } else {
              setUserAccountLoading(false);
              setAuthError('No cached data available. Please connect to the internet.');
            }
          } catch (error) {
            console.error('❌ Error loading auth cache in offline mode:', error);
            setUserAccountLoading(false);
            setAuthError('Failed to load cached data.');
          }
          isInitializedRef.current = true;
          lastInitUserRef.current = firebaseUser.uid;
        }
      }
    };

    const performFullAuthInit = async () => {
      if (!firebaseUser?.uid) return; // Safety check

      // Cleanup any existing timeout
      if (userAccountTimeoutRef.current) {
        clearTimeout(userAccountTimeoutRef.current);
        userAccountTimeoutRef.current = null;
      }

      setUserAccountLoading(true);

      // Create timeout promise that rejects after specified time
      const timeoutPromise = new Promise<never>((_, reject) => {
        userAccountTimeoutRef.current = setTimeout(() => {
          reject(new Error('User account loading timed out'));
        }, userAccountTimeout);
      });

      try {
        // Race between user account loading and timeout
        const account = await Promise.race([
          FirestoreService.getUserAccount(firebaseUser!.uid),
          timeoutPromise
        ]);
        
        // Clear timeout on success
        if (userAccountTimeoutRef.current) {
          clearTimeout(userAccountTimeoutRef.current);
          userAccountTimeoutRef.current = null;
        }
        
        // Validate account data
        if (!account || typeof account !== 'object') {
          throw new Error('Invalid user account data received');
        }
        
        // Check if user needs onboarding (with safe access in case of missing data)
        const needsOnboarding = !account.onboardingData || account.onboardingData.onboardingCompleted !== true;
        
        // Clear progress if onboarding is completed
        await clearProgressIfCompleted(account, needsOnboarding);
        
        // Set states after clearing progress
        setUserAccount(account);
        setNeedsOnboarding(needsOnboarding);
        
        // Determine if this is a new user or returning user
        const isNewUser = needsOnboarding && (!account.onboardingData || !account.onboardingData.onboardingCompletedAt);
        const accountCreatedRecently = account.createdAt && (Date.now() - new Date(account.createdAt).getTime()) < 60000; // Created within last minute
        
        console.log('✅ User account loaded successfully:', { 
          uid: account.uid,
          onboardingCompleted: account.onboardingData?.onboardingCompleted,
          needsOnboarding,
          isNewUser,
          accountCreatedRecently,
          createdAt: account.createdAt,
          onboardingData: account.onboardingData
        });
        
        // Track analytics events only once per session for this user (using global tracking)
        const hasAlreadyTrackedThisUser = GLOBAL_TRACKED_SIGN_INS.has(firebaseUser.uid);
        
        console.log('🔍 [ANALYTICS DEBUG] Global tracking check:', {
          userId: firebaseUser.uid,
          hasAlreadyTracked: hasAlreadyTrackedThisUser,
          trackedUsers: Array.from(GLOBAL_TRACKED_SIGN_INS),
          setSize: GLOBAL_TRACKED_SIGN_INS.size,
          lastTrackedUser: GLOBAL_LAST_TRACKED_USER
        });
        
        if (!hasAlreadyTrackedThisUser) {
          // Mark this user as tracked for this session globally
          GLOBAL_TRACKED_SIGN_INS.add(firebaseUser.uid);
          GLOBAL_LAST_TRACKED_USER = firebaseUser.uid;
          
          console.log('✅ [ANALYTICS DEBUG] User added to global tracking set:', {
            userId: firebaseUser.uid,
            newSetSize: GLOBAL_TRACKED_SIGN_INS.size,
            allTrackedUsers: Array.from(GLOBAL_TRACKED_SIGN_INS)
          });
          
          // Track appropriate event based on user type
          if (isNewUser && accountCreatedRecently) {
            console.log('🎉 New user detected - tracking sign up and first time app opened (session-once)');
            trackSignUp({
              method: 'google', // TODO: Detect actual method
              userId: firebaseUser!.uid,
              userEmail: user?.emailAddresses?.[0]?.emailAddress,
              userName: user?.fullName || account.firstName,
              isNewUser: true,
              hasExistingData: false,
              accountCreatedAt: account.createdAt?.toISOString(),
            });
            
            // Also track first time app opened
            trackFirstTimeAppOpened({
              userId: firebaseUser!.uid,
              userEmail: user?.emailAddresses?.[0]?.emailAddress,
              userName: user?.fullName || account.firstName,
              method: 'google', // TODO: Detect actual method
              accountCreatedAt: account.createdAt?.toISOString(),
            });
          } else {
            console.log('🔐 Returning user detected - tracking sign in (session-once)');
            trackSignIn({
              method: 'google', // TODO: Detect actual method
              userId: firebaseUser!.uid,
              userEmail: user?.emailAddresses?.[0]?.emailAddress,
              userName: user?.fullName || account.firstName,
              isNewUser: false,
              hasExistingData: true,
            });
          }
        } else {
          console.log('⏭️ [ANALYTICS DEBUG] User analytics already tracked globally, skipping duplicate tracking:', {
            userId: firebaseUser.uid,
            trackedUsers: Array.from(GLOBAL_TRACKED_SIGN_INS),
            setSize: GLOBAL_TRACKED_SIGN_INS.size,
            lastTrackedUser: GLOBAL_LAST_TRACKED_USER
          });
        }

        // =====================
        // CACHE AUTH DATA for offline-first experience (only when needed)
        // =====================
        try {
          const existingCache = await authCache.getCachedAuth();
          const shouldUpdateCache = !existingCache || 
            !authCache.isUserMatching(firebaseUser.uid) ||
            !authCache.isCacheValid(existingCache);
            
          if (shouldUpdateCache) {
            const cacheData = authCache.createCacheData(firebaseUser!, user, account);
            await authCache.setCachedAuth(cacheData);
            console.log('💾 Cached auth data for user:', firebaseUser.uid);
          } else {
            console.log('⏭️ Auth cache is fresh, skipping cache update');
          }
        } catch (cacheError) {
          console.error('❌ Failed to cache auth data:', cacheError);
          // Don't fail the whole flow for cache errors
        }
        
      } catch (error) {
        // Clear timeout on error
        if (userAccountTimeoutRef.current) {
          clearTimeout(userAccountTimeoutRef.current);
          userAccountTimeoutRef.current = null;
        }

        // Handle different error types
        const isTimeoutError = error instanceof Error && error.message.includes('timed out');
        const errorMessage = error instanceof Error ? error.message : 'Failed to load user account';

        console.error('❌ Failed to initialize user document:', {
          error: errorMessage,
          isTimeout: isTimeoutError,
          userId: firebaseUser!.uid
        });
        
        // Create fallback user account with proper error handling
        try {
          const fallbackAccount: UserAccount = {
            uid: firebaseUser!.uid,
            firstName: '',
            onboardingData: {
              onboardingCompleted: false,
              onboardingCompletedAt: 0,
              whatDoYouDoInLife: [],
              selfReflectionPracticesTried: [],
              clarityInLife: 0,
              stressInLife: 0
            },
            coachingConfig: {
              challengeDegree: 'moderate',
              harshToneDegree: 'supportive',
              coachingMessageFrequency: 'daily',
              enableCoachingMessages: true,
              lastCoachingMessageSentAt: 0,
              coachingMessageTimePreference: 'morning'
            },
            mobilePushNotifications: {
              enabled: false,
              expoPushTokens: [],
              lastNotificationSentAt: 0
            },
            userTimezone: 'America/New_York',
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          setUserAccount(fallbackAccount);
          setNeedsOnboarding(true);
          
          console.log('⚠️ Using fallback user account:', {
            reason: errorMessage,
            isTimeout: isTimeoutError,
            userId: firebaseUser!.uid
          });
          
          // Track as new user since we had to create fallback account (only if not already tracked globally)
          if (!GLOBAL_TRACKED_SIGN_INS.has(firebaseUser!.uid)) {
            GLOBAL_TRACKED_SIGN_INS.add(firebaseUser!.uid);
            GLOBAL_LAST_TRACKED_USER = firebaseUser!.uid;
            console.log('🆕 Fallback account created - tracking as new user sign up and first time app opened (global)');
            trackSignUp({
              method: 'google', // TODO: Detect actual method
              userId: firebaseUser!.uid,
              userEmail: user?.emailAddresses?.[0]?.emailAddress,
              userName: user?.fullName || undefined,
              isNewUser: true,
              hasExistingData: false,
              accountCreatedAt: fallbackAccount.createdAt?.toISOString(),
            });
            
            // Also track first time app opened
            trackFirstTimeAppOpened({
              userId: firebaseUser!.uid,
              userEmail: user?.emailAddresses?.[0]?.emailAddress,
              userName: user?.fullName || undefined,
              method: 'google', // TODO: Detect actual method
              accountCreatedAt: fallbackAccount.createdAt?.toISOString(),
            });
          } else {
            console.log('⏭️ Fallback analytics already tracked globally for this user, skipping duplicate');
          }
        } catch (fallbackError) {
          console.error('❌ Critical error: Failed to create fallback user account:', fallbackError);
          // Even fallback failed - this is a critical error state
          // Don't set userAccount to maintain null state for error handling
        }
      } finally {
        setUserAccountLoading(false);
      }
    };

    initializeUserDocument();
    
    // Cleanup function
    return () => {
      if (userAccountTimeoutRef.current) {
        clearTimeout(userAccountTimeoutRef.current);
        userAccountTimeoutRef.current = null;
      }
    };
  }, [firebaseUser?.uid, isSigningOut]); // 🚀 MINIMAL DEPENDENCIES to prevent loops

  // 🚀 HEAVILY RESTRICTED: Background sync function - minimal usage only
  const backgroundSyncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastBackgroundSyncRef = useRef<number>(0);
  const backgroundSyncCountRef = useRef<number>(0);
  const MAX_BACKGROUND_SYNCS_PER_SESSION = 3; // Maximum 3 background syncs per app session
  
  const performBackgroundAuthSync = useCallback(async () => {
    if (!firebaseUser?.uid) return;
    
    // 🚀 PREVENT SPAM: Only sync once every 5 minutes AND max 3 times per session
    const now = Date.now();
    const timeSinceLastSync = now - lastBackgroundSyncRef.current;
    
    if (timeSinceLastSync < 300000) { // 5 minutes
      console.log(`⏭️ Background sync skipped - too recent (${Math.round(timeSinceLastSync/1000)}s ago)`);
      return;
    }
    
    if (backgroundSyncCountRef.current >= MAX_BACKGROUND_SYNCS_PER_SESSION) {
      console.log('⏭️ Background sync skipped - session limit reached');
      return;
    }
    
    // Clear any pending sync
    if (backgroundSyncTimeoutRef.current) {
      clearTimeout(backgroundSyncTimeoutRef.current);
    }
    
    // Heavily debounced sync
    backgroundSyncTimeoutRef.current = setTimeout(async () => {
      try {
        backgroundSyncCountRef.current++;
        console.log(`🔄 Background auth sync started (${backgroundSyncCountRef.current}/${MAX_BACKGROUND_SYNCS_PER_SESSION})`);
        
        const account = await FirestoreService.getUserAccount(firebaseUser.uid);
        
        if (account) {
          // Only update cache, don't modify UI state from background sync
          if (user) {
            const cacheData = authCache.createCacheData(firebaseUser, user, account);
            await authCache.setCachedAuth(cacheData);
          }
          
          lastBackgroundSyncRef.current = Date.now();
          console.log('✅ Background auth sync completed (cache only)');
        }
      } catch (error) {
        console.error('❌ Background auth sync failed:', error);
      }
    }, 5000); // 5 second debounce
  }, [firebaseUser?.uid, user]);

  // 🚀 DISABLED: App state monitoring removed to prevent excessive auth checks
  // Only rely on cache-first approach - no app foreground triggers
  
  useEffect(() => {
    // Cleanup timeouts only
    return () => {
      if (backgroundSyncTimeoutRef.current) {
        clearTimeout(backgroundSyncTimeoutRef.current);
        backgroundSyncTimeoutRef.current = null;
      }
      if (progressClearTimeoutRef.current) {
        clearTimeout(progressClearTimeoutRef.current);
        progressClearTimeoutRef.current = null;
      }
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const signInStartTime = Date.now();
    setIsLoading(true);
    setAuthError(null);
    setAuthAttempts(0);
    
    try {
      console.log('🔐 Starting Google OAuth flow...');
      const { createdSessionId, setActive } = await startGoogleOAuthFlow();

      if (createdSessionId) {
        console.log('✅ Google OAuth successful, setting active session...');
        setActive!({ session: createdSessionId });
        
        // Get the Clerk token and sign in to Firebase
        const token = await getToken();
        if (token) {
          console.log('🔥 Signing in to Firebase with Clerk token...');
          await signInWithClerkToken(token);
          console.log('✅ Firebase sign-in completed');
        }
      }
    } catch (error) {
      console.error('❌ Google OAuth error:', error);
      setAuthError(error instanceof Error ? error.message : 'Google sign-in failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [startGoogleOAuthFlow, getToken]);

  const signInWithApple = useCallback(async () => {
    const signInStartTime = Date.now();
    setIsLoading(true);
    setAuthError(null);
    setAuthAttempts(0);
    
    try {
      console.log('🍎 Starting Apple OAuth flow...');
      const { createdSessionId, setActive } = await startAppleOAuthFlow();

      if (createdSessionId) {
        console.log('✅ Apple OAuth successful, setting active session...');
        setActive!({ session: createdSessionId });
        
        // Get the Clerk token and sign in to Firebase
        const token = await getToken();
        if (token) {
          console.log('🔥 Signing in to Firebase with Clerk token...');
          await signInWithClerkToken(token);
          console.log('✅ Firebase sign-in completed');
        }
      }
    } catch (error) {
      console.error('❌ Apple OAuth error:', error);
      setAuthError(error instanceof Error ? error.message : 'Apple sign-in failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [startAppleOAuthFlow, getToken]);

  const handleSignOut = useCallback(async () => {
    try {
      setIsSigningOut(true);
      setAuthError(null);
      
      // Set cooldown timestamp to prevent immediate re-sign-in
      lastSignOutTimeRef.current = Date.now();
      
      // Track sign out before actually signing out
      trackSignOut();
      
      // Sign out from Clerk first, then Firebase (sequential for better error tracking)
      console.log('🚪 Starting Clerk sign out...');
      await signOut();
      console.log('🚪 Clerk sign out completed, starting Firebase sign out...');
      
      await signOutFromFirebase();
      console.log('🚪 Firebase sign out completed');
      
      // Clear all caches for signed out user
      if (firebaseUser?.uid) {
        console.log('🧹 Clearing sync cache for user:', firebaseUser.uid);
        await syncService.clearUserData(firebaseUser.uid);
        console.log('🧹 Clearing settings cache for user:', firebaseUser.uid);
        await settingsCache.clearCache(firebaseUser.uid);
        console.log('🧹 Clearing auth cache for user:', firebaseUser.uid);
        await authCache.clearCache();
        
        // Clear global analytics tracking cache
        console.log('🧹 Clearing global analytics tracking cache');
        GLOBAL_TRACKED_SIGN_INS.clear();
        GLOBAL_LAST_TRACKED_USER = null;
        console.log('🧹 Clearing coaching cache for user:', firebaseUser.uid);
        // Import coaching cache service dynamically to avoid circular dependencies
        const { coachingCacheService } = await import('../services/coachingCacheService');
        await coachingCacheService.clearUserMessages(firebaseUser.uid);
      }
      
      console.log('✅ Sign out completed successfully');
    } catch (error) {
      console.error('Sign out error:', error);
      setAuthError(error instanceof Error ? error.message : 'Sign out failed');
      throw error;
    } finally {
      // Don't reset isSigningOut here - let it reset when auth state actually changes
      // This prevents race conditions where auto sign-in triggers before logout is complete
      console.log('🚪 Sign out process completed, waiting for auth state change');
    }
  }, [signOut, trackSignOut]);

  const resetGetStartedState = useCallback(() => {
    setShouldShowGetStarted(false);
  }, []);

  const retryAuthentication = useCallback(() => {
    setAuthError(null);
    setAuthAttempts(0);
    
    // Clear any pending timeouts
    if (firebaseRetryTimeoutRef.current) {
      clearTimeout(firebaseRetryTimeoutRef.current);
      firebaseRetryTimeoutRef.current = null;
    }
    if (userAccountTimeoutRef.current) {
      clearTimeout(userAccountTimeoutRef.current);
      userAccountTimeoutRef.current = null;
    }
  }, []);

  const refreshUserAccount = useCallback(async () => {
    if (firebaseUser?.uid) {
      try {
        setUserAccountLoading(true);
        
        // Refresh the user account data to get the updated onboarding status
        const updatedAccount = await FirestoreService.getUserAccount(firebaseUser.uid);
        setUserAccount(updatedAccount);
        const needsOnboarding = !updatedAccount.onboardingData || updatedAccount.onboardingData.onboardingCompleted !== true;
        setNeedsOnboarding(needsOnboarding);
        
        console.log('🔄 User account refreshed:', { 
          uid: firebaseUser.uid,
          onboardingCompleted: updatedAccount.onboardingData?.onboardingCompleted,
          needsOnboarding,
          timestamp: new Date().toISOString()
        });

        return { needsOnboarding, account: updatedAccount };
      } catch (error) {
        console.error('❌ Failed to refresh user account:', error);
        throw error;
      } finally {
        setUserAccountLoading(false);
      }
    }
    return { needsOnboarding: true, account: null };
  }, [firebaseUser?.uid]);

  // 🔄 Enhanced getToken with caching for offline support
  const getTokenWithCache = useCallback(async (): Promise<string | null> => {
    try {
      const token = await getToken();
      if (token) {
        // Cache the token for offline use
        await authCache.saveSessionToken(token);
        console.log('💾 Session token cached for offline use');
      }
      return token;
    } catch (error) {
      console.error('❌ Error getting token:', error);
      // Try to return cached token as fallback
      const cachedToken = await authCache.getSessionToken();
      if (cachedToken) {
        console.log('🔄 Using cached session token as fallback');
        return cachedToken;
      }
      return null;
    }
  }, [getToken]);

  const completeOnboarding = useCallback(async () => {
    if (!firebaseUser?.uid) {
      throw new Error('No authenticated user found');
    }

    try {
      console.log('🚀 Marking onboarding as completed in Firestore...');
      
      // Mark onboarding as completed in Firestore
      await FirestoreService.updateUserAccount(firebaseUser.uid, {
        onboardingData: {
          onboardingCompleted: true,
          onboardingCompletedAt: Date.now(),
          whatDoYouDoInLife: userAccount?.onboardingData?.whatDoYouDoInLife || [],
          selfReflectionPracticesTried: userAccount?.onboardingData?.selfReflectionPracticesTried || [],
          clarityInLife: userAccount?.onboardingData?.clarityInLife || 0.5,
          stressInLife: userAccount?.onboardingData?.stressInLife || 0.5,
        },
        updatedAt: new Date(),
      });

      console.log('✅ Onboarding marked as completed in Firestore');

      // Save onboarding completion timestamp for notification timing
      try {
        const AsyncStorage = await import('@react-native-async-storage/async-storage');
        await AsyncStorage.default.setItem('@onboarding_completed_at', Date.now().toString());
        console.log('📱 Onboarding completion timestamp saved for notification timing');
      } catch (error) {
        console.error('❌ Failed to save onboarding completion timestamp:', error);
      }

      // Refresh user account to get updated data
      const result = await refreshUserAccount();
      console.log('🧭 Onboarding completion - user account refreshed:', result);
      return result;
    } catch (error) {
      console.error('❌ Error completing onboarding:', error);
      throw error;
    }
  }, [firebaseUser?.uid, userAccount?.onboardingData, refreshUserAccount]);

  // Computed auth states for better navigation decisions
  const effectiveFirebaseUser = firebaseUser || offlineFirebaseUser;
  const isFullyAuthenticated = (isSignedIn && !!firebaseUser) || !!offlineFirebaseUser;
  
  // 🚀 OFFLINE-FIRST: Auth is ready when we have cache data OR when online flow completes
  // Don't block on Clerk/Firebase if we have valid cache data
  const isOnline = isConnected === true && isInternetReachable === true;
  const isAuthReady = (
    // OFFLINE: If we have valid cache data, auth is ready regardless of Clerk/Firebase
    (isCacheLoaded && !!userAccount && needsOnboarding !== null) ||
    // ONLINE: Traditional flow when Clerk is loaded and we're online
    (isOnline && isClerkLoaded && (
      // During sign out, consider auth as ready to maintain stable navigation
      isSigningOut ||
      // Either user is not signed in (confirmed by Clerk) 
      (!isSignedIn && !firebaseUser && isFirebaseReady) ||
      // Or user is fully authenticated AND (has cached data OR completed loading)
      (isFullyAuthenticated && (isCacheLoaded || !!userAccount || !userAccountLoading))
    )) ||
    // OFFLINE FALLBACK: If offline but no cache, wait minimally for Clerk
    (!isOnline && isClerkLoaded)
  );
  
  // 🚀 OFFLINE-FIRST: User account ready when we have cache data OR online data
  const isUserAccountReady = (
    // OFFLINE: Cache data is sufficient
    (!!userAccount && needsOnboarding !== null) ||
    // ONLINE: Traditional check
    (isOnline && isFullyAuthenticated && (!!userAccount || (isCacheLoaded && !userAccountLoading)))
  );

  return {
    // User data
    user,
    firebaseUser: effectiveFirebaseUser, // 🚀 OFFLINE-FIRST: Use offline user when available
    userAccount,
    
    // Authentication state
    isSignedIn: isFullyAuthenticated, // 🚀 OFFLINE-FIRST: Includes offline authentication
    isLoading,
    isFirebaseReady: isFirebaseReady || !!offlineFirebaseUser, // 🚀 Ready if offline user exists
    isAuthReady,
    isUserAccountReady,
    userAccountLoading,
    shouldShowGetStarted,
    needsOnboarding,
    isSigningOut,
    
    // Error state
    authError,
    
    // 🚀 OFFLINE-FIRST: Effective user that works offline and online
    effectiveFirebaseUser,
    
    // Actions
    signInWithGoogle,
    signInWithApple,
    signOut: handleSignOut,
    resetGetStartedState,
    completeOnboarding,
    refreshUserAccount,
    retryAuthentication,
    getToken,
    getTokenWithCache, // 🔄 Enhanced token getter with caching
  };
}