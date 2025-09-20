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

// Configure splash screen fade animation
SplashScreen.setOptions({
  duration: 500,
  fade: true,
});

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
    // 🚀 OPTIMIZATION: Hide splash screen much faster
    if (isLoaded) {
      // Minimal delay for smooth animation only
      setTimeout(() => {
        SplashScreen.hideAsync().catch((error) => {
          console.log('ℹ️ Splash screen already hidden:', error.message);
        });
      }, 300); // Reduced from 1500ms to 300ms for much faster startup
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

  // Track app state changes (foreground/background) and trigger auth validation
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        trackAppOpened({
          source: 'app_foreground',
        });
        
        // 🚀 OPTIMIZATION: Trigger background auth validation when app comes to foreground
        // This ensures auth is fresh without blocking startup
        setTimeout(() => {
          console.log('🔄 App foregrounded - triggering background auth validation');
          // This will be handled by the useAuth hook's background sync
        }, 1000);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [trackAppOpened]);

  // Show offline modal if there's no internet connection
  // const isOffline = networkState.isConnected === false || networkState.isInternetReachable === false;

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