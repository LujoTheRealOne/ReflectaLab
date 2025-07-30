import { signInWithCustomToken, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export interface TokenExchangeResponse {
  token: string;
  uid: string;
}

export const exchangeClerkTokenForFirebase = async (clerkToken: string): Promise<TokenExchangeResponse> => {
  try {
    const response = await fetch(process.env.EXPO_PUBLIC_API_URL + "api/auth/firebase-token", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${clerkToken}`,
      },
      body: JSON.stringify({
        token: clerkToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Token exchange failed');
    }

    const data: TokenExchangeResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Token exchange error:', error);
    throw error;
  }
};

export const signInWithClerkToken = async (clerkToken: string): Promise<User> => {
  try {
    // Exchange Clerk token for Firebase custom token
    const { token } = await exchangeClerkTokenForFirebase(clerkToken);
    
    // Sign in to Firebase with the custom token
    const userCredential = await signInWithCustomToken(auth, token);
    
    return userCredential.user;
  } catch (error) {
    console.error('Firebase sign-in with Clerk token failed:', error);
    throw error;
  }
};

export const signOutFromFirebase = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Firebase sign-out failed:', error);
    throw error;
  }
};

// Helper function to get current Firebase user
export const getCurrentFirebaseUser = (): User | null => {
  return auth.currentUser;
};

// Helper function to listen to Firebase auth state changes
export const onFirebaseAuthStateChanged = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};