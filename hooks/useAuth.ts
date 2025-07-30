import { signInWithClerkToken, signOutFromFirebase, onFirebaseAuthStateChanged, getCurrentFirebaseUser } from '@/lib/clerk-firebase-auth';
import { useAuth as useClerkAuth, useOAuth, useUser } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { FirestoreService } from '@/lib/firestore';
import { UserAccount } from '@/types/journal';

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
        
        // Check if user needs onboarding
        setNeedsOnboarding(account.onboardingCompleted !== true);
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
        }
      }
    } catch (error) {
      console.error('OAuth error', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [startGoogleOAuthFlow, getToken]);

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
        }
      }
    } catch (error) {
      console.error('Apple OAuth error', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [startAppleOAuthFlow, getToken]);

  const handleSignOut = useCallback(async () => {
    try {
      await Promise.all([
        signOut(),
        signOutFromFirebase()
      ]);
    } catch (error) {
      console.error('Sign out error', error);
      throw error;
    }
  }, [signOut]);

  const resetGetStartedState = useCallback(() => {
    setShouldShowGetStarted(false);
  }, []);

  const completeOnboarding = useCallback(async () => {
    if (firebaseUser?.uid) {
      try {
        // Update user account in Firestore
        await FirestoreService.updateUserAccount(firebaseUser.uid, {
          onboardingCompleted: true,
        });
        setNeedsOnboarding(false);
      } catch (error) {
        console.error('Failed to update onboarding status:', error);
      }
    }
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