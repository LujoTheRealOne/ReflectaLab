import React, { useMemo, useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, useColorScheme, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useNavigationState, NavigationProp } from '@react-navigation/native';
import { navigateToAppScreen } from '@/navigation/RootNavigation';
import { Colors } from '@/constants/Colors';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { useAuth } from '@/hooks/useAuth';
import * as Haptics from 'expo-haptics';

// Import the correct navigation types
import type { AppStackParamList } from '@/navigation/AppNavigator';

// Extended type to include swipeable screen names
type SwipeableScreenNames = 'NotesScreen' | 'CoachingScreen' | 'SettingsScreen';

// Tab configuration
export type TabConfig = {
  id: string;
  iconName: string;
  routeName: keyof AppStackParamList | SwipeableScreenNames;
  requiresPro?: boolean;
};

// Component props
interface BottomNavBarProps {
  isVisible?: boolean;
  tabs?: TabConfig[];
  onNavigation?: (screenName: string) => void; // For swipe system integration
  activeTab?: string; // For external active tab control
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
  tabs = DEFAULT_TABS,
  onNavigation,
  activeTab: externalActiveTab
}: BottomNavBarProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const route = useRoute();
  
  // Auth and subscription hooks
  const { firebaseUser } = useAuth();
  const { isPro, presentPaywallIfNeeded, currentOffering, initialized } = useRevenueCat(firebaseUser?.uid);

  // Subscribe to navigation state to react instantly on transitions
  const navState = useNavigationState((s) => s);

  // Helper to get the deepest active route name (handles nested navigators)
  const getDeepActiveRouteName = (state: any): string => {
    try {
      let currentState: any = state;
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
    // If external active tab is provided (for swipe system), use it
    if (externalActiveTab) {
      return externalActiveTab;
    }

    // Otherwise, use navigation state detection
    const routeName = getDeepActiveRouteName(navState);
    
    // Map route names to tab IDs (these are AppNavigator route names)
    const routeToTabMap: Record<string, string> = {
      'SwipeableScreens': 'notes',
      'NotesList': 'notes',
      'NewNote': 'notes',
      'NotesScreen': 'notes',
      'CoachingScreen': 'chat',
      'SettingsScreen': 'profile',
      'CompassStory': 'chat',
      'Info': 'profile',
    };

    const tabId = routeToTabMap[routeName] || 'notes';
    
    // Debug: Log active tab changes for development (temporarily disabled for performance)
    // console.log(`🎯 NavBar: Route "${routeName}" → Tab "${tabId}"`);
    
    return tabId;
  }, [navState, externalActiveTab]);

  // Handle tab press (optimized for instant navigation & nested stacks)
  const handleTabPress = useCallback(async (tab: TabConfig) => {
    // Prevent multiple taps on the already active tab
    if (activeTabId === tab.id) {
      return;
    }

    // Haptic feedback (non-blocking)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // Resolve target screen name
    const targetScreen = tab.routeName;

    // Pro gate for coaching tab
    if (tab.id === 'chat') {
      if (!initialized) return;
      if (!isPro) {
        const unlocked = await presentPaywallIfNeeded('reflecta_pro', currentOffering || undefined);
        if (!unlocked) return;
      }
    }

    // If we're already on the target route, do nothing
    const currentDeepRoute = getDeepActiveRouteName(navState);
    if (currentDeepRoute === targetScreen) {
      return;
    }

    // If onNavigation callback is provided (swipe system), use it for swipeable screens
    if (onNavigation) {
      onNavigation(targetScreen as string);
    } else {
      // Navigate via root navigator since BottomNavBar is outside App stack
      // We need to target the App stack specifically
      navigateToAppScreen(targetScreen as string);
    }
  }, [activeTabId, initialized, isPro, navState, navigation, presentPaywallIfNeeded, currentOffering]);

  // Get icon color based on active state
  const getIconColor = (tabId: string): string => {
    const isActive = activeTabId === tabId;
    
    if (isActive) {
      // Active state - use strong color for clear indication
      return colorScheme === 'dark' ? '#FFFFFF' : '#000000';
    } else {
      // Inactive state - use muted color for better contrast
      return colorScheme === 'dark' 
        ? 'rgba(255, 255, 255, 0.4)' // More visible in dark mode
        : 'rgba(0, 0, 0, 0.4)';       // More visible in light mode
    }
  };

  // Get icon scale based on active state (subtle animation)
  const getIconScale = (tabId: string): number => {
    const isActive = activeTabId === tabId;
    return isActive ? 1.1 : 1.0; // Slightly larger when active
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
            disabled={activeTabId === tab.id} // Prevent tapping current tab
          >
            <View style={{ transform: [{ scale: getIconScale(tab.id) }] }}>
              <IconSymbol
                name={tab.iconName as any}
                size={26}
                color={getIconColor(tab.id)}
              />
            </View>
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
