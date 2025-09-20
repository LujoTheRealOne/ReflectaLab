import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/hooks/useAuth';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';
import { useNetworkConnectivity } from '@/hooks/useNetworkConnectivity';
import { View, Text, TouchableOpacity } from 'react-native';
import AppNavigator from './AppNavigator';
import { rootNavigationRef } from './RootNavigation';
import AuthNavigator from './AuthNavigator';

// Define the root stack navigator type
const Stack = createNativeStackNavigator();

export default function Navigation() {
  const colorScheme = useColorScheme();
  const { 
    isSignedIn, 
    needsOnboarding, 
    isAuthReady, 
    isUserAccountReady,
    userAccountLoading,
    authError,
    retryAuthentication,
    isSigningOut,
    refreshUserAccount,
    firebaseUser
  } = useAuth();
  
  // 🚀 DEBUG: Log when Navigation component re-renders (dev only)
  if (__DEV__) {
    console.log('🧭 [NAVIGATION DEBUG] Navigation component re-rendered:', { isSigningOut, isSignedIn, needsOnboarding });
  }
  
  // Import onboarding progress to make better auth flow decisions
  const { progress: onboardingProgress, isLoading: progressLoading, clearProgress } = useOnboardingProgress();

  // Debug function to manually clear progress - remove in production
  useEffect(() => {
    if (__DEV__) {
      (global as any).clearOnboardingProgress = () => {
        console.log('🔧 DEBUG: Manually clearing onboarding progress');
        clearProgress();
      };
      console.log('🔧 DEBUG: clearOnboardingProgress() function available in console');
    }
  }, [clearProgress]);

  // Only refresh user account if there's a potential mismatch (debounced to prevent loops)
  // This prevents unnecessary refreshes on every navigation mount
  useEffect(() => {
    // Only trigger refresh once when conditions are met, not on every re-render
    const REFRESH_KEY = `${isSignedIn}-${firebaseUser?.uid}-${needsOnboarding}-${onboardingProgress?.currentStep}`;
    const lastRefreshKey = (global as any).__lastNavigationRefresh;
    
    if (
      isSignedIn && 
      firebaseUser?.uid && 
      isAuthReady && 
      needsOnboarding && 
      onboardingProgress?.currentStep === 17 &&
      lastRefreshKey !== REFRESH_KEY // Only refresh if parameters changed
    ) {
      // Mark this refresh as completed to prevent duplicate calls
      (global as any).__lastNavigationRefresh = REFRESH_KEY;
      
      // Only refresh if we detect a potential mismatch: user has OnboardingChat progress but might have completed onboarding
      const refreshData = async () => {
        try {
          console.log('🔍 Navigation: Potential mismatch detected - refreshing user account');
          await refreshUserAccount();
          console.log('🔄 Navigation: User account data refreshed due to mismatch');
        } catch (error) {
          console.error('❌ Navigation: Failed to refresh user account:', error);
        }
      };
      
      refreshData();
    }
  }, [isSignedIn, firebaseUser?.uid, isAuthReady, needsOnboarding, onboardingProgress?.currentStep, refreshUserAccount]);

  // 🚀 OFFLINE-FIRST: Show UI with cached data even offline
  // Only block if we truly don't have enough data to show UI
  const { isConnected, isInternetReachable } = useNetworkConnectivity();
  const isOnline = isConnected === true && isInternetReachable === true;
  
  // 🚀 OFFLINE FIX: Show UI more aggressively when offline to prevent splash screen stuck
  // Don't wait for needsOnboarding - it can load in background
  const canShowUI = (
    // Always show UI if signed out or signing out
    !isSignedIn || isSigningOut ||
    // For signed in users, show UI if auth is ready
    (isSignedIn && isAuthReady) ||
    // 🚀 OFFLINE FALLBACK: If offline and we have some cached data, show UI
    (!isOnline && firebaseUser && needsOnboarding !== null)
  );
  
  if (!canShowUI && !isSigningOut) {
    console.log('⏳ Waiting for minimal auth data - keeping splash visible', {
      isAuthReady,
      needsOnboarding,
      isSigningOut,
      isSignedIn,
      canShowUI,
      isOnline
    });
    return null; // Keep splash screen visible until we have enough data to show UI
  }
  
  // Allow navigation during sign out
  if (isSigningOut) {
    console.log('🚪 Signing out - proceeding with navigation to auth flow');
  }

  // Show authentication error with retry option
  if (authError) {
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background
      }}>
        <Text style={{ 
          color: colorScheme === 'dark' ? Colors.dark.text : Colors.light.text,
          fontSize: 16,
          textAlign: 'center',
          marginBottom: 20
        }}>
          {authError}
        </Text>
        <TouchableOpacity 
          onPress={retryAuthentication}
          style={{
            backgroundColor: Colors[colorScheme ?? 'light'].tint,
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 8
          }}
        >
          <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Don't block users waiting for user account data - let them proceed to app
  // User account will load in background and update state when ready

  // Determine navigation route - prioritize main app for authenticated users
  // CRITICAL: If user is signed in AND doesn't need onboarding, go directly to main app
  // Only show auth flow if user is not signed in OR needs onboarding OR is signing out
  const hasOnboardingChatProgress = onboardingProgress && onboardingProgress.currentStep === 17 && !onboardingProgress.completedAt && needsOnboarding === true;
  
  // 🚀 SMART ONBOARDING: Optimistic for returning users, safe for new users
  // - If needsOnboarding=false (confirmed completed): Main app ✅
  // - If needsOnboarding=true (confirmed needs): Auth flow ✅  
  // - If needsOnboarding=null (unknown): Auth flow for safety ✅
  const shouldShowMainApp = isSignedIn && needsOnboarding === false && !isSigningOut;
  const shouldShowAuthFlow = !isSignedIn || isSigningOut || !shouldShowMainApp || hasOnboardingChatProgress;
  const initialRouteName = shouldShowAuthFlow ? 'Auth' : 'App';
  
  console.log('🧭 Navigation route determination:', {
    isSignedIn,
    needsOnboarding,
    isSigningOut,
    hasOnboardingChatProgress,
    progressStep: onboardingProgress?.currentStep,
    progressCompleted: onboardingProgress?.completedAt,
    shouldShowMainApp,
    shouldShowAuthFlow,
    initialRouteName
  });

  // Include auth state in navigation key to force reset when auth state changes
  // 🚀 CRITICAL: Include isSigningOut to ensure navigation resets during signout
  const navigationKey = `nav-${shouldShowAuthFlow ? 'auth' : 'app'}-${isSignedIn ? 'signed-in' : 'signed-out'}-${isSigningOut ? 'signing-out' : 'stable'}`;

  console.log('🧭 Navigation state:', {
    isSignedIn,
    needsOnboarding,
    isAuthReady,
    isUserAccountReady,
    userAccountLoading,
    isSigningOut,
    shouldShowAuthFlow,
    initialRouteName,
    navigationKey
  });

  return (
    <View style={{
      flex: 1,
      backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background
    }}>
      <NavigationContainer
        key={navigationKey}
        theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
        ref={rootNavigationRef}
      >
        <Stack.Navigator
          screenOptions={{ headerShown: false }}
          initialRouteName={initialRouteName}
        >
          <Stack.Screen name="Auth" component={AuthNavigator} />
          <Stack.Screen name="App" component={AppNavigator} />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
} 