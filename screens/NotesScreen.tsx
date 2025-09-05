import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, useColorScheme, TouchableOpacity, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Colors } from '@/constants/Colors';
import NoteCard from '@/components/NoteCard';
import Skeleton from '@/components/skeleton/Skeleton';
import NoteCardSkeleton from '@/components/skeleton/NoteCardSkeleton';
import { useSyncSingleton } from '@/hooks/useSyncSingleton';

type JournalEntry = {
  id: string;
  title?: string;
  content?: string;
  timestamp: any; // Firestore timestamp or ISO string
  uid: string;
};

export default function NotesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { entries: cachedEntries, isLoading, refreshEntries } = useSyncSingleton();
  const [isNavigating, setIsNavigating] = useState(false);

  // Map cached entries to local shape with mock timestamp compat
  const entries = useMemo<JournalEntry[]>(() => {
    return cachedEntries.map((e) => ({
      id: e.id,
      title: e.title,
      content: e.content,
      timestamp: e.timestamp, // ISO string or Firestore timestamp
      uid: e.uid,
    }));
  }, [cachedEntries]);

  // Only show skeleton on true cold load (no cache data yet)
  const shouldShowSkeleton = isLoading && cachedEntries.length === 0;

  const formatDate = useCallback((ts: any) => {
    if (!ts) return '';
    const date = ts?.toDate ? ts.toDate() : new Date(ts);
    const today = new Date();
    const isSameDay =
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();

    if (isSameDay) return 'Today';
    
    // Format as "10. Aug"
    const day = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    return `${day}. ${month}`;
  }, []);

  const getEntryTitle = useCallback((entry: JournalEntry) => {
    if (entry.title && entry.title.trim().length > 0) return entry.title.trim();
    // Derive from content - take first 10 characters
    const plain = (entry.content || '').replace(/<[^>]*>/g, '').trim();
    if (plain.length > 0) {
      return plain.length > 10 ? plain.slice(0, 10) + '…' : plain;
    }
    return 'No headline';
  }, []);

  const extractPreview = useCallback((content?: string) => {
    if (!content) return 'Empty entry…';
    const plainText = content.replace(/<[^>]*>/g, '').trim();
    return plainText.length > 140 ? plainText.slice(0, 140) + '…' : plainText;
  }, []);

  // Group entries by time periods
  const groupedEntries = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const thisWeek: JournalEntry[] = [];
    const last7Days: JournalEntry[] = [];

    entries.forEach(entry => {
      if (!entry.timestamp) return;
      const entryDate = entry.timestamp.toDate ? entry.timestamp.toDate() : new Date(entry.timestamp);
      const entryDateOnly = new Date(entryDate.getFullYear(), entryDate.getMonth(), entryDate.getDate());

      if (entryDateOnly >= today) {
        thisWeek.push(entry);
      } else if (entryDateOnly >= weekAgo) {
        last7Days.push(entry);
      }
    });

    return { thisWeek, last7Days };
  }, [entries]);

  const contentContainerStyle = useMemo(() => ({
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Math.max(insets.bottom, 12),
  }), [insets.bottom]);

  // Reset navigation state when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setIsNavigating(false);
    }, [])
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={[styles.topSpacer, { height: insets.top + 12 }]} />
      <View style={styles.headerArea}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notes</Text>
        <TouchableOpacity 
          style={[
            styles.plusButton,
            { 
              borderColor: colorScheme === 'dark' ? '#374151' : '#000',
              backgroundColor: colorScheme === 'dark' ? '#374151' : '#000',
            }
          ]}
          onPress={() => {
            if (isNavigating) return; // Prevent multiple navigation calls
            
            setIsNavigating(true);
            // Navigate to Home screen with createNew flag
            (navigation as any).navigate('Home', { createNew: true });
            
            // Reset navigation flag after a short delay
            setTimeout(() => setIsNavigating(false), 500);
          }}
        >
          <Text style={[
            styles.plusIcon, 
            { color: '#FFFFFF' }
          ]}>
            +
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false} // Don't show loading spinner since we want instant UI
            onRefresh={refreshEntries}
            tintColor={colors.text}
          />
        }
      >
        {shouldShowSkeleton && (
          <>
            <View style={styles.sectionHeader}>
              <Skeleton style={{ width: 90, height: 12, borderRadius: 6 }} />
            </View>
            {Array.from({ length: 3 }).map((_, idx) => (
              <NoteCardSkeleton key={`s1-${idx}`} />
            ))}
            <View style={[styles.sectionHeader, { marginTop: 20 }]}>
              <Skeleton style={{ width: 110, height: 12, borderRadius: 6 }} />
            </View>
            {Array.from({ length: 3 }).map((_, idx) => (
              <NoteCardSkeleton key={`s2-${idx}`} />
            ))}
          </>
        )}

        {!shouldShowSkeleton && entries.length === 0 && (
          <Text style={{ color: colors.text, opacity: 0.6 }}>No entries yet.</Text>
        )}

        {/* This week section */}
        {!shouldShowSkeleton && groupedEntries.thisWeek.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionHeaderText, { color: 'rgba(0,0,0,0.4)' }]}>
                This week
              </Text>
            </View>
            {groupedEntries.thisWeek.map((entry) => (
              <NoteCard
                key={entry.id}
                title={getEntryTitle(entry)}
                subtitle=""
                preview={extractPreview(entry.content)}
                date={formatDate(entry.timestamp)}
              />
            ))}
          </>
        )}

        {/* Last 7 days section */}
        {!shouldShowSkeleton && groupedEntries.last7Days.length > 0 && (
          <>
            <View style={[styles.sectionHeader, { marginTop: groupedEntries.thisWeek.length > 0 ? 20 : 0 }]}>
              <Text style={[styles.sectionHeaderText, { color: 'rgba(0,0,0,0.4)' }]}>
                Last 7 days
              </Text>
            </View>
            {groupedEntries.last7Days.map((entry) => (
              <NoteCard
                key={entry.id}
                title={getEntryTitle(entry)}
                subtitle=""
                preview={extractPreview(entry.content)}
                date={formatDate(entry.timestamp)}
              />
            ))}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topSpacer: {
    width: '100%',
  },
  headerArea: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  scrollArea: {
    flex: 1,
  },
  sectionHeader: {
    paddingVertical: 4,
    marginBottom: 12, // 12px gap between section header and cards
    justifyContent: 'flex-start',
    alignItems: 'flex-start', // Left align instead of right
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.4)', // text-Color-Text-Subtlest/40 equivalent
  },
  plusButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  plusIcon: {
    fontSize: 18,
    fontWeight: '300',
    lineHeight: 18,
  },
});


