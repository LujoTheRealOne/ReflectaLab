import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';

// Import screens
import { useAuth } from '@/hooks/useAuth';
import GetStartedScreen from '@/screens/auth/GetStartedScreen';
import LoginScreen from '@/screens/auth/LoginScreen';
import OnboardingScreen from '@/screens/auth/Onboarding';

// Define the auth stack param list
export type AuthStackParamList = {
  Login: undefined;
  GetStarted: undefined;
  Onboarding: undefined;
};

const Stack = createStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  const { shouldShowGetStarted } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {shouldShowGetStarted ? (
        <Stack.Screen
          name="GetStarted"
          component={GetStartedScreen}
          options={{ title: 'Get Started' }}
        />
      ) : (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ title: 'Login' }}
        />
      )}
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{ title: 'Onboarding', gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
} 