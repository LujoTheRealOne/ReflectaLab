import Editor from '@/components/TipTap';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import * as Crypto from 'expo-crypto';
import { 
  addDoc, 
  collection, 
  doc, 
  getDocs, 
  limit, 
  orderBy, 
  query, 
  serverTimestamp, 
  updateDoc, 
  where 
} from 'firebase/firestore';
import { AlignLeft, ArrowDown, AudioLines, Check, Cog, Settings, UserCog } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type DrawerNavigation = DrawerNavigationProp<any>;

type SaveStatus = 'saved' | 'saving' | 'unsaved';

interface JournalEntry {
  id: string;
  title: string;
  content?: string;
  timestamp: any; // Firestore timestamp
  uid: string;
}

export default function HomeContent() {
  const navigation = useNavigation<DrawerNavigation>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { firebaseUser, isFirebaseReady } = useAuth();

  // Get today's date as fallback
  const today = new Date();
  const fallbackFormattedDate = today.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'long' });
  const fallbackTime = today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const [entry, setEntry] = useState('');
  const [editorLoaded, setEditorLoaded] = useState(false);
  const [hasTriggeredHaptic, setHasTriggeredHaptic] = useState(false);
  const [latestEntry, setLatestEntry] = useState<JournalEntry | null>(null);
  const [isLoadingEntry, setIsLoadingEntry] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [originalContent, setOriginalContent] = useState('');
  const [isNewEntry, setIsNewEntry] = useState(false);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<string>('');

  // Calculate display values based on latest entry or fallback to today
  const displayDate = (latestEntry && !isNewEntry) 
    ? (latestEntry.timestamp?.toDate ? latestEntry.timestamp.toDate() : new Date(latestEntry.timestamp))
    : today;
  
  const formattedDate = displayDate.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'long' });
  const time = displayDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // Create a new entry
  const createNewEntry = useCallback(() => {
    if (!firebaseUser) return;

    const now = new Date();
    const newEntry: JournalEntry = {
      id: Crypto.randomUUID(),
      uid: firebaseUser.uid,
      content: '',
      timestamp: now,
      title: ''
    };

    // Update state to show new entry
    setLatestEntry(newEntry);
    setEntry('');
    setOriginalContent('');
    lastSavedContentRef.current = '';
    setSaveStatus('saved');
    setIsNewEntry(true);

    console.log('New entry created:', newEntry.id);
  }, [firebaseUser]);

  // Fetch the latest journal entry
  const fetchLatestEntry = useCallback(async () => {
    if (!firebaseUser) {
      setIsLoadingEntry(false);
      return;
    }

    try {
      const entriesQuery = query(
        collection(db, 'journal_entries'),
        where('uid', '==', firebaseUser.uid),
        orderBy('timestamp', 'desc'),
        limit(1)
      );

      const querySnapshot = await getDocs(entriesQuery);
      
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const entryData = doc.data() as Omit<JournalEntry, 'id'>;
        const latestEntryData = {
          id: doc.id,
          ...entryData
        };
        
        setLatestEntry(latestEntryData);
        setEntry(latestEntryData.content || '');
        setOriginalContent(latestEntryData.content || '');
        lastSavedContentRef.current = latestEntryData.content || '';
        setSaveStatus('saved');
        setIsNewEntry(false);
      } else {
        setLatestEntry(null);
        setEntry('');
        setOriginalContent('');
        lastSavedContentRef.current = '';
        setSaveStatus('saved');
        setIsNewEntry(false);
      }
    } catch (error) {
      console.error('Error fetching latest entry:', error);
      setLatestEntry(null);
      setEntry('');
      setOriginalContent('');
      lastSavedContentRef.current = '';
      setSaveStatus('saved');
      setIsNewEntry(false);
    } finally {
      setIsLoadingEntry(false);
    }
  }, [firebaseUser]);

  // Save entry to database
  const saveEntry = useCallback(async (content: string) => {
    if (!firebaseUser) return;

    try {
      setSaveStatus('saving');
      
      if (latestEntry && !isNewEntry) {
        // Update existing entry
        const entryRef = doc(db, 'journal_entries', latestEntry.id);
        await updateDoc(entryRef, {
          content,
          lastUpdated: serverTimestamp()
        });
      } else {
        // Create new entry in database
        const newEntry = {
          uid: firebaseUser.uid,
          content,
          timestamp: serverTimestamp(),
          lastUpdated: serverTimestamp()
        };
        
        const docRef = await addDoc(collection(db, 'journal_entries'), newEntry);
        
        // Update local state with new entry info from database
        setLatestEntry({
          id: docRef.id,
          uid: firebaseUser.uid,
          content,
          timestamp: new Date(),
          title: ''
        });
        setIsNewEntry(false);
      }
      
      lastSavedContentRef.current = content;
      setSaveStatus('saved');
    } catch (error) {
      console.error('Error saving entry:', error);
      setSaveStatus('unsaved');
    }
  }, [firebaseUser, latestEntry, isNewEntry]);

  // Handle content changes with debounced save
  const handleContentChange = useCallback((newContent: string) => {
    setEntry(newContent);
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Check if content has actually changed
    if (newContent === lastSavedContentRef.current) {
      setSaveStatus('saved');
      return;
    }
    
    // Set status to unsaved immediately
    setSaveStatus('unsaved');
    
    // Set new timeout for auto-save
    saveTimeoutRef.current = setTimeout(() => {
      saveEntry(newContent);
    }, 2000); // 2 seconds delay
  }, [saveEntry]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Fetch latest entry when Firebase is ready
  useEffect(() => {
    if (isFirebaseReady) {
      fetchLatestEntry();
    }
  }, [fetchLatestEntry, isFirebaseReady]);

  // Get save status text
  const getSaveStatusText = () => {
    // Show "Creating new entry" when we have a new entry with no content
    if (isNewEntry && (!entry || entry.trim() === '' || entry === '<p></p>')) {
      return 'Creating new entry';
    }
    
    switch (saveStatus) {
      case 'saving':
        return 'Saving...';
      case 'unsaved':
        return 'Unsaved';
      case 'saved':
      default:
        return 'Saved';
    }
  };

  // Animation values
  const translateY = useSharedValue(0);
  const TRIGGER_THRESHOLD = 200; // Pixels to trigger haptic and console log

  // Gesture handler functions
  const triggerHapticFeedback = () => {
    if (!hasTriggeredHaptic) {
      setHasTriggeredHaptic(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      createNewEntry();
    }
  };

  const resetHapticFlag = () => {
    setHasTriggeredHaptic(false);
  };

  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, context: any) => {
      context.startY = translateY.value;
    },
    onActive: (event, context: any) => {
      const newTranslateY = Math.max(0, context.startY + event.translationY);
      translateY.value = newTranslateY;

      // Trigger haptic feedback and new entry creation when threshold is reached
      if (newTranslateY >= TRIGGER_THRESHOLD) {
        runOnJS(triggerHapticFeedback)();
      }
    },
    onEnd: () => {
      // Always snap back to original position with controlled spring
      translateY.value = withSpring(0, {
        damping: 20,
        stiffness: 300,
        overshootClamping: true
      });
      runOnJS(resetHapticFlag)();
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  const textAnimatedStyle = useAnimatedStyle(() => {
    const opacity = translateY.value > 5 ? 1 : 0; // Show text when sliding starts
    return {
      transform: [{ translateY: translateY.value / 2 + 10 }], // Stay centered in revealed black area
      opacity,
    };
  });

  const curvedEdgesStyle = useAnimatedStyle(() => {
    const maxBorderRadius = 30;
    const borderRadius = Math.min((translateY.value / TRIGGER_THRESHOLD) * maxBorderRadius, maxBorderRadius);
    return {
      borderTopLeftRadius: borderRadius,
      borderTopRightRadius: borderRadius,
    };
  });

  return (
    <View style={[styles.container, { backgroundColor: 'black' }]}>

      {/* Floating text that follows the gesture */}
      <Animated.View style={[styles.floatingText, textAnimatedStyle]}>
        <Text style={styles.instructionText}>Swipe down to create</Text>
        <Animated.View>
          {translateY.value < 30 ?
            <ArrowDown size={24} color={'white'} />
            :
            <Check size={24} color={'white'} />
          }
        </Animated.View>
      </Animated.View>

      {/* Main content that slides down */}
      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View style={[styles.mainContent, animatedStyle, curvedEdgesStyle]}>
          <Animated.View style={[styles.safeArea, { backgroundColor: colors.background }, curvedEdgesStyle]}>
            <SafeAreaView style={[styles.safeAreaInner, { marginTop: useSafeAreaInsets().top }]}>
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity onPress={() => {
                  navigation.openDrawer();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}>
                  <AlignLeft size={28} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  navigation.navigate('Settings' as never);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}>
                  {/* <UserCog size={24} color={colors.text} /> */}
                  <Image source={{ uri: useAuth().user?.imageUrl }} style={{ width: 32, height: 32, borderRadius: 100, borderWidth: 1, borderColor: colors.text }} />
                </TouchableOpacity>
              </View>

              {/* Content */}
              <View style={styles.content}>
                <Text style={{ fontSize: 16, marginTop: 10, marginRight: 5, color: colors.text, textAlign: 'right', opacity: 0.3 }}>
                  {getSaveStatusText()}
                </Text>
                {/* Date Input */}
                <View style={{ flexDirection: 'row', gap: 15, alignItems: 'center' }}>
                  <Text
                    style={[styles.dateText, { color: colors.text }]}
                  >
                    {formattedDate}
                  </Text>
                  <View style={{ width: 30, height: 3, backgroundColor: 'orange', borderRadius: 5 }} />
                  <Text
                    style={[styles.timeText, { color: colors.text, opacity: 0.5 }]}
                  >
                    {time}
                  </Text>
                </View>

                {/* Thoughts Section */}
                <View style={{ flex: 1 }}>
                  <Editor content={entry} onUpdate={handleContentChange} isLoaded={setEditorLoaded} />
                </View>
              </View>
              {/* <TouchableOpacity
                style={{ position: 'absolute', bottom: 50, right: 20, paddingHorizontal: 15, paddingVertical: 15, backgroundColor: colors.text, borderRadius: 15 }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <AudioLines size={24} color={colors.background} />
              </TouchableOpacity> */}
            </SafeAreaView>
          </Animated.View>
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  floatingText: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    pointerEvents: 'none',
  },
  instructionText: {
    color: 'white',
    fontSize: 24,
    fontWeight: '500',
    opacity: 1,
    marginBottom: 10,
  },
  mainContent: {
    flex: 1,
    backgroundColor: 'transparent',
    zIndex: 2,
  },
  safeArea: {
    flex: 1,
  },
  safeAreaInner: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  dateText: {
    fontSize: 28,
    fontWeight: '500',
    paddingVertical: 10,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '400',
    paddingVertical: 10,
  },
  journalInput: {
    minHeight: 100,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  floatingButtons: {
    position: 'absolute',
    alignItems: 'flex-end',
    bottom: 30,
    right: 20,
    gap: 15,
  },
  floatingButton: {
    width: 56,
    height: 56,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 