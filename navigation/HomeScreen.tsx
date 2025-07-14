import { createDrawerNavigator } from '@react-navigation/drawer';
import React from 'react';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/Colors';
import HomeContent from '@/screens/HomeContent';
// import JournalDrawer from '@/components/JournalDrawer';

export type HomeDrawerParamList = {
  HomeContent: undefined;
};

const Drawer = createDrawerNavigator<HomeDrawerParamList>();

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: false,
        drawerType: 'back',
        drawerStyle: {
          width: '80%',
          backgroundColor: colors.background,
        },
        overlayColor: 'rgba(0, 0, 0, 0.3)',
      }}
      // drawerContent={(props) => <JournalDrawer {...props} />}
    >
      <Drawer.Screen
        name="HomeContent"
        component={HomeContent}
        options={{ title: 'Home' }}
      />
    </Drawer.Navigator>
  );
} 