import React from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import Skeleton from './Skeleton';

export default function NoteCardSkeleton() {
  const colorScheme = useColorScheme();
  const borderColor = colorScheme === 'dark' ? '#2A2A2A' : '#D9D9D9';
  const cardBackground = colorScheme === 'dark' ? '#1C1C1C' : '#FFFFFF';
  const contentBackground = colorScheme === 'dark' ? '#252525' : '#F9F9F9';

  return (
    <View style={[styles.card, { borderColor, backgroundColor: cardBackground }]}> 
      <View style={styles.headerRow}>
        <Skeleton style={{ width: 120, height: 12 }} />
        <Skeleton style={{ width: 50, height: 12 }} />
      </View>
      <View style={[styles.content, { backgroundColor: contentBackground }]}>
        <Skeleton style={{ width: '100%', height: 10, marginBottom: 8 }} />
        <Skeleton style={{ width: '90%', height: 10, marginBottom: 8 }} />
        <Skeleton style={{ width: '60%', height: 10 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 0.5,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
});


