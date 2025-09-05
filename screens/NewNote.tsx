import Editor, { EditorRef } from '@/components/ArdaEditor';
import EditorErrorBoundary from '@/components/EditorErrorBoundary';
import KeyboardToolbar from '@/components/KeyboardToolbar';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { getCoachingMessage } from '@/lib/firestore';
import { BackendCoachingMessage } from '@/types/coachingMessage';
import { db } from '@/lib/firebase';
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
import { AlignLeft, ArrowDown, Check, Mic, Square, MessageCircle, Settings2, Plus, Loader2, FileText } from 'lucide-react-native';
import { useAudioTranscriptionAv } from '@/hooks/useAudioTranscriptionAv';
import { Button } from '@/components/ui/Button';
import CoachingSessionCard from '@/components/CoachingSessionCard';
import CoachingMessageCard from '@/components/CoachingMessageCard';
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

interface CoachingSession {
  id: string;
  sessionType: 'default-session' | 'initial-life-deep-dive';
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
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
  


  // Coaching session state
  const [coachingSessionData, setCoachingSessionData] = useState<CoachingSession | null>(null);
  const [loadingCoachingSession, setLoadingCoachingSession] = useState(false);
  
  // Coaching message state
  const [coachingMessageData, setCoachingMessageData] = useState<BackendCoachingMessage | null>(null);
  const [loadingCoachingMessage, setLoadingCoachingMessage] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<string>('');
  const editorRef = useRef<EditorRef>(null);

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

