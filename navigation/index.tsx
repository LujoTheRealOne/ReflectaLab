import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

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
    isSigningOut
  } = useAuth();
  
  // Import onboarding progress to make better auth flow decisions
  const { progress: onboardingProgress, isLoading: progressLoading } = useOnboardingProgress();

  // Optimized loading: Only block for critical auth state, not for progress loading
  // Allow UI to show faster while data loads in background
  if (!isAuthReady && !isSigningOut) {
    console.log('⏳ Waiting for critical auth ready - showing loading', {
      isAuthReady,
      isSigningOut
    });
    return null; // Only wait for auth, not progress
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

  // Determine navigation route - force auth flow during sign out
  // CRITICAL: If user has progress at OnboardingChat (step 17), ALWAYS show auth flow
  // Use cached onboarding progress if available, don't wait for loading
  const hasOnboardingChatProgress = onboardingProgress && onboardingProgress.currentStep === 17 && !onboardingProgress.completedAt;
  const shouldShowAuthFlow = !isSignedIn || needsOnboarding || isSigningOut || hasOnboardingChatProgress;
  const initialRouteName = shouldShowAuthFlow ? 'Auth' : 'App';
  
  console.log('🧭 Navigation route determination:', {
    isSignedIn,
    needsOnboarding,
    isSigningOut,
    hasOnboardingChatProgress,
    progressStep: onboardingProgress?.currentStep,
    progressCompleted: onboardingProgress?.completedAt,
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