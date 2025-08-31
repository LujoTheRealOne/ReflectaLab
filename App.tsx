import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import 'react-native-reanimated';
import { PostHogProvider } from 'posthog-react-native'

import { NetworkStatusModal } from './components/NetworkStatusModal';
import { useNetworkConnectivity } from './hooks/useNetworkConnectivity';
import { useAnalytics } from './hooks/useAnalytics';
import { useAuth as useAppAuth } from './hooks/useAuth';
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
  const { isOfflineMode, isOfflineAuthenticated } = useAppAuth();

  useEffect(() => {
    // Only hide splash screen when Clerk auth is fully loaded
    if (isLoaded) {
      // Small delay to ensure smooth transition
      setTimeout(() => {
        SplashScreen.hideAsync();
      }, 500);
    }
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

  // Show offline modal only if there's no internet connection AND no valid offline authentication
  const isOffline = networkState.isConnected === false || networkState.isInternetReachable === false;
  const shouldShowOfflineModal = isOffline && !isOfflineAuthenticated && !isOfflineMode;

  // Debug log for offline state
  useEffect(() => {
    console.log('🔍 App offline state debug:', {
      isOffline,
      isOfflineAuthenticated,
      isOfflineMode,
      shouldShowOfflineModal,
      networkConnected: networkState.isConnected,
      internetReachable: networkState.isInternetReachable
    });
  }, [isOffline, isOfflineAuthenticated, isOfflineMode, shouldShowOfflineModal, networkState]);

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
        visible={shouldShowOfflineModal}
      />
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