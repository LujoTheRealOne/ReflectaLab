import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import React, { useEffect, useState } from 'react';
import { useColorScheme, View, Keyboard } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';

// Import screens
import { Colors } from '@/constants/Colors';
import HomeScreen from '@/navigation/HomeScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import InfoScreen from '@/screens/InfoScreen';
import CoachingScreen from '@/screens/CoachingScreen';
import CompassStoryScreen from '@/screens/CompassStoryScreen';
import NotesScreen from '@/screens/NotesScreen';
import VoiceModeScreen from '@/screens/VoiceModeScreen';
import BreakoutSessionScreen from '@/screens/BreakoutSessionScreen';
import NotificationPermissionScreen from '@/screens/NotificationPermissionScreen';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';
import { useAuth } from '@/hooks/useAuth';
import SwipeableScreens from '@/components/SwipeableScreens';


// Define the app stack param list
export type AppStackParamList = {
  SwipeableScreens: undefined; // Main swipeable container
  Home: undefined;
  Info: undefined;
  JournalEdit: { entryId: string };
  NotificationPermission: undefined;
  CompassStory: { 
    fromOnboarding?: boolean;
    fromCoaching?: boolean;
    sessionId?: string;
    parsedCoachingData?: {
      components: Array<{ type: string; props: Record<string, string> }>;
      rawData: string;
    };
  };
  VoiceMode: {
    sessionId?: string;
  };
  BreakoutSession: {
    sessionId: string;
    title?: string;
    goal?: string;
  };
};

const Stack = createStackNavigator<AppStackParamList>();

export default function AppNavigator() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { progress } = useOnboardingProgress();
  const { needsOnboarding } = useAuth();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [currentRoute, setCurrentRoute] = useState('NotesScreen');
  
  // Safeguard: Log if user somehow got to main app with OnboardingChat progress
  // The progress should have been cleared by useAuth hook, but log for debugging
  useEffect(() => {
    if (progress && progress.currentStep === 17 && !progress.completedAt) {
      if (needsOnboarding) {
        console.log('🚨 SAFEGUARD: User in main app but has OnboardingChat progress and needs onboarding');
      } else {
        console.log('✅ SAFEGUARD: User has OnboardingChat progress but backend shows completed - should be cleared by useAuth');
      }
    }
  }, [progress, needsOnboarding]);

  // Handle keyboard visibility for global BottomNavBar
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);
  
  // Determine if navbar should be visible (hide on Home screen and SwipeableScreens since it has its own navbar)
  const shouldShowNavBar = currentRoute !== 'Home' && currentRoute !== 'SwipeableScreens' && !isKeyboardVisible;

  return (
    <View style={{ flex: 1 }}>
      {/* Stack Navigator with all screens */}
    <Stack.Navigator 
      initialRouteName="SwipeableScreens"
      screenOptions={{
        headerShown: false,
      }}
      screenListeners={{
        state: (e) => {
          // Track current route for navbar visibility
          const navigationState = e.data.state;
          if (navigationState) {
            const currentRouteName = navigationState.routes[navigationState.index]?.name;
            if (currentRouteName) {
              setCurrentRoute(currentRouteName);
            }
          }
        },
      }}
    >
      {/* Main Swipeable Screens Container */}
      <Stack.Screen
        name="SwipeableScreens"
        options={{
          gestureEnabled: false,
          transitionSpec: {
            open: { 
              animation: 'spring', 
              config: { 
                stiffness: 1000,
                damping: 500,
                mass: 3,
                overshootClamping: true,
                restDisplacementThreshold: 0.01,
                restSpeedThreshold: 0.01,
              } 
            },
            close: { 
              animation: 'spring', 
              config: { 
                stiffness: 1000,
                damping: 500,
                mass: 3,
                overshootClamping: true,
                restDisplacementThreshold: 0.01,
                restSpeedThreshold: 0.01,
              } 
            },
          },
          cardStyleInterpolator: ({ current, layouts }) => ({
            cardStyle: {
              transform: [
                {
                  translateX: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-layouts.screen.width, 0],
                    extrapolate: 'clamp',
                  }),
                },
              ],
              opacity: current.progress.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 0.8, 1],
                extrapolate: 'clamp',
              }),
            },
          }),
        }}
      >
        {() => <SwipeableScreens />}
      </Stack.Screen>

      {/* Journal Entry Screen */}
      <Stack.Screen
        name="Home"
        options={{
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          transitionSpec: {
            open: { 
              animation: 'spring', 
              config: { 
                stiffness: 1000,
                damping: 500,
                mass: 3,
                overshootClamping: true,
                restDisplacementThreshold: 0.01,
                restSpeedThreshold: 0.01,
              } 
            },
            close: { 
              animation: 'spring', 
              config: { 
                stiffness: 1000,
                damping: 500,
                mass: 3,
                overshootClamping: true,
                restDisplacementThreshold: 0.01,
                restSpeedThreshold: 0.01,
              } 
            },
          },
          cardStyleInterpolator: ({ current, layouts }) => {
            return {
              cardStyle: {
                transform: [
                  {
                    translateX: current.progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [layouts.screen.width, 0],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
                opacity: current.progress.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 0.8, 1],
                  extrapolate: 'clamp',
                }),
              },
            };
          },
        }}
      >
        {() => <HomeScreen />}
      </Stack.Screen>
      
      {/* Info and other secondary screens */}
      <Stack.Screen
        name="Info"
        options={{
          gestureEnabled: true,
          ...TransitionPresets.SlideFromRightIOS,
        }}
      >
        {() => <InfoScreen />}
      </Stack.Screen>
      
      <Stack.Screen
        name="CompassStory"
        options={{
          gestureEnabled: false,
        }}
      >
        {() => <CompassStoryScreen />}
      </Stack.Screen>
      
      <Stack.Screen
        name="VoiceMode"
        options={{
          gestureEnabled: false,
          presentation: 'modal',
          animationTypeForReplace: 'push',
        }}
      >
        {() => <VoiceModeScreen />}
      </Stack.Screen>
      
      <Stack.Screen
        name="BreakoutSession"
        options={{
          gestureEnabled: true,
          ...TransitionPresets.SlideFromRightIOS,
          headerShown: false,
        }}
      >
        {(props) => <BreakoutSessionScreen {...props} />}
      </Stack.Screen>
      
      <Stack.Screen
        name="NotificationPermission"
        options={{
          gestureEnabled: true,
          presentation: 'modal',
          animationTypeForReplace: 'push',
        }}
      >
        {() => <NotificationPermissionScreen />}
      </Stack.Screen>
    </Stack.Navigator>
    
    {/* Note: BottomNavBar is now inside SwipeableScreens component */}
    </View>
  );
} 