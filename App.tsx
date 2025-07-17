import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import 'react-native-reanimated';

import { NetworkStatusModal } from './components/NetworkStatusModal';
import { useNetworkConnectivity } from './hooks/useNetworkConnectivity';
import Navigation from './navigation';
import { StatusBar, useColorScheme } from 'react-native';
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

  useEffect(() => {
    // Hide splash screen when authentication state is determined
    setTimeout(() => {
      SplashScreen.hideAsync();
    }, 2000);
  }, [isLoaded]);

  // Show offline modal if there's no internet connection
  const isOffline = networkState.isConnected === false || networkState.isInternetReachable === false;

  return (
    <>
      <Navigation />
      <NetworkStatusModal
        visible={isOffline}
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