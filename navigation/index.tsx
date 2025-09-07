import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/hooks/useAuth';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';
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

  // Only refresh user account if there's a potential mismatch
  // This prevents unnecessary refreshes on every navigation mount
  useEffect(() => {
    if (isSignedIn && firebaseUser?.uid && isAuthReady && needsOnboarding && onboardingProgress?.currentStep === 17) {
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

  // Optimized loading: Only block for critical auth state, not for progress loading
  // Also wait for needsOnboarding to be determined from backend
  if ((!isAuthReady || needsOnboarding === null) && !isSigningOut) {
    console.log('⏳ Waiting for critical auth ready - keeping splash visible', {
      isAuthReady,
      needsOnboarding,
      isSigningOut
    });
    return null; // Keep splash screen visible until auth is ready AND needsOnboarding is determined
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
  
  // Simplified logic: Show main app if user is authenticated and doesn't need onboarding
  // needsOnboarding must be explicitly false (not null) to show main app
  const shouldShowMainApp = isSignedIn && needsOnboarding === false && !isSigningOut;
  const shouldShowAuthFlow = !shouldShowMainApp || hasOnboardingChatProgress;
  const initialRouteName = shouldShowMainApp ? 'App' : 'Auth';
  
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
  const navigationKey = `nav-${shouldShowAuthFlow ? 'auth' : 'app'}-${isSignedIn ? 'signed-in' : 'signed-out'}`;

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