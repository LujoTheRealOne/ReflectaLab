import { signInWithCustomToken, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export interface TokenExchangeResponse {
  token: string;
  uid: string;
}

export const exchangeClerkTokenForFirebase = async (clerkToken: string): Promise<TokenExchangeResponse> => {
  // Validate input
  if (!clerkToken || typeof clerkToken !== 'string' || clerkToken.trim().length === 0) {
    throw new Error('Invalid Clerk token provided');
  }
  
  if (!process.env.EXPO_PUBLIC_API_URL) {
    throw new Error('API URL not configured');
  }

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
      let errorMessage = 'Token exchange failed';
      try {
        const error = await response.json();
        errorMessage = error.error || errorMessage;
      } catch {
        // If we can't parse error response, use status text
        errorMessage = response.statusText || errorMessage;
      }
      
      // Log specific error for debugging (without sensitive data)
      console.error(`Token exchange failed: ${response.status} ${response.statusText}`);
      throw new Error(errorMessage);
    }

    const data: TokenExchangeResponse = await response.json();
    
    // Validate response structure
    if (!data.token || !data.uid) {
      throw new Error('Invalid response from token exchange service');
    }
    
    return data;
  } catch (error) {
    console.error('Token exchange error:', error);
    throw error;
  }
};

export const signInWithClerkToken = async (clerkToken: string): Promise<User> => {
  try {
    // Validate inputs
    if (!clerkToken) {
      throw new Error('Clerk token is required');
    }
    
    if (!auth) {
      throw new Error('Firebase auth is not initialized');
    }

    // Exchange Clerk token for Firebase custom token
    const { token } = await exchangeClerkTokenForFirebase(clerkToken);
    
    // Sign in to Firebase with the custom token
    const userCredential = await signInWithCustomToken(auth, token);
    
    if (!userCredential.user) {
      throw new Error('Firebase sign-in succeeded but no user returned');
    }
    
    console.log('✅ Firebase sign-in successful');
    return userCredential.user;
  } catch (error) {
    console.error('❌ Firebase sign-in with Clerk token failed:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('network')) {
        throw new Error('Network error during sign-in. Please check your connection.');
      } else if (error.message.includes('token')) {
        throw new Error('Authentication token is invalid. Please try signing in again.');
      }
    }
    
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