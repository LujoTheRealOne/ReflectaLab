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
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';
import BottomNavBar from '@/components/BottomNavBar';


// Define the app stack param list
export type AppStackParamList = {
  Home: undefined;
  SettingsScreen: undefined;
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
  CoachingScreen: undefined;
  NotesScreen: undefined;
};

const Stack = createStackNavigator<AppStackParamList>();

export default function AppNavigator() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { progress } = useOnboardingProgress();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [currentRoute, setCurrentRoute] = useState('NotesScreen');
  
  // Safeguard: If user somehow got to main app but still has OnboardingChat progress,
  // redirect them back to auth flow
  useEffect(() => {
    if (progress && progress.currentStep === 17 && !progress.completedAt) {
      console.log('🚨 SAFEGUARD: User in main app but has OnboardingChat progress - redirecting to auth');
      // This will be handled at a higher level if needed
    }
  }, [progress]);

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
  
  // Determine if navbar should be visible (hide on Home screen)
  const shouldShowNavBar = currentRoute !== 'Home' && !isKeyboardVisible;

  return (
    <View style={{ flex: 1 }}>
      {/* Stack Navigator with all screens */}
    <Stack.Navigator 
      initialRouteName="NotesScreen"
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
        {() => <HomeScreen />}
      </Stack.Screen>
      
      <Stack.Screen
        name="SettingsScreen"
        options={{
          gestureEnabled: false,
          transitionSpec: {
            open: { animation: 'timing', config: { duration: 0 } },
            close: { animation: 'timing', config: { duration: 0 } },
          },
          cardStyleInterpolator: ({ current }) => ({
            cardStyle: {
              opacity: current.progress,
            },
          }),
        }}
      >
        {() => <SettingsScreen />}
      </Stack.Screen>
      
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
        name="CoachingScreen"
        options={{
          gestureEnabled: false,
          transitionSpec: {
            open: { animation: 'timing', config: { duration: 0 } },
            close: { animation: 'timing', config: { duration: 0 } },
          },
          cardStyleInterpolator: ({ current }) => ({
            cardStyle: {
              opacity: current.progress,
            },
          }),
        }}
      >
        {() => <CoachingScreen />}
      </Stack.Screen>
      
      <Stack.Screen
        name="NotesScreen"
        options={{
          gestureEnabled: false,
          transitionSpec: {
            open: { animation: 'timing', config: { duration: 0 } },
            close: { animation: 'timing', config: { duration: 0 } },
          },
          cardStyleInterpolator: ({ current }) => ({
            cardStyle: {
              opacity: current.progress,
            },
          }),
        }}
      >
        {() => <NotesScreen />}
      </Stack.Screen>
    </Stack.Navigator>
    
    {/* Global BottomNavBar - persistent across all screens (except Home) */}
    <BottomNavBar isVisible={shouldShowNavBar} />
    </View>
  );
} 