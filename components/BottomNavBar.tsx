import React from 'react';
import { View, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, NavigationProp } from '@react-navigation/native';
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
    routeName: 'Notes',
  },
  {
    id: 'chat',
    iconName: 'message.fill',
    routeName: 'Coaching', // Will be handled specially in handleTabPress
    requiresPro: true, // Pro requirement for coaching
  },
  {
    id: 'profile',
    iconName: 'person.crop.circle.fill',
    routeName: 'Settings',
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

  // Get current active tab based on route name
  const getActiveTabId = (): string => {
    const routeName = route.name;
    
    // Debug: Log current route name
    console.log('🧭 BottomNavBar - Current route:', routeName);
    
    // Map route names to tab IDs (these are AppNavigator route names)
    const routeToTabMap: Record<string, string> = {
      'Home': 'chat',        // Home navigator (includes HomeContent)
      'Notes': 'notes',      // Notes screen
      'Coaching': 'chat',    // Coaching screen  
      'Settings': 'profile', // Settings screen
      'CompassStory': 'chat', // Compass story (part of coaching flow)
      'Info': 'profile',     // Info screen (settings related)
    };

    const activeTabId = routeToTabMap[routeName] || 'notes'; // Default to notes since it's the initial screen
    console.log('🧭 BottomNavBar - Active tab:', activeTabId);
    
    return activeTabId;
  };

  // Handle tab press
  const handleTabPress = async (tab: TabConfig) => {
    console.log(`🚀 BottomNavBar - Tab pressed: ${tab.id} -> ${tab.routeName}`);
    
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Special handling for chat button - go to coaching directly
    if (tab.id === 'chat') {
      // Check Pro requirement for coaching
      if (!initialized) return; // Wait for RevenueCat init
      
      if (!isPro) {
        const unlocked = await presentPaywallIfNeeded('reflecta_pro', currentOffering || undefined);
        console.log(`🎤 Coaching access Pro check:`, unlocked ? 'unlocked' : 'cancelled');
        if (!unlocked) return; // Don't navigate if paywall was cancelled
      }

      // Navigate directly to Coaching screen
      console.log(`🧭 BottomNavBar - Navigating to Coaching`);
      (navigation as any).navigate('Coaching');
      return;
    }

    // Check Pro requirement for other tabs if needed
    if (tab.requiresPro && !isPro) {
      if (!initialized) return; // Wait for RevenueCat init
      
      const unlocked = await presentPaywallIfNeeded('reflecta_pro', currentOffering || undefined);
      console.log(`🎤 ${tab.id} access Pro check:`, unlocked ? 'unlocked' : 'cancelled');
      if (!unlocked) return; // Don't navigate if paywall was cancelled
    }

    // Navigate to the tab's route
    console.log(`🧭 BottomNavBar - Navigating to: ${tab.routeName}`);
    (navigation as any).navigate(tab.routeName);
  };

  // Get icon color based on active state
  const getIconColor = (tabId: string): string => {
    const isActive = getActiveTabId() === tabId;
    
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
