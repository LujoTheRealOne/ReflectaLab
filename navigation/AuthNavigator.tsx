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
  const { shouldShowGetStarted, needsOnboarding, isSignedIn, refreshUserAccount } = useAuth();
  const { shouldResumeOnboarding, canNavigateToChat, progress, isLoading: progressLoading } = useOnboardingProgress();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  
  // Don't block on progress loading - use cached data or defaults
  // This allows faster screen transitions while data loads in background
  if (progressLoading) {
    console.log('📱 AuthNavigator proceeding with cached/default progress data');
    // Continue with navigation, don't block
  }

  // Removed redundant mismatch detection - now handled in useAuth hook

  // Determine initial route based on auth state and onboarding progress
  const getInitialRouteName = () => {
    console.log('🔄 AuthNavigator getInitialRouteName - Starting route determination...');
    
    if (!isSignedIn) {
      console.log('📱 Not signed in, showing auth flow');
      return shouldShowGetStarted ? 'GetStarted' : 'Login';
    }
    
    // PRIORITY 1: If user has saved progress at OnboardingChat (step 17) AND still needs onboarding, resume there
    if (progress && progress.currentStep === 17 && !progress.completedAt && needsOnboarding === true) {
      console.log('🎯 PRIORITY: Resuming OnboardingChat from step 17');
      return 'OnboardingChat';
    }
    
    // PRIORITY 2: If user needs onboarding and has saved progress, resume onboarding
    if (needsOnboarding === true && shouldResumeOnboarding() && progress) {
      console.log('🔄 Resuming onboarding from saved progress');
      if (canNavigateToChat()) {
        console.log('📱 Can navigate to chat, going to OnboardingChat');
        return 'OnboardingChat';
      } else {
        console.log('📱 Cannot navigate to chat yet, going to Onboarding');
        return 'Onboarding';
      }
    }
    
    // PRIORITY 3: If user needs onboarding but no saved progress, start fresh
    if (needsOnboarding === true) {
      console.log('📱 Needs onboarding, no saved progress - starting fresh');
      return 'Onboarding';
    }
    
    // PRIORITY 4: If user doesn't need onboarding, they shouldn't be in AuthNavigator
    // This is a fallback case - user should have been routed to main app
    if (needsOnboarding === false) {
      console.log('🚨 ERROR: User completed onboarding but still in AuthNavigator - this should not happen');
      console.log('📱 Fallback: Showing Login to prevent crash');
      return 'Login';
    }
    
    // PRIORITY 5: If needsOnboarding is null (still loading), show login as safe fallback
    if (needsOnboarding === null) {
      console.log('⏳ needsOnboarding still loading - showing Login as safe fallback');
      return 'Login';
    }
    
    console.log('📱 Fallback to Login');
    return 'Login'; // Fallback
  };

  const initialRouteName = getInitialRouteName();
  
  console.log('📱 AuthNavigator debug:', {
    isSignedIn,
    needsOnboarding,
    shouldResumeOnboarding: shouldResumeOnboarding(),
    canNavigateToChat: canNavigateToChat(),
    progressCurrentStep: progress?.currentStep,
    progressCompletedAt: progress?.completedAt,
    progressExists: !!progress,
    initialRouteName,
    fullProgress: progress
  });

  return (
    <Stack.Navigator 
      key={`auth-${isSignedIn ? 'signed-in' : 'signed-out'}-${needsOnboarding ? 'onboarding' : 'complete'}`}
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