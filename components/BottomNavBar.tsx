import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, NavigationProp, CommonActions } from '@react-navigation/native';
import { Colors } from '@/constants/Colors';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { useAuth } from '@/hooks/useAuth';
import * as Haptics from 'expo-haptics';

// Import the correct navigation types
import type { AppStackParamList } from '@/navigation/AppNavigator';

// Tab configuration
export type TabConfig = {
  id: string;
  iconName: string;
  routeName: keyof AppStackParamList;
  requiresPro?: boolean;
};

// Component props
interface BottomNavBarProps {
  isVisible?: boolean;
  tabs?: TabConfig[];
}

// Default tab configuration
const DEFAULT_TABS: TabConfig[] = [
  {
    id: 'notes',
    iconName: 'note.text',
    routeName: 'NotesScreen',
  },
  {
    id: 'chat',
    iconName: 'message.fill',
    routeName: 'CoachingScreen', // Will be handled specially in handleTabPress
    requiresPro: true, // Pro requirement for coaching
  },
  {
    id: 'profile',
    iconName: 'person.crop.circle.fill',
    routeName: 'SettingsScreen',
  },
];

export default function BottomNavBar({ 
  isVisible = true, 
  tabs = DEFAULT_TABS 
}: BottomNavBarProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const route = useRoute();
  
  // Auth and subscription hooks
  const { firebaseUser } = useAuth();
  const { isPro, presentPaywallIfNeeded, currentOffering, initialized } = useRevenueCat(firebaseUser?.uid);

  // Helper to get the deepest active route name (handles nested navigators)
  const getDeepActiveRouteName = (): string => {
    try {
      const state: any = navigation.getState();
      let currentState: any = state;
      // If we're at root (Auth/App), drill into 'App' state
      while (currentState && currentState.routes && currentState.index != null) {
        const currentRoute = currentState.routes[currentState.index];
        if (currentRoute?.state) {
          currentState = currentRoute.state;
          continue;
        }
        return currentRoute?.name || route.name;
      }
      return route.name;
    } catch {
      return route.name;
    }
  };

  // Memoize active tab calculation for performance
  const activeTabId = useMemo(() => {
    const routeName = getDeepActiveRouteName();
    
    // Map route names to tab IDs (these are AppNavigator route names)
    const routeToTabMap: Record<string, string> = {
      'Home': 'chat',          // Home navigator (includes HomeContent)
      'NotesScreen': 'notes',      // Notes screen
      'CoachingScreen': 'chat',    // Coaching screen  
      'SettingsScreen': 'profile', // Settings screen
      'CompassStory': 'chat',   // Compass story (part of coaching flow)
      'Info': 'profile',       // Info screen (settings related)
    };

    return routeToTabMap[routeName] || 'notes'; // Default to notes since it's the initial screen
  }, [route.name, navigation]);

  // Handle tab press
  const handleTabPress = async (tab: TabConfig) => {
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Debug logging removed for performance

    // Special handling for chat button - go to coaching directly in nested App
    if (tab.id === 'chat') {
      // Check Pro requirement for coaching
      if (!initialized) return; // Wait for RevenueCat init
      
      if (!isPro) {
        const unlocked = await presentPaywallIfNeeded('reflecta_pro', currentOffering || undefined);
        if (!unlocked) return; // Don't navigate if paywall was cancelled
      }

      // Navigate directly to Coaching screen (nested under App)
      navigation.dispatch(
        CommonActions.navigate({
          // Root has routes: Auth, App. Target App, then nested screen
          name: 'App' as any,
          params: { screen: 'CoachingScreen' },
        })
      );
      return;
    }

    // Check Pro requirement for other tabs if needed
    if (tab.requiresPro && !isPro) {
      if (!initialized) return; // Wait for RevenueCat init
      
      const unlocked = await presentPaywallIfNeeded('reflecta_pro', currentOffering || undefined);
      if (!unlocked) return; // Don't navigate if paywall was cancelled
    }

    // For Notes navigation, use instant navigate like other tabs
    if (tab.routeName === 'NotesScreen') {
      navigation.dispatch(
        CommonActions.navigate({
          name: 'App' as any,
          params: { screen: 'NotesScreen' },
        })
      );
      return;
    }

    // Navigate to the tab's route in nested App navigator
    navigation.dispatch(
      CommonActions.navigate({
        name: 'App' as any,
        params: { screen: tab.routeName },
      })
    );
  };

  // Get icon color based on active state
  const getIconColor = (tabId: string): string => {
    const isActive = activeTabId === tabId;
    
    if (isActive) {
      // Active state - use full text color for better visibility
      return colors.text;
    } else {
      // Inactive state - use reduced opacity for clear visual hierarchy
      return colorScheme === 'dark' 
        ? 'rgba(255, 255, 255, 0.25)' // Slightly more visible in dark mode
        : 'rgba(0, 0, 0, 0.25)';       // Slightly more visible in light mode
    }
  };

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  return (
    <View style={[
      styles.container,
      {
        paddingBottom: Math.max(insets.bottom, 18),
        backgroundColor: colors.background,
        borderTopColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(12, 10, 9, 0.10)',
      }
    ]}>
      <View style={styles.tabsContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={styles.tabButton}
            onPress={() => handleTabPress(tab)}
            activeOpacity={0.6}
          >
            <IconSymbol
              name={tab.iconName as any}
              size={24}
              color={getIconColor(tab.id)}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 18,
    paddingLeft: 108,
    paddingRight: 108,
    overflow: 'hidden',
    borderTopWidth: 0.5,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 10,
  },
  tabsContainer: {
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 0,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    flex: 1,
  },
});
