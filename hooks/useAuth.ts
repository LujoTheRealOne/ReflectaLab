import { signInWithClerkToken, signOutFromFirebase, onFirebaseAuthStateChanged, getCurrentFirebaseUser } from '@/lib/clerk-firebase-auth';
import { useAuth as useClerkAuth, useOAuth, useUser } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { FirestoreService } from '@/lib/firestore';
import { UserAccount } from '@/types/journal';
import { useAnalytics } from './useAnalytics';

// This is required for Expo web
WebBrowser.maybeCompleteAuthSession();

export function useAuth() {
  const { signOut, isSignedIn, getToken } = useClerkAuth();
  const { user } = useUser();
  const { startOAuthFlow: startGoogleOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const { startOAuthFlow: startAppleOAuthFlow } = useOAuth({ strategy: 'oauth_apple' });
  const [isLoading, setIsLoading] = useState(false);
  const [shouldShowGetStarted, setShouldShowGetStarted] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const { trackSignUp, trackSignIn, trackSignOut } = useAnalytics();

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onFirebaseAuthStateChanged((user) => {
      setFirebaseUser(user);
      setIsFirebaseReady(true);
    });

    return unsubscribe;
  }, []);

  // Auto sign in to Firebase when Clerk user is available
  useEffect(() => {
    const signInToFirebase = async () => {
      if (isSignedIn && user && !firebaseUser) {
        try {
          setIsLoading(true);
          const token = await getToken();
          if (token) {
            await signInWithClerkToken(token);
          }
        } catch (error) {
          console.error('Failed to sign in to Firebase:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    signInToFirebase();
  }, [isSignedIn, user, firebaseUser, getToken]);

  // Initialize user document in Firestore when Firebase user is available
  useEffect(() => {
    const initializeUserDocument = async () => {
      if (!firebaseUser?.uid) return;

      try {
        // Ensure user document exists in Firestore
        const account = await FirestoreService.getUserAccount(firebaseUser.uid);
        setUserAccount(account);
        
        // Check if user needs onboarding (with safe access in case of missing data)
        const needsOnboarding = !account.onboardingData || account.onboardingData.onboardingCompleted !== true;
        setNeedsOnboarding(needsOnboarding);
      } catch (error) {
        console.error('Failed to initialize user document:', error);
        // Don't throw error here as this is not critical for basic functionality
      }
    };

    initializeUserDocument();
  }, [firebaseUser?.uid]);

  const signInWithGoogle = useCallback(async () => {
    setIsLoading(true);
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
      console.error('OAuth error', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [startGoogleOAuthFlow, getToken, trackSignIn, user]);

  const signInWithApple = useCallback(async () => {
    setIsLoading(true);
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
      console.error('Apple OAuth error', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [startAppleOAuthFlow, getToken, trackSignIn, user]);

  const handleSignOut = useCallback(async () => {
    try {
      // Track sign out before actually signing out
      trackSignOut();
      
      await Promise.all([
        signOut(),
        signOutFromFirebase()
      ]);
    } catch (error) {
      console.error('Sign out error', error);
      throw error;
    }
  }, [signOut, trackSignOut]);

  const resetGetStartedState = useCallback(() => {
    setShouldShowGetStarted(false);
  }, []);

  const completeOnboarding = useCallback(async () => {
    if (firebaseUser?.uid) {
      try {
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
      }
    }
    return { needsOnboarding: true, account: null };
  }, [firebaseUser?.uid]);

  return {
    user,
    firebaseUser,
    userAccount,
    isSignedIn: isSignedIn && !!firebaseUser,
    isLoading,
    isFirebaseReady,
    shouldShowGetStarted,
    needsOnboarding,
    signInWithGoogle,
    signInWithApple,
    signOut: handleSignOut,
    resetGetStartedState,
    completeOnboarding,
    getToken,
  };
} 