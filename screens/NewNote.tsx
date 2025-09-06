import Editor, { EditorRef } from '@/components/ArdaEditor';
import EditorErrorBoundary from '@/components/EditorErrorBoundary';
import KeyboardToolbar from '@/components/KeyboardToolbar';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { useSyncSingleton } from '@/hooks/useSyncSingleton';
import { db } from '@/lib/firebase';
import { syncService } from '@/services/syncService';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useCurrentEntry } from '@/navigation/HomeScreen';
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
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { ChevronLeft, ArrowDown, Check, Mic, Square, Plus, Loader2, FileText } from 'lucide-react-native';
import { useAudioTranscriptionAv } from '@/hooks/useAudioTranscriptionAv';
import { Button } from '@/components/ui/Button';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableOpacity
} from 'react-native';
import { PanGestureHandler, State, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
  withTiming,
  interpolate,
  withRepeat,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';



type SaveStatus = 'saved' | 'saving' | 'unsaved';

interface JournalEntry {
  id: string;
  title: string;
  content?: string;
  timestamp: any; // Firestore timestamp
  uid: string;
  linkedCoachingSessionId?: string; // id of the coaching session that this entry is linked to
  linkedCoachingMessageId?: string; // id of the coaching message that this entry is linked to
}


export default function HomeContent() {
  const navigation = useNavigation();
  const route = useRoute();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { firebaseUser, isFirebaseReady, getToken } = useAuth();
  const { isPro, presentPaywallIfNeeded, currentOffering, initialized } = useRevenueCat(firebaseUser?.uid);
  const { setCurrentEntryId } = useCurrentEntry();
  const { trackEntryCreated, trackEntryUpdated, trackMeaningfulAction } = useAnalytics();
  const { addEntry: addToCache, updateEntry: updateInCache } = useSyncSingleton();


  const [entry, setEntry] = useState('');
  const [editorLoaded, setEditorLoaded] = useState(false);
  const [hasTriggeredHaptic, setHasTriggeredHaptic] = useState(false);
  const [latestEntry, setLatestEntry] = useState<JournalEntry | null>(null);
  const [isLoadingEntry, setIsLoadingEntry] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [originalContent, setOriginalContent] = useState('');
  const [isNewEntry, setIsNewEntry] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [activeFormats, setActiveFormats] = useState<string[]>([]);
  



  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<string>('');
  const editorRef = useRef<EditorRef>(null);
  const isPersistedRef = useRef<boolean>(false); // Has this entry been created in DB/cache?
  const isSavingRef = useRef<boolean>(false); // Prevent overlapping saves
  const currentEntryIdRef = useRef<string | null>(null); // Stable ID for this session
  const skipExitSaveRef = useRef<boolean>(false); // Prevent cleanup save after manual save

  // Audio transcription hook
  const {
    isRecording,
    isTranscribing,
    recordingStartTime,
    audioLevel,
    startRecording,
    stopRecordingAndTranscribe,
    cancelRecording,
  } = useAudioTranscriptionAv({
    onTranscriptionComplete: (transcription) => {
      // Insert transcription at current cursor position in the editor
      // For now, we'll append it to the existing content
      const currentContent = entry;
      const newContent = currentContent ? `${currentContent} ${transcription}` : transcription;
      setEntry(newContent);
      handleContentChange(newContent);
    },
    onTranscriptionError: (error) => {
      console.error('Transcription error:', error);
    },
    isPro,
    onProRequired: async () => {
      const unlocked = await presentPaywallIfNeeded('reflecta_pro', currentOffering || undefined);
      console.log('🎤 Voice transcription Pro check in HomeContent:', unlocked ? 'unlocked' : 'cancelled');
    },
  });

  // Create a new entry session - always generates fresh ID
  const createNewEntry = useCallback(() => {
    if (!firebaseUser) return;

    const entryId = Crypto.randomUUID();
    console.log('🆕 Starting NEW entry session with ID:', entryId);
    
    const now = new Date();
    const newEntry: JournalEntry = {
      id: entryId,
      uid: firebaseUser.uid,
      content: '',
      timestamp: now,
      title: ''
    };

    // Force complete reset of all state
    setLatestEntry(newEntry);
    setEntry('');
    setOriginalContent('');
    lastSavedContentRef.current = '';
    setSaveStatus('saved');
    setIsNewEntry(true);
    
    // Clear any pending saves
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    // Reset persistence flags and assign stable ID
    isPersistedRef.current = false;
    isSavingRef.current = false;
    currentEntryIdRef.current = entryId;
    
    console.log('✅ Fresh entry session started:', entryId);
  }, [firebaseUser]);

  // Handle selected entry from drawer navigation
  useEffect(() => {
    const selectedEntry = (route.params as any)?.selectedEntry;
    const createNew = (route.params as any)?.createNew;

    if (selectedEntry) {
      setLatestEntry(selectedEntry);
      setEntry(selectedEntry.content || '');
      setOriginalContent(selectedEntry.content || '');
      lastSavedContentRef.current = selectedEntry.content || '';
      setSaveStatus('saved');
      setIsNewEntry(false);
      
      // Set stable ID for this existing entry session
      currentEntryIdRef.current = selectedEntry.id;
      isPersistedRef.current = true; // Mark as already persisted
      console.log('📖 Loaded existing entry session with ID:', selectedEntry.id);

      // Clear the route params to prevent re-loading on re-renders
      navigation.setParams({ selectedEntry: undefined } as any);
    } else if (createNew) {
      // Create a new entry when explicitly requested
      createNewEntry();

      // Clear the route params to prevent re-loading on re-renders
      navigation.setParams({ createNew: undefined } as any);
    }
  }, [route.params, navigation, createNewEntry]);

  // Handle createNew param on screen focus
  useFocusEffect(
    useCallback(() => {
      const createNew = (route.params as any)?.createNew;
      console.log('🎯 Screen focused, createNew:', createNew);
      
      if (createNew) {
        console.log('🚀 FORCE creating new entry from focus...');
        // Force immediate new entry creation
        createNewEntry();
        
        // Clear the route params immediately
        navigation.setParams({ createNew: undefined } as any);
      }
    }, [route.params, navigation, createNewEntry])
  );

  // Update current entry ID in context whenever latestEntry changes
  useEffect(() => {
    setCurrentEntryId(latestEntry?.id || null);
  }, [latestEntry, setCurrentEntryId]);


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

  // Save entry to database and update cache
  const saveEntry = useCallback(async (content: string) => {
    if (!firebaseUser) return;

    try {
      if (isSavingRef.current) {
        // Skip if a save is already in progress; next content change will schedule another
        return;
      }
      isSavingRef.current = true;
      setSaveStatus('saving');

      // Use the stable entry ID set during session start - never generate new IDs
      const stableEntryId = currentEntryIdRef.current || latestEntry?.id;
      
      if (!stableEntryId) {
        console.error('❌ No stable entry ID found - this should not happen');
        return;
      }
      
      console.log('💾 Saving with stable entry ID:', stableEntryId);

      if (isPersistedRef.current || (latestEntry && !isNewEntry)) {
        // Update existing entry
        const entryRef = doc(db, 'journal_entries', stableEntryId);
        await updateDoc(entryRef, {
          content,
          lastUpdated: serverTimestamp()
        });

        // Update in cache for real-time Notes list update
        await updateInCache(stableEntryId, {
          content,
          timestamp: (latestEntry?.timestamp?.toDate ? latestEntry?.timestamp.toDate() : latestEntry?.timestamp) || new Date(),
          title: latestEntry?.title || ''
        });

        // Track journal entry update (for all entries, regardless of size)
        trackEntryUpdated({
          entry_id: stableEntryId,
          content_length: content.length,
        });
        
        console.log('📝 Updated existing entry in cache');
      } else {
        // Create new entry in database using the pre-generated ID
        const entryId = stableEntryId;
        const now = new Date();
        const newEntry = {
          uid: firebaseUser.uid,
          content,
          timestamp: serverTimestamp(),
          lastUpdated: serverTimestamp()
        };

        const docRef = doc(db, 'journal_entries', entryId);
        await setDoc(docRef, newEntry);

        // Add to local cache only (no extra Firestore write)
        await syncService.addLocalEntry(firebaseUser.uid, {
          id: entryId,
          uid: firebaseUser.uid,
          content,
          timestamp: now.toISOString(),
          title: '',
          _syncStatus: 'synced',
        } as any);

        // Track journal entry creation (for all entries, regardless of size)
        trackEntryCreated({
          entry_id: entryId,
        });

        // Update local state with new entry info from database (keep the same ID)
        setLatestEntry({
          id: entryId,
          uid: firebaseUser.uid,
          content,
          timestamp: now,
          title: ''
        });
        setIsNewEntry(false);
        isPersistedRef.current = true;
        currentEntryIdRef.current = entryId;
        
        console.log('🆕 Added new entry to cache');
      }

      lastSavedContentRef.current = content;
      setSaveStatus('saved');
    } catch (error) {
      console.error('Error saving entry:', error);
      setSaveStatus('unsaved');
    } finally {
      isSavingRef.current = false;
    }
  }, [firebaseUser, latestEntry, isNewEntry, addToCache, updateInCache, trackEntryUpdated, trackEntryCreated]);

  // Handle content changes with smart debounced auto-save
  const handleContentChange = useCallback((newContent: string) => {
    setEntry(newContent);

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Check if content has actually changed significantly
    const trimmedNew = newContent.trim();
    const trimmedLast = lastSavedContentRef.current.trim();
    
    if (trimmedNew === trimmedLast) {
      setSaveStatus('saved');
      return;
    }

    // Set status to unsaved immediately
    setSaveStatus('unsaved');

    // Smart delay based on content length difference
    const contentDiff = Math.abs(trimmedNew.length - trimmedLast.length);
    const isSignificantChange = contentDiff >= 10; // At least 10 characters changed
    
    // Longer delay for small changes, shorter for significant changes (increased to reduce noise)
    const delay = isSignificantChange ? 5000 : 12000;

    saveTimeoutRef.current = setTimeout(() => {
      if (trimmedNew && trimmedNew !== lastSavedContentRef.current.trim()) {
        console.log('⏰ Smart auto-saving during session...');
        saveEntry(newContent);
      }
    }, delay);
  }, [saveEntry]);

  // Track journal entries when save status changes to 'saved' (debounced)
  const lastTrackedContentRef = useRef('');
  const trackingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (saveStatus === 'saved' && lastSavedContentRef.current.length >= 200 && 
        lastSavedContentRef.current !== lastTrackedContentRef.current) {
      
      // Clear any existing tracking timeout
      if (trackingTimeoutRef.current) {
        clearTimeout(trackingTimeoutRef.current);
      }
      
      // Debounce tracking to avoid rapid fire events
      trackingTimeoutRef.current = setTimeout(() => {
        const content = lastSavedContentRef.current;
        const entryId = latestEntry?.id || 'unknown';
        
        // Track meaningful action for substantial journal entries
        trackMeaningfulAction({
          action_type: 'journal_entry',
          session_id: entryId,
          content_length: content.length,
        });
        
        // Track entry created or updated (less frequent)
        if (isNewEntry || !latestEntry) {
          trackEntryCreated({ entry_id: entryId });
        } else {
          trackEntryUpdated({
            entry_id: entryId,
            content_length: content.length,
          });
        }
        
        lastTrackedContentRef.current = content;
      }, 500); // 500ms delay to debounce tracking
    }
  }, [saveStatus]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (trackingTimeoutRef.current) {
        clearTimeout(trackingTimeoutRef.current);
      }
    };
  }, []);

  // Keyboard visibility listeners with microphone button animation
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        const keyboardHeight = event?.endCoordinates?.height || 0;
        // Mikrofonunu keyboard'ın üstüne konumlandır
        const newTranslateY = -(keyboardHeight - 117); // Keyboard - 5px (daha aşağıda)
        

        
        setIsKeyboardVisible(true);
        setKeyboardHeight(keyboardHeight);
        
        // Animate microphone button to keyboard position - higher up for toolbar space
        micButtonTranslateX.value = withTiming(-2, { duration: 300 });
        micButtonTranslateY.value = withTiming(newTranslateY, { duration: 300 });
      }
    );
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {

        
        setIsKeyboardVisible(false);
        setKeyboardHeight(0);
        // Animate microphone button back to right side position
        micButtonTranslateX.value = withTiming(-2, { duration: 300 });
                  micButtonTranslateY.value = withTiming(-80, { duration: 300 }); // Lower position at navigation level
      }
    );

    return () => {
      keyboardWillShowListener?.remove();
      keyboardWillHideListener?.remove();
    };
  }, []);

  // Initialize with empty state - no automatic fetching
  useEffect(() => {
    if (isFirebaseReady) {
      const selectedEntry = (route.params as any)?.selectedEntry;
      const createNew = (route.params as any)?.createNew;
      
      console.log('🔥 Firebase ready, params:', { selectedEntry: !!selectedEntry, createNew });
      
      // Only handle specific navigation params, never auto-fetch
      if (!selectedEntry && !createNew) {
        console.log('🆕 No params - starting fresh session');
        createNewEntry(); // Always start with new entry if no specific params
      } else {
        console.log('⏭️ Handling specific params');
      }
    }
  }, [isFirebaseReady, route.params, createNewEntry]);

  // Initialize microphone button position
  useEffect(() => {
    // Set initial position to right side (slightly above navbar)

    micButtonTranslateX.value = -2;
    micButtonTranslateY.value = -80; // Lower position at navigation level
  }, []);

  // Spinner animation for save status
  useEffect(() => {
    if (saveStatus === 'saving' || saveStatus === 'unsaved') {
      spinnerRotation.value = withRepeat(
        withTiming(360, { duration: 1000 }),
        -1,
        false
      );
    } else {
      spinnerRotation.value = 0;
    }
  }, [saveStatus]);

  // Keep screen awake while recording
  useEffect(() => {
    if (isRecording) {
      activateKeepAwakeAsync()
        .catch(error => console.error('❌ Failed to activate keep awake:', error));
    } else {
      deactivateKeepAwake();
    }
  }, [isRecording]);

  // Cleanup keep awake on component unmount
  useEffect(() => {
    return () => {
      deactivateKeepAwake();
    };
  }, []);

  // Force save on exit (final save when leaving the screen)
  useFocusEffect(
    useCallback(() => {
      setIsNavigating(false);
      
      // Return cleanup function that runs when screen loses focus
      return () => {
        // Skip if a manual save just happened (e.g., back/nav)
        if (skipExitSaveRef.current) {
          skipExitSaveRef.current = false;
          return;
        }
        
        // Clear any pending auto-save to avoid conflicts
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        
        // Force save if there's any content at all
        const currentContent = entry.trim();
        
        if (currentContent && currentContent.length >= 1) {
          console.log('💾 FINAL SAVE - Entry content:', currentContent.substring(0, 50) + '...');
          // Force immediate save without debouncing
          saveEntry(entry).then(() => {
            console.log('✅ Final save completed before exit');
          }).catch((error) => {
            console.error('❌ Final save failed:', error);
          });
        } else {
          console.log('⏭️ No content to save on exit');
        }
      };
    }, [entry, saveEntry])
  );


  // Get save status icon
  const getSaveStatusIcon = () => {
    const iconColor = colorScheme === 'dark' ? '#ffffff' : '#000000';
    const iconOpacity = colorScheme === 'dark' ? 0.8 : 0.8;
    
    // Show draft icon when we have a new entry with no content
    if (isNewEntry && (!entry || entry.trim() === '' || entry === '<p></p>')) {
      return <FileText size={18} color={iconColor} style={{ opacity: iconOpacity }} />;
    }

    switch (saveStatus) {
      case 'saving':
        return (
          <Animated.View style={spinnerAnimatedStyle}>
            <Loader2 size={18} color={iconColor} style={{ opacity: iconOpacity }} />
          </Animated.View>
        );
      case 'unsaved':
        return (
          <Animated.View style={spinnerAnimatedStyle}>
            <Loader2 size={18} color={iconColor} style={{ opacity: iconOpacity }} />
          </Animated.View>
        );
      case 'saved':
      default:
        return <Check size={18} color={iconColor} style={{ opacity: iconOpacity }} />;
    }
  };

  // Animation values
  const translateY = useSharedValue(0);
  const TRIGGER_THRESHOLD = 200; // Pixels to trigger haptic and console log
  
  // Microphone button animation
  const micButtonOpacity = useSharedValue(1);
  const micButtonTranslateX = useSharedValue(0);
  const micButtonTranslateY = useSharedValue(0);
  
  // Spinner animation for save status
  const spinnerRotation = useSharedValue(0);

  // Gesture handler functions
  const triggerHapticFeedback = () => {
    if (!hasTriggeredHaptic) {
      setHasTriggeredHaptic(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const triggerNewEntry = () => {
    createNewEntry();
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

      // Trigger haptic feedback when threshold is reached (but don't create entry yet)
      if (newTranslateY >= TRIGGER_THRESHOLD) {
        runOnJS(triggerHapticFeedback)();
      } else {
        runOnJS(resetHapticFlag)();
      }
    },
    onEnd: () => {
      // Check if we should create a new entry based on final position
      const shouldCreateEntry = translateY.value >= TRIGGER_THRESHOLD;

      // Always snap back to original position with controlled spring
      translateY.value = withSpring(0, {
        damping: 20,
        stiffness: 300,
        overshootClamping: true
      });

      // Create new entry only if released beyond threshold
      if (shouldCreateEntry) {
        runOnJS(triggerNewEntry)();
      }

      runOnJS(resetHapticFlag)();
    },
  });

  // Add horizontal swipe gesture for Notes navigation
  const [isNavigating, setIsNavigating] = useState(false);
  
  const navigateToNotes = useCallback(async () => {
    if (isNavigating) return; // Prevent multiple navigation calls
    
    setIsNavigating(true);
    
    // Force save before navigation
    const currentContent = entry.trim();
    if (currentContent && currentContent.length >= 1) {
      // Clear any pending auto-save and mark to skip cleanup save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      skipExitSaveRef.current = true;
      try {
        await saveEntry(entry);
        console.log('✅ Pre-navigation save completed');
      } catch (error) {
        console.error('❌ Pre-navigation save failed:', error);
      }
    }
    
    // Pop back to SwipeableScreens (which contains NotesScreen)
    (navigation as any).goBack();
    
    // Reset navigation flag after a short delay
    setTimeout(() => setIsNavigating(false), 500);
  }, [navigation, isNavigating, entry, saveEntry]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      // Track horizontal swipe to the right (positive translationX)
      // More restrictive conditions to prevent accidental navigation
      if (event.translationX > 150 && 
          Math.abs(event.velocityX) > 800 && 
          Math.abs(event.translationY) < 100 && // Ensure it's mostly horizontal
          !isNavigating) {
        runOnJS(navigateToNotes)();
      }
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

  const checkIconAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: translateY.value >= TRIGGER_THRESHOLD ? 1 : 0,
    };
  });

  const arrowIconAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: translateY.value >= TRIGGER_THRESHOLD ? 0 : 1,
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

  const micButtonAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: micButtonOpacity.value,
      transform: [
        { translateX: micButtonTranslateX.value },
        { translateY: micButtonTranslateY.value },
      ],
    };
  });

  const spinnerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${spinnerRotation.value}deg` }],
    };
  });

  return (
    <View style={[styles.container, { backgroundColor: 'black' }]}>

      {/* Floating text that follows the gesture */}
      <Animated.View style={[styles.floatingText, textAnimatedStyle]}>
        <Text style={styles.instructionText}>Swipe down to create</Text>
        <View style={{ position: 'relative' }}>
          <Animated.View style={arrowIconAnimatedStyle}>
            <ArrowDown size={24} color={'white'} />
          </Animated.View>
          <Animated.View style={[{ position: 'absolute', top: 0, left: 0 }, checkIconAnimatedStyle]}>
            <Check size={24} color={'white'} />
          </Animated.View>
        </View>
      </Animated.View>

      {/* Main content that slides down */}
      <GestureDetector gesture={panGesture}>
        <PanGestureHandler onGestureEvent={gestureHandler}>
          <Animated.View style={[styles.mainContent, animatedStyle, curvedEdgesStyle]}>
          <Animated.View style={[styles.safeArea, { backgroundColor: colors.background }, curvedEdgesStyle]}>
               {/* Minimal Header - Full width at top */}
               <View style={[styles.minimalHeader, { 
                 backgroundColor: colors.background,
                 paddingTop: useSafeAreaInsets().top + 10,
               }]}>
                 <TouchableOpacity 
                   onPress={async () => {
                     if (isNavigating) return;
                     setIsNavigating(true);
                     
                     // Force save before back navigation
                     const currentContent = entry.trim();
                     if (currentContent && currentContent.length >= 1) {
                       // Clear any pending auto-save and mark to skip cleanup save
                       if (saveTimeoutRef.current) {
                         clearTimeout(saveTimeoutRef.current);
                       }
                       skipExitSaveRef.current = true;
                       try {
                         await saveEntry(entry);
                         console.log('✅ Back button save completed');
                       } catch (error) {
                         console.error('❌ Back button save failed:', error);
                       }
                     }
                     
                     (navigation as any).goBack();
                     setTimeout(() => setIsNavigating(false), 500);
                   }}
                   style={styles.backButton}
                 >
                   <ChevronLeft size={24} color={colors.text} style={{ opacity: 0.5 }} />
                 </TouchableOpacity>
                 
                 <View style={styles.headerCenter}>
                   <Text style={[styles.headerTitle, { color: colors.text }]}>Note</Text>
                 </View>
                 
                 <View style={styles.headerRight}>
                   {getSaveStatusIcon()}
                 </View>
               </View>

               {/* Content */}
               <SafeAreaView style={styles.safeAreaInner}>
               <View style={styles.content}>
                 {/* Thoughts Section */}
                <View style={{ flex: 1, marginBottom: isKeyboardVisible ? 200 : 20, paddingBottom: 40, width: '100%', overflow: 'hidden' }}>
                  <EditorErrorBoundary>
                    <Editor
                      key={`editor-${latestEntry?.id || 'new'}`} // Force re-render for new entries
                      ref={editorRef}
                      content={entry}
                      onUpdate={handleContentChange}
                      isLoaded={setEditorLoaded}
                      getAuthToken={getToken}
                      apiBaseUrl={process.env.EXPO_PUBLIC_API_URL}
                      keyboardHeight={keyboardHeight}
                      isKeyboardVisible={isKeyboardVisible}
                      onActiveFormatsChange={setActiveFormats}
                    />
                  </EditorErrorBoundary>
                </View>
               </View>
               </SafeAreaView>
               {/* <TouchableOpacity
                 style={{ position: 'absolute', bottom: 50, right: 20, paddingHorizontal: 15, paddingVertical: 15, backgroundColor: colors.text, borderRadius: 24 }}
                 onPress={() => {
                   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                 }}
               >
                 <AudioLines size={24} color={colors.background} />
               </TouchableOpacity> */}

            {/* Floating Microphone Button */}
            <Animated.View 
              style={[
                styles.floatingMicButton, 
                micButtonAnimatedStyle,
                { backgroundColor: colors.tint }
              ]}
            >
              <TouchableOpacity
                style={styles.micButtonTouchable}
                onPress={() => {
                  if (isRecording) {
                    stopRecordingAndTranscribe();
                  } else {
                    startRecording();
                  }
                }}
                disabled={isTranscribing}
                activeOpacity={0.8}
              >
                {isRecording ? (
                  <Square
                    size={20}
                    color={colorScheme === 'dark' ? '#666666' : '#ffffff'}
                  />
                ) : (
                  <Mic
                    size={20}
                    color={colorScheme === 'dark' ? '#666666' : '#ffffff'}
                  />
                )}
              </TouchableOpacity>
            </Animated.View>



          </Animated.View>
        </Animated.View>
        </PanGestureHandler>
      </GestureDetector>

      {/* Keyboard Toolbar - Outside of any container for proper positioning */}
                  <KeyboardToolbar
              isVisible={isKeyboardVisible}
              onFormatText={(formatType, prefix, suffix) => {
                editorRef.current?.formatText(formatType, prefix, suffix);
              }}
              keyboardHeight={keyboardHeight}
              activeFormats={activeFormats}
            />
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
  minimalHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0, 0, 0, 0.07)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  backButton: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    width: 44, // Fixed width for consistent spacing
  },
  headerCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRight: {
    width: 44, // Same width as back button for balance
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerTitle: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 24,
    color: 'rgba(0, 0, 0, 0.60)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    width: '100%',
    maxWidth: '100%',
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
  keyboardAvoidingContainer: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  floatingMicButton: {
    position: 'absolute',
    right: 20,
    bottom: 40, // Moved down to navigation buttons level
    width: 44,
    height: 44,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  micButtonTouchable: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
}); 