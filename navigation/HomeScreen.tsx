import React from 'react';
import { CurrentEntryProvider } from '@/components/CurrentEntryContext';
import HomeContent from '@/screens/NewNote';

export default function HomeScreen() {
  return (
    <CurrentEntryProvider>
      <HomeContent />
    </CurrentEntryProvider>
  );
} 