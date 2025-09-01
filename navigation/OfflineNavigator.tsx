import { createDrawerNavigator } from '@react-navigation/drawer';
import React, { createContext, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors } from '@/constants/Colors';
import HomeContent from '@/screens/HomeContent';
import JournalDrawer from '@/components/JournalDrawer';

// Use the same context structure as HomeScreen to ensure compatibility
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

export type OfflineDrawerParamList = {
  HomeContent: undefined;
};

const Drawer = createDrawerNavigator<OfflineDrawerParamList>();

// Offline Journal Drawer - same as regular drawer
function OfflineJournalDrawer(props: any) {
  return <JournalDrawer {...props} />;
}

export default function OfflineNavigator() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
          drawerContent={(props) => <OfflineJournalDrawer {...props} />}
        >
          <Drawer.Screen name="HomeContent" component={HomeContent} />
        </Drawer.Navigator>
      </CurrentEntryContext.Provider>
    </GestureHandlerRootView>
  );
}


