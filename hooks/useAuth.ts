import { signInWithClerkToken, signOutFromFirebase, onFirebaseAuthStateChanged, getCurrentFirebaseUser } from '@/lib/clerk-firebase-auth';
import { useAuth as useClerkAuth, useOAuth, useUser } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';

// This is required for Expo web
WebBrowser.maybeCompleteAuthSession();

export function useAuth() {
  const { signOut, isSignedIn, getToken } = useClerkAuth();
  const { user } = useUser();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const [isLoading, setIsLoading] = useState(false);
  const [shouldShowGetStarted, setShouldShowGetStarted] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);

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

  const signInWithGoogle = useCallback(async () => {
    setIsLoading(true);
    try {
      const { createdSessionId, setActive } = await startOAuthFlow();

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
  }, [startOAuthFlow, getToken]);

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

  return {
    user,
    firebaseUser,
    isSignedIn: isSignedIn && !!firebaseUser,
    isLoading,
    isFirebaseReady,
    shouldShowGetStarted,
    signInWithGoogle,
    signOut: handleSignOut,
    resetGetStartedState,
  };
} 