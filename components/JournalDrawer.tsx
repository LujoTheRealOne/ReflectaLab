import { Colors } from '@/constants/Colors';
import { db } from '@/lib/firebase';
import { DrawerContentComponentProps, useDrawerStatus } from '@react-navigation/drawer';
import { collection, getDocs, orderBy, query, where, deleteDoc, doc } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Alert,
  Modal
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useCurrentEntry } from '@/navigation/HomeScreen';
import { Calendar } from 'lucide-react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

interface JournalEntry {
  id: string;
  title: string;
  content?: string;
  timestamp: any; // Firestore timestamp
  userId: string;
}

interface GroupedEntries {
  [date: string]: JournalEntry[];
}

export default function JournalDrawer(props: DrawerContentComponentProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const drawerStatus = useDrawerStatus();
  const { currentEntryId } = useCurrentEntry();

  const { firebaseUser, isFirebaseReady } = useAuth();
  const { trackEntryDeleted } = useAnalytics();

  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [groupedEntries, setGroupedEntries] = useState<GroupedEntries>({});
  const [isLoading, setIsLoading] = useState(true);
  const [scrollY, setScrollY] = useState(0);
  
  // Calendar state
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Group entries by date
  const groupEntriesByDate = useCallback((entries: JournalEntry[]) => {
    const grouped: GroupedEntries = {};

    entries.forEach((entry) => {
      const date = entry.timestamp?.toDate ? entry.timestamp.toDate() : new Date(entry.timestamp);
      const dateKey = date.toDateString(); // This will group by full date (e.g., "Mon Oct 28 2024")

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(entry);
    });

    return grouped;
  }, []);

  // Fetch journal entries from Firestore
  const fetchJournalEntries = useCallback(async () => {
    if (!firebaseUser) {
      setIsLoading(false);
      return;
    }

    try {
      const entriesQuery = query(
        collection(db, 'journal_entries'),
        where('uid', '==', firebaseUser.uid),
        orderBy('timestamp', 'desc')
      );

      const querySnapshot = await getDocs(entriesQuery);
      const entriesList: JournalEntry[] = [];

      querySnapshot.forEach((doc) => {
        const entryData = doc.data() as Omit<JournalEntry, 'id'>;
        entriesList.push({
          id: doc.id,
          ...entryData
        });
      });

      setJournalEntries(entriesList);
      setGroupedEntries(groupEntriesByDate(entriesList));
    } catch (error) {
      console.error('Error fetching journal entries:', error);
    } finally {
      setIsLoading(false);
    }
  }, [firebaseUser, groupEntriesByDate]);

  // Initial fetch when Firebase is ready
  useEffect(() => {
    if (isFirebaseReady) {
      fetchJournalEntries();
    }
  }, [fetchJournalEntries, isFirebaseReady]);

  // Refresh entries when drawer opens
  useEffect(() => {
    if (drawerStatus === 'open' && isFirebaseReady && firebaseUser) {
      // Add haptic feedback when drawer opens
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      fetchJournalEntries();
    }
  }, [drawerStatus, isFirebaseReady, firebaseUser, fetchJournalEntries]);

  // Handle calendar date selection
  const handleDateSelect = useCallback(async (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowCalendar(false);
    }
    
    if (date) {
      setSelectedDate(date);
      
      // Find entry for the selected date
      const dateKey = date.toDateString();
      const entriesForDate = groupedEntries[dateKey];
      
      if (entriesForDate && entriesForDate.length > 0) {
        // If there's an entry for this date, navigate to it
        const entry = entriesForDate[0]; // Take the first entry if multiple exist for the same date
        
        // Haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        
        // Close calendar and drawer
        setShowCalendar(false);
        props.navigation.closeDrawer();
        
        // Navigate to the entry
        (props.navigation as any).navigate('HomeContent', { selectedEntry: entry });
      } else {
        // No entry for this date - create a new entry for that date
        // First close calendar and drawer
        setShowCalendar(false);
        props.navigation.closeDrawer();
        
        // Navigate to home with createNew flag - HomeContent will handle creating entry for the date
        (props.navigation as any).navigate('HomeContent', { createNew: true });
      }
    }
    
    if (Platform.OS === 'ios') {
      setShowCalendar(false);
    }
  }, [groupedEntries, props.navigation]);

  // Handle calendar button press
  const handleCalendarPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowCalendar(true);
  }, []);



  // Handle scroll events
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    setScrollY(currentScrollY);
  };

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  };

  const formatEntryTime = (timestamp: any) => {
    if (!timestamp) return '';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const extractPreview = (content: string) => {
    if (!content) return 'Empty entry...';

    // Remove HTML tags and extract first 100 characters
    const plainText = content.replace(/<[^>]*>/g, '');
    return plainText.length > 90 ? plainText.substring(0, 90) + '...' : plainText;
  };

  const getEntryTitle = (entry: JournalEntry) => {
    if (entry.title) return entry.title;

    // Extract title from content if no explicit title exists
    const plainText = entry.content ? entry.content.replace(/<[^>]*>/g, '') : '';
    const firstLine = plainText.split('\n')[0];
    return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine || 'Untitled Entry';
  };

  // Delete journal entry
  const deleteEntry = useCallback(async (entryId: string) => {
    if (!firebaseUser) return;

    try {
      // Find the entry to get its details for tracking
      const entryToDelete = journalEntries.find(entry => entry.id === entryId);
      
      // Delete from Firestore
      await deleteDoc(doc(db, 'journal_entries', entryId));
      
      // Track journal entry deletion
      trackEntryDeleted({
        entry_id: entryId,
        content_length: entryToDelete?.content?.length || 0,
        entry_age_days: entryToDelete?.timestamp ? 
          Math.floor((new Date().getTime() - new Date(entryToDelete.timestamp.toDate()).getTime()) / (1000 * 60 * 60 * 24)) : 0,
      });
      
      // Update local state
      const updatedEntries = journalEntries.filter(entry => entry.id !== entryId);
      setJournalEntries(updatedEntries);
      
      // Update grouped entries
      setGroupedEntries(groupEntriesByDate(updatedEntries));
      
      // If this was the current entry, handle navigation
      if (currentEntryId === entryId) {
        // Close the drawer first
        props.navigation.closeDrawer();
        
        if (updatedEntries.length > 0) {
          // Navigate to the latest entry (first in the sorted array)
          const latestEntry = updatedEntries[0];
          (props.navigation as any).navigate('HomeContent', { selectedEntry: latestEntry });
        } else {
          // No entries left, navigate to create a new one
          (props.navigation as any).navigate('HomeContent', { createNew: true });
        }
      }
      
    } catch (error) {
      console.error('Error deleting entry:', error);
      Alert.alert('Error', 'Failed to delete entry. Please try again.');
    }
  }, [firebaseUser, journalEntries, groupEntriesByDate, currentEntryId, props.navigation, trackEntryDeleted]);

  // Handle long press on entry
  const handleLongPress = useCallback((entry: JournalEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const entryPreview = extractPreview(entry.content || '');
    const truncatedPreview = entryPreview.length > 50 ? entryPreview.substring(0, 50) + '...' : entryPreview;
    
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Delete Entry'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 0,
          title: `Delete "${truncatedPreview}"?`,
          message: 'This action cannot be undone.',
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            deleteEntry(entry.id);
          }
        }
      );
    } else {
      // Fallback for Android
      Alert.alert(
        'Delete Entry',
        `Are you sure you want to delete "${truncatedPreview}"?\n\nThis action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete', 
            style: 'destructive', 
            onPress: () => deleteEntry(entry.id)
          }
        ]
      );
    }
  }, [deleteEntry, extractPreview]);

  // Show loading while Firebase auth is not ready
  if (!isFirebaseReady) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, marginTop: useSafeAreaInsets().top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.text} style={{ opacity: 0.5 }} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading entries...</Text>
        </View>
      </View>
    );
  }

  // Get sorted date keys (newest first)
  const sortedDateKeys = Object.keys(groupedEntries).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });

  // Calculate border opacity based on scroll position for smooth transition
  const borderOpacity = Math.min((scrollY - 20) / 30, 1); // Gradually fade in over 30 pixels

  return (
    <View style={[styles.container, { backgroundColor: colors.background, marginTop: useSafeAreaInsets().top }]}>
      {/* Header */}
      <View style={[styles.header]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Journal Entries
        </Text>
        <TouchableOpacity
          onPress={handleCalendarPress}
          style={styles.calendarButton}
        >
          <Calendar size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Journal Entries List */}
      <ScrollView
        style={[
          styles.content,
          {
            borderTopWidth: 1,
            borderTopColor: `rgba(150, 150, 150, ${0.1 * borderOpacity})`,
          }
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.text} style={{ opacity: 0.5 }} />
            <Text style={[styles.loadingText, { color: colors.text }]}>Loading entries...</Text>
          </View>
        )}

        {/* No Entries State */}
        {!isLoading && journalEntries.length === 0 && (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.text }]}>
              No journal entries yet.
            </Text>
            <Text style={[styles.emptyText, { color: colors.text }]}>
              Start writing your first entry!
            </Text>
          </View>
        )}

        {/* Grouped Journal Entries */}
        {!isLoading && sortedDateKeys.map((dateKey) => (
          <View key={dateKey} style={styles.dateGroup}>
            {/* Date Header */}
            <View style={styles.dateHeader}>
              <View style={styles.dateHeaderLine} />
              <Text style={[styles.dateHeaderText, { color: colors.text }]}>
                {formatDateHeader(dateKey)}
              </Text>
            </View>

            {/* Entries for this date */}
            {groupedEntries[dateKey].map((entry) => {
              const isCurrentEntry = currentEntryId === entry.id;

              return (
                <TouchableOpacity
                  key={entry.id}
                  style={[styles.entryItem]}
                  onPress={() => {
                    // Haptic feedback for entry selection
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

                    // Close the drawer first
                    props.navigation.closeDrawer();

                    // Navigate to HomeContent with the selected entry data
                    (props.navigation as any).navigate('HomeContent', { selectedEntry: entry });
                  }}
                  onLongPress={() => handleLongPress(entry)}
                >
                  <View style={[styles.entryLine, { backgroundColor: isCurrentEntry ? colors.tint : '#525252' }]} />
                  <Text
                    style={[styles.entryPreview, { color: colors.text, opacity: isCurrentEntry ? 1 : 0.7 }]}
                    numberOfLines={1}
                  >
                    {extractPreview(entry.content || '')}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        ))}
      </ScrollView>

      {/* Calendar Modal */}
      {showCalendar && (
        <Modal
          transparent={true}
          animationType="slide"
          visible={showCalendar}
          onRequestClose={() => setShowCalendar(false)}
          statusBarTranslucent={true}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowCalendar(false)}
          >
            <TouchableOpacity 
              style={[
                styles.calendarModal, 
                { 
                  backgroundColor: colors.background,
                  paddingBottom: Math.max(useSafeAreaInsets().bottom, 20)
                }
              ]}
              activeOpacity={1}
              onPress={() => {}}
            >
              {/* Modal Handle */}
              <View style={styles.modalHandle}>
                <View style={[styles.handleBar, { backgroundColor: colors.text }]} />
              </View>
              
              <View style={styles.calendarHeader}>
                <Text style={[styles.calendarTitle, { color: colors.text }]}>
                  Select Date
                </Text>
                <TouchableOpacity
                  onPress={() => setShowCalendar(false)}
                  style={styles.calendarCloseButton}
                >
                  <Text style={[styles.calendarCloseText, { color: colors.tint }]}>
                    Done
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.datePickerContainer}>
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                  onChange={handleDateSelect}
                  maximumDate={new Date()}
                  textColor={colors.text}
                  themeVariant={colorScheme === 'dark' ? 'dark' : 'light'}
                  style={styles.datePicker}
                />
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingTop: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '500',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    borderRadius: 20,
    flex: 1,
    paddingTop: 30,
    paddingHorizontal: 20,
  },
  dateGroup: {
    marginBottom: 20,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 25,
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  dateHeaderLine: {
    width: 20,
    height: 3,
    borderRadius: 5,
    backgroundColor: '#FB2C36',
  },
  dateHeaderText: {
    fontSize: 18,
    fontWeight: '600',
  },
  entryItem: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginLeft: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 25,
  },
  entryLine: {
    width: 10,
    height: 2,
    backgroundColor: '#525252',
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  entryTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  entryTime: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.6,
  },
  entryDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  entryPreview: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.7,
    width: '80%'
  },
  addEntryItem: {
    marginHorizontal: 10,
    borderRadius: 12,
    marginBottom: 5,
    padding: 14,
  },
  addEntryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addEntryText: {
    fontSize: 16,
    fontWeight: '500',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    opacity: 0.5,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.5,
    textAlign: 'center',
    lineHeight: 20,
  },
  calendarButton: {
    padding: 8,
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    paddingHorizontal: 0,
  },
  calendarModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150, 150, 150, 0.1)',
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  calendarCloseButton: {
    padding: 4,
  },
  calendarCloseText: {
    fontSize: 16,
    fontWeight: '500',
  },
  datePickerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  datePicker: {
    width: '100%',
    height: Platform.OS === 'ios' ? 200 : 'auto',
  },
  modalHandle: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.3,
  },
}); 