import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/hooks/useAuth';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';
import { View, Text, TouchableOpacity } from 'react-native';
import AppNavigator from './AppNavigator';
import AuthNavigator from './AuthNavigator';
import OfflineNavigator from './OfflineNavigator';

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
    isOfflineMode,
    isOfflineAuthenticated
  } = useAuth();
  
  // Import onboarding progress to make better auth flow decisions
  const { progress: onboardingProgress, isLoading: progressLoading } = useOnboardingProgress();

  // Keep showing loading until authentication state is FULLY determined
  // This prevents the flash of login screen for authenticated users
  // Also wait for onboarding progress to load to make correct routing decisions
  if ((!isAuthReady || progressLoading) && !isSigningOut) {
    console.log('⏳ Waiting for auth ready and progress loading - showing loading', {
      isAuthReady,
      progressLoading,
      isSigningOut
    });
    return null; // Keep splash screen visible until both auth and progress are ready
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
        {isOfflineMode && (
          <Text style={{ 
            color: '#FFA500',
            fontSize: 14,
            textAlign: 'center',
            marginBottom: 10
          }}>
            Offline Mode - Limited functionality available
          </Text>
        )}
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
  const hasOnboardingChatProgress = onboardingProgress && onboardingProgress.currentStep === 17 && !onboardingProgress.completedAt;
  const shouldShowAuthFlow = (!isSignedIn && !isOfflineAuthenticated) || needsOnboarding || isSigningOut || hasOnboardingChatProgress;
  
  // Determine initial route: Offline mode gets special treatment
  let initialRouteName: string;
  if (shouldShowAuthFlow) {
    initialRouteName = 'Auth';
  } else if (isOfflineMode && isOfflineAuthenticated) {
    initialRouteName = 'Offline';
  } else {
    initialRouteName = 'App';
  }
  
  console.log('🧭 Navigation route determination:', {
    isSignedIn,
    needsOnboarding,
    isSigningOut,
    isOfflineMode,
    isOfflineAuthenticated,
    hasOnboardingChatProgress,
    progressStep: onboardingProgress?.currentStep,
    progressCompleted: onboardingProgress?.completedAt,
    shouldShowAuthFlow,
    initialRouteName
  });

  // Include auth state in navigation key to force reset when auth state changes
  const navigationKey = `nav-${initialRouteName.toLowerCase()}-${isSignedIn ? 'signed-in' : 'signed-out'}-${isOfflineMode ? 'offline' : 'online'}`;

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
      >
        <Stack.Navigator
          screenOptions={{ headerShown: false }}
          initialRouteName={initialRouteName}
        >
          <Stack.Screen name="Auth" component={AuthNavigator} />
          <Stack.Screen name="App" component={AppNavigator} />
          <Stack.Screen name="Offline" component={OfflineNavigator} />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
} 