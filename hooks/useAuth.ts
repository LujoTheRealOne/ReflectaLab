import { signInWithClerkToken, signOutFromFirebase, onFirebaseAuthStateChanged, getCurrentFirebaseUser } from '@/lib/clerk-firebase-auth';
import { useAuth as useClerkAuth, useOAuth, useUser } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// This is required for Expo web
WebBrowser.maybeCompleteAuthSession();

// Function to add a new user to Firestore
const addUserToFirestore = async (userId: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    
    // Check if user already exists
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      // Create new user document
      await setDoc(userRef, {
        uid: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      console.log('New user added to Firestore:', userId);
    }
  } catch (error) {
    console.error('Error adding user to Firestore:', error);
    throw error;
  }
};

export function useAuth() {
  const { signOut, isSignedIn, getToken } = useClerkAuth();
  const { user } = useUser();
  const { startOAuthFlow: startGoogleOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const { startOAuthFlow: startAppleOAuthFlow } = useOAuth({ strategy: 'oauth_apple' });
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
      const { createdSessionId, setActive } = await startGoogleOAuthFlow();

      if (createdSessionId) {
        setActive!({ session: createdSessionId });
        console.log("createdSessionId", createdSessionId);
        
        // Get the Clerk token and sign in to Firebase
        // Add retry mechanism for token retrieval
        let token = await getToken();
        console.log("initial token", token);
        
        // If token is null (which can happen during sign up), retry a few times
        if (!token) {
          console.log("Token is null, will retry...");
          
          // Try up to 3 times with increasing delays
          for (let i = 0; i < 3; i++) {
            // Wait for a short delay before retrying
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            
            token = await getToken();
            console.log(`Retry ${i + 1} token:`, token);
            
            if (token) break;
          }
        }
        
        if (token) {
          console.log("signing in with token", token);
          const firebaseUser = await signInWithClerkToken(token);
          
          // If this is a new sign up (createdSessionId indicates a new user session)
          // add the user to Firestore
          if (createdSessionId && firebaseUser) {
            await addUserToFirestore(firebaseUser.uid);
          }
        } else {
          console.error("Failed to get Clerk token after multiple attempts");
          // Handle the case where we still don't have a token
          // You might want to show an error to the user or try a different approach
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
        // Add retry mechanism for token retrieval
        let token = await getToken();
        
        // If token is null (which can happen during sign up), retry a few times
        if (!token) {
          // Try up to 3 times with increasing delays
          for (let i = 0; i < 3; i++) {
            // Wait for a short delay before retrying
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            
            token = await getToken();
            if (token) break;
          }
        }
        
        if (token) {
          const firebaseUser = await signInWithClerkToken(token);
          
          // If this is a new sign up, add the user to Firestore
          if (createdSessionId && firebaseUser) {
            await addUserToFirestore(firebaseUser.uid);
          }
        } else {
          console.error("Failed to get Clerk token after multiple attempts");
          // Handle the case where we still don't have a token
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

  return {
    user,
    firebaseUser,
    isSignedIn: isSignedIn && !!firebaseUser,
    isLoading,
    isFirebaseReady,
    shouldShowGetStarted,
    signInWithGoogle,
    signInWithApple,
    signOut: handleSignOut,
    resetGetStartedState,
  };
} 