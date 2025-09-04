import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import React, { useEffect } from 'react';
import { useColorScheme } from 'react-native';

// Import screens
import { Colors } from '@/constants/Colors';
import HomeScreen from '@/navigation/HomeScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import InfoScreen from '@/screens/InfoScreen';
import HomeContent from '@/screens/HomeContent';
import CompassStoryScreen from '@/screens/CompassStoryScreen';
import NotesScreen from '@/screens/NotesScreen';
import CoachingScreen from '@/screens/CoachingScreen';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';
import ScreenWrapper from '@/components/ScreenWrapper';


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
  Notes: undefined;
};

const Stack = createStackNavigator<AppStackParamList>();

export default function AppNavigator() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { progress } = useOnboardingProgress();
  
  // Safeguard: If user somehow got to main app but still has OnboardingChat progress,
  // redirect them back to auth flow
  useEffect(() => {
    if (progress && progress.currentStep === 17 && !progress.completedAt) {
      console.log('🚨 SAFEGUARD: User in main app but has OnboardingChat progress - redirecting to auth');
      // This will be handled at a higher level if needed
    }
  }, [progress]);
  
  return (
    <Stack.Navigator 
      initialRouteName="Notes"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="Home"
        options={{
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
            };
          },
        }}
      >
        {(props) => (
          <ScreenWrapper showNavBar={false}>
            <HomeScreen {...props} />
          </ScreenWrapper>
        )}
      </Stack.Screen>
      
      <Stack.Screen
        name="Settings"
        options={{
          gestureEnabled: true,
          ...TransitionPresets.SlideFromRightIOS,
        }}
      >
        {(props) => (
          <ScreenWrapper>
            <SettingsScreen {...props} />
          </ScreenWrapper>
        )}
      </Stack.Screen>
      
      <Stack.Screen
        name="Info"
        options={{
          gestureEnabled: true,
          ...TransitionPresets.SlideFromRightIOS,
        }}
      >
        {(props) => (
          <ScreenWrapper>
            <InfoScreen {...props} />
          </ScreenWrapper>
        )}
      </Stack.Screen>
      
      <Stack.Screen
        name="CompassStory"
        options={{
          gestureEnabled: false,
        }}
      >
        {(props) => (
          <ScreenWrapper>
            <CompassStoryScreen {...props} />
          </ScreenWrapper>
        )}
      </Stack.Screen>
      
      <Stack.Screen
        name="Coaching"
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
      >
        {(props) => (
          <ScreenWrapper>
            <CoachingScreen {...props} />
          </ScreenWrapper>
        )}
      </Stack.Screen>
      
      <Stack.Screen
        name="Notes"
        options={{
          gestureEnabled: true,
          ...TransitionPresets.SlideFromRightIOS,
        }}
      >
        {(props) => (
          <ScreenWrapper>
            <NotesScreen {...props} />
          </ScreenWrapper>
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
} 