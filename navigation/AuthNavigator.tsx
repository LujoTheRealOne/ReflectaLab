import { createStackNavigator } from '@react-navigation/stack';
import React from 'react';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/Colors';

// Import screens
import { useAuth } from '@/hooks/useAuth';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';
import GetStartedScreen from '@/screens/auth/GetStartedScreen';
import LoginScreen from '@/screens/auth/LoginScreen';
import OnboardingScreen from '@/screens/auth/Onboarding';
import OnboardingChatScreen from '@/screens/auth/OnboardingChatScreen';
import CompassStoryScreen from '@/screens/CompassStoryScreen';

// Define the auth stack param list
export type AuthStackParamList = {
  Login: undefined;
  GetStarted: undefined;
  Onboarding: { startStep?: number } | undefined;
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
    sessionId?: string;
    parsedCoachingData?: {
      components: Array<{ type: string; props: Record<string, string> }>;
      rawData: string;
    };
  };
};

const Stack = createStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  const { shouldShowGetStarted, needsOnboarding, isSignedIn } = useAuth();
  const { shouldResumeOnboarding, canNavigateToChat, progress } = useOnboardingProgress();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Determine initial route based on auth state and onboarding progress
  const getInitialRouteName = () => {
    if (!isSignedIn) {
      return shouldShowGetStarted ? 'GetStarted' : 'Login';
    }
    
    if (needsOnboarding) {
      // If user has completed all onboarding steps and can navigate to chat
      if (shouldResumeOnboarding() && canNavigateToChat() && progress) {
        return 'OnboardingChat';
      }
      // Always start with Onboarding screen - it will resume from saved step
      return 'Onboarding';
    }
    
    return 'Login'; // Fallback
  };

  const initialRouteName = getInitialRouteName();
  
  console.log('📱 AuthNavigator debug:', {
    isSignedIn,
    needsOnboarding,
    shouldResumeOnboarding: shouldResumeOnboarding(),
    canNavigateToChat: canNavigateToChat(),
    progressCurrentStep: progress?.currentStep,
    initialRouteName
  });

  return (
    <Stack.Navigator 
      key={`auth-${isSignedIn ? 'in' : 'out'}-${needsOnboarding ? 'needs' : 'done'}`}
      screenOptions={{ headerShown: false }}
      initialRouteName={initialRouteName}
    >
      <Stack.Screen
        name="GetStarted"
        component={GetStartedScreen}
        options={{ title: 'Get Started' }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ title: 'Login' }}
      />
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        initialParams={progress?.currentStep ? { startStep: progress.currentStep } : undefined}
        options={{ title: 'Onboarding', gestureEnabled: false }}
      />
      <Stack.Screen
        name="OnboardingChat"
        component={OnboardingChatScreen}
        initialParams={
          shouldResumeOnboarding() && progress ? {
            name: progress.name,
            selectedRoles: progress.selectedRoles,
            selectedSelfReflection: progress.selectedSelfReflection,
            clarityLevel: progress.clarityLevel,
            stressLevel: progress.stressLevel,
            coachingStylePosition: progress.coachingStylePosition,
            timeDuration: progress.timeDuration,
          } : undefined
        }
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