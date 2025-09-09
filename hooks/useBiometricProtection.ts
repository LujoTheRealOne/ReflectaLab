import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useBiometricAuth } from './useBiometricAuth';

export interface BiometricProtectionState {
  isProtected: boolean;
  isAuthenticated: boolean;
  isAuthenticating: boolean;
  shouldAuthenticate: boolean;
}

export const useBiometricProtection = () => {
  const { isEnabled, authenticate } = useBiometricAuth();
  const [state, setState] = useState<BiometricProtectionState>({
    isProtected: false,
    isAuthenticated: false,
    isAuthenticating: false,
    shouldAuthenticate: false,
  });
  
  const appState = useRef(AppState.currentState);
  const authenticationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastBackgroundTime = useRef<number>(0);
  const isAuthenticatingRef = useRef(false);

  // Mark app as protected when biometric auth is enabled
  useEffect(() => {
    setState(prev => ({ 
      ...prev, 
      isProtected: isEnabled,
      shouldAuthenticate: isEnabled && !prev.isAuthenticated,
    }));
  }, [isEnabled]);

  // Sync authentication state with ref
  useEffect(() => {
    isAuthenticatingRef.current = state.isAuthenticating;
  }, [state.isAuthenticating]);

  // Perform biometric authentication
  const performAuthentication = useCallback(async (): Promise<boolean> => {
    if (!isEnabled || isAuthenticatingRef.current) {
      return true; // If not enabled or already authenticating, allow access
    }

    setState(prev => ({ ...prev, isAuthenticating: true }));

    try {
      const result = await authenticate('Unlock Reflecta');
      
      if (result.success) {
        setState(prev => ({ 
          ...prev, 
          isAuthenticated: true, 
          isAuthenticating: false,
          shouldAuthenticate: false,
        }));
        return true;
      } else {
        setState(prev => ({ 
          ...prev, 
          isAuthenticating: false,
          shouldAuthenticate: true,
        }));
        return false;
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      setState(prev => ({ 
        ...prev, 
        isAuthenticating: false,
        shouldAuthenticate: true,
      }));
      return false;
    }
  }, [isEnabled, authenticate]);

  // Clear authentication when app goes to background for real (not just Face ID modal)
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    const now = Date.now();
    
    if (nextAppState === 'background') {
      lastBackgroundTime.current = now;
    } else if (appState.current === 'background' && nextAppState === 'active') {
      // App has come to the foreground from real background
      const timeSinceBackground = now - lastBackgroundTime.current;
      
      // Only require authentication if we were in background for more than 2 seconds
      // This prevents Face ID modal transitions from triggering re-authentication
      if (isEnabled && timeSinceBackground > 2000 && !isAuthenticatingRef.current) {
        setState(prev => ({ 
          ...prev, 
          isAuthenticated: false,
          shouldAuthenticate: true,
        }));
      }
    }
    
    appState.current = nextAppState;
  }, [isEnabled]);

  // Set up app state listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [handleAppStateChange]);

  // Initial authentication when protection is enabled
  useEffect(() => {
    if (isEnabled && !state.isAuthenticated && AppState.currentState === 'active') {
      setState(prev => ({ 
        ...prev, 
        shouldAuthenticate: true,
      }));
    }
  }, [isEnabled, state.isAuthenticated]);

  // Manual authentication trigger
  const requestAuthentication = useCallback(async (): Promise<boolean> => {
    return await performAuthentication();
  }, [performAuthentication]);

  // Reset authentication state
  const resetAuthentication = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      isAuthenticated: false,
      shouldAuthenticate: isEnabled,
    }));
  }, [isEnabled]);

  return {
    ...state,
    requestAuthentication,
    resetAuthentication,
  };
};
