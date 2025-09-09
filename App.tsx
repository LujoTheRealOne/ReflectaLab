import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import 'react-native-reanimated';
import { PostHogProvider } from 'posthog-react-native'

import { NetworkStatusModal } from './components/NetworkStatusModal';
import { BiometricProtectionOverlay } from './components/BiometricProtectionOverlay';
import { useNetworkConnectivity } from './hooks/useNetworkConnectivity';
import { useAnalytics } from './hooks/useAnalytics';
import Navigation from './navigation';
import { StatusBar, useColorScheme, AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error(
    'Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env'
  );
}

function AppContent() {
  const colorScheme = useColorScheme();
  const { isLoaded } = useAuth();
  const networkState = useNetworkConnectivity();
  const { trackAppOpened } = useAnalytics();

  useEffect(() => {
    // Hide splash screen when authentication state is determined
    setTimeout(() => {
      SplashScreen.hideAsync();
    }, 2000);
  }, [isLoaded]);

  // Track app opened when the app loads
  useEffect(() => {
    if (isLoaded) {
      trackAppOpened({
        source: 'app_launch',
      });
    }
  }, [isLoaded, trackAppOpened]);

  // Track app state changes (foreground/background)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        trackAppOpened({
          source: 'app_foreground',
        });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [trackAppOpened]);

  // Show offline modal if there's no internet connection
  const isOffline = networkState.isConnected === false || networkState.isInternetReachable === false;

  return (
    <>
      <PostHogProvider 
        apiKey={process.env.EXPO_PUBLIC_POSTHOG_KEY} 
        options={{ 
          host: process.env.EXPO_PUBLIC_POSTHOG_HOST,
          disabled: __DEV__ ? false : false, // Set to true if you want to disable in development
        }}
        autocapture={{
          captureScreens: false // Disable automatic screen tracking to avoid navigation errors
        }}
      >
        <Navigation />
      </PostHogProvider>
      <NetworkStatusModal
        visible={isOffline}
      />
      <BiometricProtectionOverlay />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
        <AppContent />
        <StatusBar />
      </ClerkProvider>
    </SafeAreaProvider>
  );
} 