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

// This is required for Expo web
WebBrowser.maybeCompleteAuthSession();

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
  
  // Helper function to clear progress when onboarding is completed
  const clearProgressIfCompleted = useCallback(async (account: UserAccount, needsOnboardingValue: boolean) => {
    if (!needsOnboardingValue && account.onboardingData?.onboardingCompleted === true) {
      console.log('🧹 Backend shows onboarding completed - clearing local progress');
      try {
        const AsyncStorage = await import('@react-native-async-storage/async-storage');
        await AsyncStorage.default.removeItem('@onboarding_progress');
        console.log('✅ Successfully cleared onboarding progress from AsyncStorage');
        
        // Small delay to ensure AsyncStorage operation completes
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.error('❌ Failed to clear onboarding progress:', error);
      }
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
  
  // Track which user we've already logged analytics for in this session
  const lastTrackedUserIdRef = useRef<string | null>(null);
  
  const { trackSignUp, trackSignIn, trackSignOut, trackFirstTimeAppOpened } = useAnalytics();

  // Listen to Firebase auth state changes (optimized to prevent spam)
  useEffect(() => {
    let lastUserId: string | null = null;
    
    const unsubscribe = onFirebaseAuthStateChanged((user) => {
      // Only log if user actually changed (not just re-fired)
      if (user?.uid !== lastUserId) {
        console.log('🔥 Firebase auth state changed:', { uid: user?.uid, hasUser: !!user });
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
        
        // Clear tracking state so next user can be tracked properly
        lastTrackedUserIdRef.current = null;
        
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
  }, [isSignedIn, user, firebaseUser, getToken, authAttempts, isSigningOut]);

  // Initialize user document in Firestore when Firebase user is available (online/offline aware)
  useEffect(() => {
    const initializeUserDocument = async () => {
      // Skip user account loading during sign out
      if (isSigningOut) {
        console.log('⏭️ Skipping user document init - currently signing out');
        return;
      }
      
      if (!firebaseUser?.uid) return;

      const isOnline = isConnected === true && isInternetReachable === true;
      console.log(`🌐 Network status: ${isOnline ? 'ONLINE' : 'OFFLINE'} (connected: ${isConnected}, reachable: ${isInternetReachable})`);

      if (isOnline) {
        // =====================
        // ONLINE: Prioritize backend data
        // =====================
        console.log('🌐 Online - fetching fresh data from backend');
        await performFullAuthInit();
      } else {
        // =====================
        // OFFLINE: Use cached data only
        // =====================
        console.log('📱 Offline - using cached data only');
        try {
          const cachedAuth = await authCache.getCachedAuth();
          
          if (cachedAuth && authCache.isUserMatching(firebaseUser.uid)) {
            console.log('⚡ Using cached auth data (offline mode)');
            
            // Set state from cache immediately (with proper UserAccount type)
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
            
            // Don't set needsOnboarding from cached data - wait for fresh backend data
            // Cached data might be stale, so we'll keep needsOnboarding as null until backend confirms
            // Progress clearing will happen when fresh backend data arrives
            
            setUserAccount(fullUserAccount);
            setUserAccountLoading(false);
            // setNeedsOnboarding(needsOnboardingValue); // Commented out - wait for backend data
            
            // Skip duplicate analytics tracking
            if (lastTrackedUserIdRef.current !== firebaseUser.uid) {
              lastTrackedUserIdRef.current = firebaseUser.uid;
              console.log('⏭️ Using cached auth - offline mode');
            }
            
            return;
          } else {
            console.log('❌ No valid cache available in offline mode');
            setUserAccountLoading(false);
            setAuthError('No cached data available. Please connect to the internet.');
          }
        } catch (error) {
          console.error('❌ Error loading auth cache in offline mode:', error);
          setUserAccountLoading(false);
          setAuthError('Failed to load cached data.');
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
        
        // Track analytics events only once per session for this user
        const hasAlreadyTrackedThisUser = lastTrackedUserIdRef.current === firebaseUser.uid;
        
        if (!hasAlreadyTrackedThisUser) {
          // Mark this user as tracked for this session
          lastTrackedUserIdRef.current = firebaseUser.uid;
          
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
          console.log('⏭️ User analytics already tracked for this session, skipping duplicate tracking');
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
          
          // Track as new user since we had to create fallback account
          console.log('🆕 Fallback account created - tracking as new user sign up and first time app opened');
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
  }, [firebaseUser?.uid, isSigningOut, isConnected, isInternetReachable, clearProgressIfCompleted]);

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
  const isFullyAuthenticated = isSignedIn && !!firebaseUser;
  
  // Only consider auth ready when we have determined the actual auth state
  // Wait for both Firebase to be ready AND Clerk to have loaded
  // During sign out, keep auth ready to prevent white screen flash
  const isAuthReady = isClerkLoaded && isFirebaseReady && (
    // During sign out, consider auth as ready to maintain stable navigation
    isSigningOut ||
    // Either user is not signed in (confirmed by Clerk) 
    (!isSignedIn && !firebaseUser) ||
    // Or user is fully authenticated AND we've attempted to load user account
    (isFullyAuthenticated && (!!userAccount || !userAccountLoading))
  );
  
  const isUserAccountReady = isFullyAuthenticated && (!!userAccount || !userAccountLoading);

  return {
    // User data
    user,
    firebaseUser,
    userAccount,
    
    // Authentication state
    isSignedIn: isFullyAuthenticated, // This is correct - isFullyAuthenticated is computed from Clerk's isSignedIn
    isLoading,
    isFirebaseReady,
    isAuthReady,
    isUserAccountReady,
    userAccountLoading,
    shouldShowGetStarted,
    needsOnboarding,
    isSigningOut,
    
    // Error state
    authError,
    
    // Actions
    signInWithGoogle,
    signInWithApple,
    signOut: handleSignOut,
    resetGetStartedState,
    completeOnboarding,
    refreshUserAccount,
    retryAuthentication,
    getToken,
  };
}