import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/hooks/useAuth';
import { View } from 'react-native';
import AppNavigator from './AppNavigator';
import AuthNavigator from './AuthNavigator';

// Define the root stack navigator type
const Stack = createNativeStackNavigator();

export default function Navigation() {
  const colorScheme = useColorScheme();
  const { isSignedIn, needsOnboarding, isFirebaseReady, userAccount } = useAuth();

  // Wait for auth to be ready before determining the route
  // For signed in users, wait for user account to be loaded to determine onboarding state
  const isAuthReady = isFirebaseReady && (!isSignedIn || userAccount !== null);
  
  if (!isAuthReady) {
    // Return loading view or null while waiting
    return (
      <View style={{
        flex: 1,
        backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background
      }} />
    );
  }

  const initialRouteName = (!isSignedIn || needsOnboarding) ? 'Auth' : 'App';

  return (
    <View style={{
      flex: 1,
      backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background
    }}>
      <NavigationContainer
        key={`nav-${isSignedIn ? 'signed-in' : 'signed-out'}`}
        theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
      >
        <Stack.Navigator
          key={`${isSignedIn ? 'in' : 'out'}:${needsOnboarding ? 'needs' : 'done'}`}
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