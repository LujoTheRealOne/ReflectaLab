import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, useColorScheme, TouchableOpacity, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '@/constants/Colors';
import NoteCard from '@/components/NoteCard';
import Skeleton from '@/components/skeleton/Skeleton';
import NoteCardSkeleton from '@/components/skeleton/NoteCardSkeleton';
import { useSyncSingleton } from '@/hooks/useSyncSingleton';
import { Plus } from 'lucide-react-native';

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
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // Handle manual refresh with backend sync
  const handleRefresh = useCallback(async () => {
    console.log('🔄 Manual refresh triggered from NotesScreen');
    setIsRefreshing(true);
    try {
      await refreshEntries();
      console.log('✅ NotesScreen refresh completed');
    } catch (error) {
      console.error('❌ NotesScreen refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshEntries]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={[styles.topSpacer, { height: insets.top + 12 }]} />
      <View style={styles.headerArea}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notes</Text>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.text}
            title="Pull to refresh"
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
              <Text style={[styles.sectionHeaderText, { color: colors.text, opacity: 0.4 }]}>
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
                onPress={() => {
                  console.log('📝 Opening note for editing:', entry.id);
                  (navigation as any).navigate('NewNote', { selectedEntry: entry });
                }}
              />
            ))}
          </>
        )}

        {/* Last 7 days section */}
        {!shouldShowSkeleton && groupedEntries.last7Days.length > 0 && (
          <>
            <View style={[styles.sectionHeader, { marginTop: groupedEntries.thisWeek.length > 0 ? 20 : 0 }]}>
              <Text style={[styles.sectionHeaderText, { color: colors.text, opacity: 0.4 }]}>
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
                onPress={() => {
                  console.log('📝 Opening note for editing:', entry.id);
                  (navigation as any).navigate('NewNote', { selectedEntry: entry });
                }}
              />
            ))}
          </>
        )}

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Floating Create Button with Gradient Background */}
      <View style={[styles.floatingButtonContainer, { bottom: insets.bottom + 10 }]}>
        <LinearGradient
          colors={[
            colorScheme === 'dark' ? 'rgba(17, 17, 17, 0)' : 'rgba(255, 255, 255, 0)',
            colorScheme === 'dark' ? 'rgba(17, 17, 17, 0.7)' : 'rgba(255, 255, 255, 0.8)',
            colorScheme === 'dark' ? 'rgba(17, 17, 17, 1)' : 'rgba(255, 255, 255, 1)'
          ]}
          style={styles.gradientBackground}
          locations={[0, 0.3, 1]}
        />
        <TouchableOpacity
          style={[
            styles.floatingCreateButton,
            {
              backgroundColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
            }
          ]}
          onPress={() => {
            (navigation as any).navigate('NewNote', { createNew: true });
          }}
        >
          <Plus size={32} color={colorScheme === 'dark' ? '#000000' : '#FFFFFF'} strokeWidth={2}/>
        </TouchableOpacity>
      </View>
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
  floatingButtonContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 120,
    pointerEvents: 'box-none',
  },
  gradientBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    height: 120,
  },
  floatingCreateButton: {
    width: 66,
    height: 56,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    marginBottom: 64,
  },
  floatingCreateIcon: {
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 24,
  },
});