      // Clear the route params to prevent re-loading on re-renders
      navigation.setParams({ selectedEntry: undefined } as any);
    } else if (createNew) {
      // Create a new entry when explicitly requested
      createNewEntry();

      // Clear the route params to prevent re-loading on re-renders
      navigation.setParams({ createNew: undefined } as any);
    }
  }, [route.params, navigation, createNewEntry]);

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

        // Track journal entry update (for all entries, regardless of size)
        trackEntryUpdated({
          entry_id: latestEntry.id,
          content_length: content.length,
        });
      } else {
        // Create new entry in database using the pre-generated ID
        const entryId = latestEntry?.id || Crypto.randomUUID();
        const newEntry = {
          uid: firebaseUser.uid,
          content,
          timestamp: serverTimestamp(),
          lastUpdated: serverTimestamp()
        };

        const docRef = doc(db, 'journal_entries', entryId);
        await setDoc(docRef, newEntry);

        // Track journal entry creation (for all entries, regardless of size)
        trackEntryCreated({
          entry_id: entryId,
        });

        // Update local state with new entry info from database (keep the same ID)
        setLatestEntry({
          id: entryId,
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

  // Fetch latest entry when Firebase is ready
  useEffect(() => {
    if (isFirebaseReady) {
      fetchLatestEntry();
    }
  }, [fetchLatestEntry, isFirebaseReady]);

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

  // Reset navigation state when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setIsNavigating(false);
    }, [])
  );

  // Fetch coaching session data - stable callback like web app
  const fetchCoachingSession = useCallback(async (sessionId: string) => {
    if (!sessionId || !firebaseUser) {
      console.log('⏭️ Skipping coaching session fetch - no sessionId or firebaseUser');
      return;
    }

    setLoadingCoachingSession(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('No auth token');

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}api/coaching/sessions?sessionId=${encodeURIComponent(sessionId)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.warn('Coaching session not found:', sessionId);
          setCoachingSessionData(null);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.session) {
        setCoachingSessionData({
          ...result.session,
          createdAt: new Date(result.session.createdAt),
          updatedAt: new Date(result.session.updatedAt),
          messages: result.session.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        });
      } else {
        setCoachingSessionData(null);
      }
    } catch (error) {
      console.error('Error fetching coaching session:', error);
      setCoachingSessionData(null);
    } finally {
      setLoadingCoachingSession(false);
    }
  }, [getToken, firebaseUser]); // Include firebaseUser dependency

  // Fetch coaching message data - similar to web app
  const fetchCoachingMessage = useCallback(async (messageId: string) => {
    if (!messageId) return;

    setLoadingCoachingMessage(true);
    try {
      // Use local firestore function
      const coachingMessage = await getCoachingMessage(messageId);
      if (coachingMessage) {
        setCoachingMessageData(coachingMessage);
      } else {
        console.warn('Coaching message not found:', messageId);
        setCoachingMessageData(null);
      }
    } catch (error) {
      console.error('Error fetching coaching message:', error);
      setCoachingMessageData(null);
    } finally {
      setLoadingCoachingMessage(false);
    }
  }, []);

  // Handle opening coaching session
  const handleOpenCoachingSession = useCallback(async () => {
    if (coachingSessionData?.id) {
      if (!initialized) return; // Wait for RevenueCat init
      
      if (!isPro) {
        const unlocked = await presentPaywallIfNeeded('reflecta_pro', currentOffering || undefined);
        console.log('🎤 Coaching session access Pro check:', unlocked ? 'unlocked' : 'cancelled');
        if (!unlocked) return; // Don't navigate if paywall was cancelled
      }
      
      (navigation as any).navigate('Coaching', {
        sessionId: coachingSessionData.id,
        sessionType: coachingSessionData.sessionType
      });
    }
  }, [navigation, coachingSessionData, initialized, isPro, presentPaywallIfNeeded, currentOffering]);

  // Check for linked coaching content when current entry changes - exactly like web app
  useEffect(() => {
    const linkedSessionId = latestEntry?.linkedCoachingSessionId;
    const linkedMessageId = latestEntry?.linkedCoachingMessageId;

    // Handle coaching session linking
    if (linkedSessionId && linkedSessionId !== coachingSessionData?.id) {
      // Only fetch if we don't already have this session data
      fetchCoachingSession(linkedSessionId);
    } else if (!linkedSessionId) {
      setCoachingSessionData(null);
    }
    
    // Handle coaching message linking
    if (linkedMessageId && linkedMessageId !== coachingMessageData?.id) {
      // Only fetch if we don't already have this message data
      fetchCoachingMessage(linkedMessageId);
    } else if (!linkedMessageId) {
      setCoachingMessageData(null);
    }
  }, [latestEntry?.linkedCoachingSessionId, latestEntry?.linkedCoachingMessageId, fetchCoachingSession, fetchCoachingMessage, coachingSessionData?.id, coachingMessageData?.id]);

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
  
  const navigateToNotes = useCallback(() => {
    if (isNavigating) return; // Prevent multiple navigation calls
    
    setIsNavigating(true);
    // Navigate back to SwipeableScreens (which contains NotesScreen)
    (navigation as any).navigate('SwipeableScreens');
    
    // Reset navigation flag after a short delay
    setTimeout(() => setIsNavigating(false), 500);
  }, [navigation, isNavigating]);

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
                   onPress={() => {
                     if (isNavigating) return;
                     setIsNavigating(true);
                     (navigation as any).navigate('SwipeableScreens');
                     setTimeout(() => setIsNavigating(false), 500);
                   }}
                   style={styles.backButton}
                 >
                   <AlignLeft size={24} color={colors.text} style={{ opacity: 0.5 }} />
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

                {/* Coaching Session Card - Show when current entry has linked session */}
                {(coachingSessionData || loadingCoachingSession) && (
                  <CoachingSessionCard
                    title={coachingSessionData?.sessionType === 'initial-life-deep-dive' ? 'Life Deep Dive Session' : 'Goal breakout session'}
                    messageCount={coachingSessionData?.messages?.length || 0}
                    sessionType={coachingSessionData?.sessionType === 'initial-life-deep-dive' ? 'Initial Life Deep Dive' : 'Coach chat'}
                    onOpenConversation={handleOpenCoachingSession}
                    loading={loadingCoachingSession}
                  />
                )}
                
                {/* Coaching Message Card - Show when current entry has linked coaching message */}
                {(coachingMessageData || loadingCoachingMessage) && (
                  <CoachingMessageCard
                    pushText={coachingMessageData?.pushNotificationText}
                    fullMessage={coachingMessageData?.messageContent}
                    messageType={coachingMessageData?.messageType}
                    loading={loadingCoachingMessage}
                  />
                )}

                {/* Thoughts Section */}
                <View style={{ flex: 1, marginBottom: isKeyboardVisible ? 200 : 20, paddingBottom: 40, width: '100%', overflow: 'hidden' }}>
                  <EditorErrorBoundary>
                                    <Editor
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
    paddingBottom: 31,
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