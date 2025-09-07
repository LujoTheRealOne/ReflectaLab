import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import NotesScreen from '@/screens/NotesScreen';
import HomeScreen from '@/navigation/HomeScreen';

export type NotesStackParamList = {
  NotesList: undefined;
  NewNote: { createNew?: boolean; selectedEntry?: any } | undefined;
};

const Stack = createStackNavigator<NotesStackParamList>();

export default function NotesNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="NotesList" component={NotesScreen} />
      <Stack.Screen name="NewNote" component={HomeScreen} />
    </Stack.Navigator>
  );
}



