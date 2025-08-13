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
  const { isSignedIn, needsOnboarding } = useAuth();

  return (
    <View style={{
      flex: 1,
      backgroundColor: colorScheme === 'dark' ? Colors.dark.background : Colors.light.background
    }}>
      <NavigationContainer
        theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}
      >
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {isSignedIn ? (
            needsOnboarding ? (
              <Stack.Screen name="Onboarding" component={AuthNavigator} initialParams={{ screen: 'Onboarding' }} />
            ) : (
              <Stack.Screen name="App" component={AppNavigator} />
            )
          ) : (
            <Stack.Screen name="Auth" component={AuthNavigator} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
} 