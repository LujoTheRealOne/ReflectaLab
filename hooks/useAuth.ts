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
  
  // Timeout and cleanup refs
  const userAccountTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const firebaseRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxAuthAttempts = 3;
  const userAccountTimeout = 10000; // 10 seconds
  
  const { trackSignUp, trackSignIn, trackSignOut } = useAnalytics();

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onFirebaseAuthStateChanged((user) => {
      console.log('🔥 Firebase auth state changed:', { uid: user?.uid, email: user?.email });
      setFirebaseUser(user);
      setIsFirebaseReady(true);
      
      // Reset auth-dependent state when user signs out
      if (!user) {
        setUserAccount(null);
        setNeedsOnboarding(false);
        setAuthError(null);
        setUserAccountLoading(false);
        setAuthAttempts(0);
        
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
  }, [isSignedIn, user, firebaseUser, getToken, authAttempts]);

  // Initialize user document in Firestore when Firebase user is available
  useEffect(() => {
    const initializeUserDocument = async () => {
      if (!firebaseUser?.uid) return;

      try {
        setUserAccountLoading(true);
        
        // Set a timeout for user account loading
        const timeoutPromise = new Promise((_, reject) => {
          userAccountTimeoutRef.current = setTimeout(() => {
            reject(new Error('User account loading timed out'));
          }, userAccountTimeout);
        });
        
        // Race between actual loading and timeout
        const accountPromise = FirestoreService.getUserAccount(firebaseUser.uid);
        
        const account = await Promise.race([accountPromise, timeoutPromise]) as UserAccount;
        
        // Clear timeout if successful
        if (userAccountTimeoutRef.current) {
          clearTimeout(userAccountTimeoutRef.current);
          userAccountTimeoutRef.current = null;
        }
        
        setUserAccount(account);
        
        // Check if user needs onboarding (with safe access in case of missing data)
        const needsOnboarding = !account.onboardingData || account.onboardingData.onboardingCompleted !== true;
        setNeedsOnboarding(needsOnboarding);
        
        console.log('✅ User account loaded:', { 
          onboardingCompleted: account.onboardingData?.onboardingCompleted,
          needsOnboarding
        });
      } catch (error) {
        console.error('❌ Failed to initialize user document:', error);
        
        // Clear timeout
        if (userAccountTimeoutRef.current) {
          clearTimeout(userAccountTimeoutRef.current);
          userAccountTimeoutRef.current = null;
        }
        
        // Create minimal fallback user account to prevent blocking
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
        
        console.log('⚠️ Using fallback user account due to loading failure');
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
  }, [firebaseUser?.uid]);

  const signInWithGoogle = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null);
    setAuthAttempts(0);
    
    try {
      const { createdSessionId, setActive } = await startGoogleOAuthFlow();

      if (createdSessionId) {
        setActive!({ session: createdSessionId });
        
        // Get the Clerk token and sign in to Firebase
        const token = await getToken();
        if (token) {
          await signInWithClerkToken(token);
          
          // Track sign in
          trackSignIn({
            method: 'google',
          });
        }
      }
    } catch (error) {
      console.error('Google OAuth error:', error);
      setAuthError(error instanceof Error ? error.message : 'Google sign-in failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [startGoogleOAuthFlow, getToken, trackSignIn]);

  const signInWithApple = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null);
    setAuthAttempts(0);
    
    try {
      const { createdSessionId, setActive } = await startAppleOAuthFlow();

      if (createdSessionId) {
        setActive!({ session: createdSessionId });
        
        // Get the Clerk token and sign in to Firebase
        const token = await getToken();
        if (token) {
          await signInWithClerkToken(token);
          
          // Track sign in
          trackSignIn({
            method: 'apple',
          });
        }
      }
    } catch (error) {
      console.error('Apple OAuth error:', error);
      setAuthError(error instanceof Error ? error.message : 'Apple sign-in failed');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [startAppleOAuthFlow, getToken, trackSignIn]);

  const handleSignOut = useCallback(async () => {
    try {
      setAuthError(null);
      // Track sign out before actually signing out
      trackSignOut();
      
      await Promise.all([
        signOut(),
        signOutFromFirebase()
      ]);
    } catch (error) {
      console.error('Sign out error:', error);
      setAuthError(error instanceof Error ? error.message : 'Sign out failed');
      throw error;
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

        // Force a re-render by triggering a state update
        // This ensures the navigation component re-evaluates the needsOnboarding state
        setUserAccount(prevAccount => ({ ...updatedAccount }));
        
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
  const isAuthReady = isClerkLoaded && isFirebaseReady && (
    // Either user is not signed in (confirmed by Clerk) 
    (!isSignedIn && !firebaseUser) ||
    // Or user is fully authenticated AND we've attempted to load user account
    (isFullyAuthenticated && (!!userAccount || !userAccountLoading))
  );

  console.log('🔐 Auth State Debug:', {
    isClerkLoaded,
    isSignedIn,
    isFirebaseReady,
    firebaseUser: !!firebaseUser,
    userAccount: !!userAccount,
    userAccountLoading,
    isFullyAuthenticated,
    isAuthReady,
    needsOnboarding
  });
  
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