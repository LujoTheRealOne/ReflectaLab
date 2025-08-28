import { signInWithClerkToken, signOutFromFirebase, onFirebaseAuthStateChanged, getCurrentFirebaseUser } from '@/lib/clerk-firebase-auth';
import { useAuth as useClerkAuth, useOAuth, useUser } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState, useEffect, useRef } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { FirestoreService } from '@/lib/firestore';
import { UserAccount } from '@/types/journal';
import { useAnalytics } from './useAnalytics';

// This is required for Expo web
WebBrowser.maybeCompleteAuthSession();

export function useAuth() {
  const { signOut, isSignedIn, getToken, isLoaded: isClerkLoaded } = useClerkAuth();
  const { user } = useUser();
  const { startOAuthFlow: startGoogleOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const { startOAuthFlow: startAppleOAuthFlow } = useOAuth({ strategy: 'oauth_apple' });
  const [isLoading, setIsLoading] = useState(false);
  const [shouldShowGetStarted, setShouldShowGetStarted] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(true); // Default to true for safety
  
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

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onFirebaseAuthStateChanged((user) => {
      console.log('🔥 Firebase auth state changed:', { uid: user?.uid, hasUser: !!user });
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

  // Initialize user document in Firestore when Firebase user is available
  useEffect(() => {
    const initializeUserDocument = async () => {
      // Skip user account loading during sign out
      if (isSigningOut) {
        console.log('⏭️ Skipping user document init - currently signing out');
        return;
      }
      
      if (!firebaseUser?.uid) return;

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
          FirestoreService.getUserAccount(firebaseUser.uid),
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
        
        setUserAccount(account);
        
        // Check if user needs onboarding (with safe access in case of missing data)
        const needsOnboarding = !account.onboardingData || account.onboardingData.onboardingCompleted !== true;
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
              userId: firebaseUser.uid,
              userEmail: user?.emailAddresses?.[0]?.emailAddress,
              userName: user?.fullName || account.firstName,
              isNewUser: true,
              hasExistingData: false,
              accountCreatedAt: account.createdAt?.toISOString(),
            });
            
            // Also track first time app opened
            trackFirstTimeAppOpened({
              userId: firebaseUser.uid,
              userEmail: user?.emailAddresses?.[0]?.emailAddress,
              userName: user?.fullName || account.firstName,
              method: 'google', // TODO: Detect actual method
              accountCreatedAt: account.createdAt?.toISOString(),
            });
          } else {
            console.log('🔐 Returning user detected - tracking sign in (session-once)');
            trackSignIn({
              method: 'google', // TODO: Detect actual method
              userId: firebaseUser.uid,
              userEmail: user?.emailAddresses?.[0]?.emailAddress,
              userName: user?.fullName || account.firstName,
              isNewUser: false,
              hasExistingData: true,
            });
          }
        } else {
          console.log('⏭️ User analytics already tracked for this session, skipping duplicate tracking');
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
          userId: firebaseUser.uid
        });
        
        // Create fallback user account with proper error handling
        try {
          const fallbackAccount: UserAccount = {
            uid: firebaseUser.uid,
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
            userId: firebaseUser.uid
          });
          
          // Track as new user since we had to create fallback account
          console.log('🆕 Fallback account created - tracking as new user sign up and first time app opened');
          trackSignUp({
            method: 'google', // TODO: Detect actual method
            userId: firebaseUser.uid,
            userEmail: user?.emailAddresses?.[0]?.emailAddress,
            userName: user?.fullName,
            isNewUser: true,
            hasExistingData: false,
            accountCreatedAt: fallbackAccount.createdAt?.toISOString(),
          });
          
          // Also track first time app opened
          trackFirstTimeAppOpened({
            userId: firebaseUser.uid,
            userEmail: user?.emailAddresses?.[0]?.emailAddress,
            userName: user?.fullName,
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
  }, [firebaseUser?.uid, isSigningOut]);

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

  const completeOnboarding = useCallback(async () => {
    if (firebaseUser?.uid) {
      try {
        setUserAccountLoading(true);
        
        // Refresh the user account data to get the updated onboarding status
        const updatedAccount = await FirestoreService.getUserAccount(firebaseUser.uid);
        setUserAccount(updatedAccount);
        const needsOnboarding = !updatedAccount.onboardingData || updatedAccount.onboardingData.onboardingCompleted !== true;
        setNeedsOnboarding(needsOnboarding);
        
        console.log('🧭 User account refreshed:', { 
          onboardingCompleted: updatedAccount.onboardingData?.onboardingCompleted,
          needsOnboarding
        });

        // Update user account state with fresh data
        setUserAccount(updatedAccount);
        
        return { needsOnboarding, account: updatedAccount };
      } catch (error) {
        console.error('Failed to update onboarding status:', error);
        throw error; // Re-throw to handle in the UI
      } finally {
        setUserAccountLoading(false);
      }
    }
    return { needsOnboarding: true, account: null };
  }, [firebaseUser?.uid]);

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
    isSignedIn: isFullyAuthenticated,
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
    retryAuthentication,
    getToken,
  };
}