import { createDrawerNavigator } from '@react-navigation/drawer';
import React, { createContext, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/Colors';
import HomeContent from '@/screens/HomeContent';
import JournalDrawer from '@/components/JournalDrawer';

export type HomeDrawerParamList = {
  HomeContent: undefined;
};

// Context for sharing current entry ID
interface CurrentEntryContextType {
  currentEntryId: string | null;
  setCurrentEntryId: (id: string | null) => void;
}

const CurrentEntryContext = createContext<CurrentEntryContextType | undefined>(undefined);

export const useCurrentEntry = () => {
  const context = useContext(CurrentEntryContext);
  if (!context) {
    throw new Error('useCurrentEntry must be used within a CurrentEntryProvider');
  }
  return context;
};

const Drawer = createDrawerNavigator<HomeDrawerParamList>();

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);

  return (
    <CurrentEntryContext.Provider value={{ currentEntryId, setCurrentEntryId }}>
      <Drawer.Navigator
        screenOptions={{
          headerShown: false,
          drawerType: 'back',
          drawerStyle: {
            width: '80%',
            backgroundColor: colors.background,
          },
          overlayColor: 'rgba(0, 0, 0, 0.3)',
          swipeEdgeWidth: 50,
        }}
        drawerContent={(props) => <JournalDrawer {...props} />}
      >
        <Drawer.Screen
          name="HomeContent"
          component={HomeContent}
          options={{ title: 'Home' }}
        />
      </Drawer.Navigator>
    </CurrentEntryContext.Provider>
  );
} 