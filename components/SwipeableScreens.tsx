import React, { useRef, useState, useCallback } from 'react';
import { View, StyleSheet, useColorScheme, FlatList, Dimensions, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import NotesNavigator from '@/navigation/NotesNavigator';
import CoachingScreen from '@/screens/CoachingScreen';
import SettingsScreen from '@/screens/SettingsScreen';
import BottomNavBar from '@/components/BottomNavBar';
import { Colors } from '@/constants/Colors';

const screenWidth = Dimensions.get('window').width;

// Screen data for FlatList
const screens = [
  { id: '0', component: NotesNavigator, key: 'notes' },
  { id: '1', component: CoachingScreen, key: 'coaching' },
  { id: '2', component: SettingsScreen, key: 'settings' },
];

export default function SwipeableScreens() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [currentPage, setCurrentPage] = useState(1); // 0: Notes, 1: Coaching, 2: Settings

  // Handle page change from swipe
  const onMomentumScrollEnd = useCallback((event: any) => {
    const page = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    setCurrentPage(page);
    // Close keyboard when screen changes
    Keyboard.dismiss();
  }, []);

  // Handle navigation from bottom navbar
  const handleNavigation = useCallback((screenName: string) => {
    let targetPage = 0;
    switch (screenName) {
      case 'NotesScreen':
        targetPage = 0;
        break;
      case 'CoachingScreen':
        targetPage = 1;
        break;
      case 'SettingsScreen':
        targetPage = 2;
        break;
      default:
        return;
    }
    
    flatListRef.current?.scrollToIndex({ index: targetPage, animated: true });
    setCurrentPage(targetPage);
    // Close keyboard when screen changes via navbar
    Keyboard.dismiss();
  }, []);

  // Get current active tab for navbar
  const getActiveTab = () => {
    switch (currentPage) {
      case 0: return 'notes';
      case 1: return 'chat';
      case 2: return 'profile';
      default: return 'notes';
    }
  };

  // Render each screen
  const renderScreen = useCallback(({ item }: { item: typeof screens[0] }) => {
    const ScreenComponent = item.component;
    return (
      <View style={[styles.pageContainer, { width: screenWidth }]}>
        <ScreenComponent />
      </View>
    );
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        ref={flatListRef}
        data={screens}
        renderItem={renderScreen}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        getItemLayout={(data, index) => ({
          length: screenWidth,
          offset: screenWidth * index,
          index,
        })}
        initialScrollIndex={1}
        removeClippedSubviews={false}
        keyboardShouldPersistTaps="always" // Always pass through touch events
        keyboardDismissMode="interactive" // Interactive keyboard dismiss
        style={styles.flatList}
      />

      {/* Bottom Navigation Bar */}
      <BottomNavBar 
        isVisible={true} 
        onNavigation={handleNavigation}
        activeTab={getActiveTab()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flatList: {
    flex: 1,
  },
  pageContainer: {
    flex: 1,
  },
});
