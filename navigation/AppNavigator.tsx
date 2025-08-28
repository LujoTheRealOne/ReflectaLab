import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import React, { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { CommonActions, useNavigation } from '@react-navigation/native';

// Import screens
import { Colors } from '@/constants/Colors';
import HomeScreen from '@/navigation/HomeScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import InfoScreen from '@/screens/InfoScreen';
import HomeContent from '@/screens/HomeContent';
import CompassStoryScreen from '@/screens/CompassStoryScreen';
import CoachingScreen from '@/screens/CoachingScreen';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';


// Define the app stack param list
export type AppStackParamList = {
  Home: undefined;
  Settings: undefined;
  Info: undefined;
  JournalEdit: { entryId: string };
  CompassStory: { 
    fromOnboarding?: boolean;
    fromCoaching?: boolean;
    sessionId?: string;
    parsedCoachingData?: {
      components: Array<{ type: string; props: Record<string, string> }>;
      rawData: string;
    };
  };
  Coaching: undefined;
};

const Stack = createStackNavigator<AppStackParamList>();

export default function AppNavigator() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const navigation = useNavigation();
  const { progress } = useOnboardingProgress();
  
  // Safeguard: If user somehow got to main app but still has OnboardingChat progress,
  // redirect them back to auth flow
  useEffect(() => {
    if (progress && progress.currentStep === 17 && !progress.completedAt) {
      console.log('🚨 SAFEGUARD: User in main app but has OnboardingChat progress - redirecting to auth');
      // Reset navigation to auth flow
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Auth' as never }],
        })
      );
    }
  }, [progress, navigation]);
  
  return (
    <Stack.Navigator 
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
      />
      <Stack.Screen
        name="Info"
        component={InfoScreen}
      />
      <Stack.Screen
        name="CompassStory"
        component={CompassStoryScreen}
        options={{
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="Coaching"
        component={CoachingScreen}
        options={{
          gestureEnabled: true,
          ...TransitionPresets.SlideFromRightIOS,
          cardStyleInterpolator: ({ current, layouts }) => {
            return {
              cardStyle: {
                transform: [
                  {
                    translateX: current.progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [layouts.screen.width, 0],
                    }),
                  },
                ],
              },
              overlayStyle: {
                opacity: 0, // Remove overlay to show both screens side by side
              },
            };
          },
        }}
      />
    </Stack.Navigator>
  );
} 