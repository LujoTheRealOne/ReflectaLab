import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';

// Import screens
import { useAuth } from '@/hooks/useAuth';
import GetStartedScreen from '@/screens/auth/GetStartedScreen';
import LoginScreen from '@/screens/auth/LoginScreen';
import OnboardingScreen from '@/screens/auth/Onboarding';
import OnboardingChatScreen from '@/screens/auth/OnboardingChatScreen';
import CompassStoryScreen from '@/screens/CompassStoryScreen';

// Define the auth stack param list
export type AuthStackParamList = {
  Login: undefined;
  GetStarted: undefined;
  Onboarding: undefined;
  OnboardingChat: {
    name: string;
    selectedRoles: string[];
    selectedSelfReflection: string[];
    clarityLevel: number;
    stressLevel: number;
    coachingStylePosition: { x: number; y: number };
    timeDuration: number;
  };
  CompassStory: { 
    fromOnboarding?: boolean;
    fromCoaching?: boolean;
    parsedCoachingData?: {
      components: Array<{ type: string; props: Record<string, string> }>;
      rawData: string;
    };
  };
};

const Stack = createStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  const { shouldShowGetStarted } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

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
      <Stack.Screen
        name="OnboardingChat"
        component={OnboardingChatScreen}
        options={{ 
          title: 'Chat', 
          gestureEnabled: false,
          transitionSpec: {
            open: {
              animation: 'timing',
              config: {
                duration: 500,
              },
            },
            close: {
              animation: 'timing',
              config: {
                duration: 500,
              },
            },
          },
          cardStyleInterpolator: ({ current }) => ({
            cardStyle: {
              opacity: current.progress,
              backgroundColor: colors.background,
            },
          }),
        }}
      />
      <Stack.Screen
        name="CompassStory"
        component={CompassStoryScreen}
        options={{
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
} 