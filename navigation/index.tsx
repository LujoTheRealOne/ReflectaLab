import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/hooks/useAuth';
import { View, Text, TouchableOpacity } from 'react-native';
import AppNavigator from './AppNavigator';
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
    retryAuthentication
  } = useAuth();

  // Keep showing loading until authentication state is FULLY determined
  // This prevents the flash of login screen for authenticated users
  if (!isAuthReady) {
    return null; // Keep splash screen visible
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

  // Determine navigation route
  const shouldShowAuthFlow = !isSignedIn || needsOnboarding;
  const initialRouteName = shouldShowAuthFlow ? 'Auth' : 'App';

  // Simplified navigation key to reduce resets
  const navigationKey = `nav-${shouldShowAuthFlow ? 'auth' : 'app'}`;

  console.log('🧭 Navigation state:', {
    isSignedIn,
    needsOnboarding,
    isAuthReady,
    isUserAccountReady,
    userAccountLoading,
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
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
} 