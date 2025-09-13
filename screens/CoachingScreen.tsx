import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StyleSheet, Text, TextInput, View, useColorScheme, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Mic, X, Check, ArrowUp, ArrowDown, Square } from 'lucide-react-native';
import * as Crypto from 'expo-crypto';
import { Colors } from '@/constants/Colors';
import { AppStackParamList } from '@/navigation/AppNavigator';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Button } from '@/components/ui/Button';
import { useAICoaching, CoachingMessage } from '@/hooks/useAICoaching';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAudioTranscription } from '@/hooks/useAudioTranscription';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { useFocusEffect } from '@react-navigation/native';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { CoachingCardRenderer, parseCoachingCompletion, getDisplayContent, CoachingCardRendererProps } from '@/components/coaching/CoachingCardRenderer';
import { loadMessagesFromFirestore, saveMessagesToFirestore, initializeCoachingSession } from '@/services/coachingFirestore';
import { useCoachingScroll } from '@/hooks/useCoachingScroll';
import { SpinningAnimation } from '@/components/coaching/ui/SpinningAnimation';
import { ModernSpinner } from '@/components/coaching/ui/ModernSpinner';
import { DateSeparator } from '@/components/coaching/ui/DateSeparator';
import { AnimatedTypingIndicator } from '@/components/coaching/ui/AnimatedTypingIndicator';
import { AudioLevelIndicator } from '@/components/coaching/ui/AudioLevelIndicator';
import { RecordingTimer } from '@/components/coaching/ui/RecordingTimer';
import { ErrorMessage } from '@/components/coaching/ui/ErrorMessage';
import CoachingErrorBoundary from '@/components/coaching/CoachingErrorBoundary';
import { betterStackLogger } from '@/services/betterStackLogger';

type CoachingScreenNavigationProp = NativeStackNavigationProp<AppStackParamList, 'SwipeableScreens'>;


export default function CoachingScreen() {
  const navigation = useNavigation<CoachingScreenNavigationProp>();
  const route = useRoute();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const { user, firebaseUser, getToken } = useAuth();
  const { 
    trackCoachingSessionStarted, 
    trackCoachingSessionCompleted,
    trackEntryCreated
  } = useAnalytics();
  const { isPro, presentPaywallIfNeeded, currentOffering, initialized } = useRevenueCat(firebaseUser?.uid);

  // Route parameters not used in current implementation

  // Use Clerk userId as session ID (single session per user) - consistent with backend
  const getSessionId = (): string => {
    const sessionId = user?.id || 'anonymous';
    console.log('🔑 [SESSION ID] Current session ID (Clerk):', sessionId);
    return sessionId;
  };


  // Clear coaching data for specific user with full state reset
  const clearCoachingDataForUser = useCallback(async (userId: string) => {
    try {
      console.log('🧹 Clearing coaching state for user:', userId);
      
      // Reset all coaching-related states
      setMessages([]);
      setAllMessages([]);
      setDisplayedMessageCount(300);
      setHasMoreMessages(false);
      setIsLoadingMore(false);
      setShowCompletionForMessage(null);
      setParsedCoachingData(null);
      setIsInitialized(false);
      
      console.log('✅ Coaching state cleared for user:', userId);
    } catch (error) {
      console.error('❌ Error clearing coaching state for user:', userId, error);
    }
  }, []);





  // Use the AI coaching hook
  const coachingHook = useAICoaching();
  const { messages, isLoading, sendMessage, setMessages, progress, stopGeneration, resendMessage, error } = coachingHook;
  
  // Test function to clear all coaching data
  const clearAllCoachingData = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      console.log('🧹 Clearing all coaching data...');
      
      // Clear Firestore coaching session
      const { db } = await import('../lib/firebase');
      const { collection, query, where, getDocs, deleteDoc } = await import('firebase/firestore');
      
      const sessionsRef = collection(db, 'coachingSessions');
      const sessionQuery = query(
        sessionsRef,
        where('userId', '==', user.id),
        where('sessionType', '==', 'default-session')
      );
      
      const sessionSnapshot = await getDocs(sessionQuery);
      
      for (const doc of sessionSnapshot.docs) {
        await deleteDoc(doc.ref);
        console.log('🗑️ Deleted Firestore session:', doc.id);
      }
      
      // Reset messages to welcome message
      const initialMessage: CoachingMessage = {
        id: '1',
        content: `Hello ${user?.firstName || 'there'}!\n\nI'm here to support your growth and reflection. What's on your mind today? Feel free to share anything that's weighing on you, exciting you, or simply present in your awareness right now.`,
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages([initialMessage]);
      
      console.log('✅ All coaching data cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing coaching data:', error);
    }
  }, [firebaseUser, user?.firstName, setMessages]);

  // Manual refresh from Firestore
  const refreshFromFirestore = useCallback(async () => {
    if (!user?.id) {
      console.warn('⚠️ Cannot refresh from Firestore: no user');
      return;
    }

    try {
      console.log('🔄 Manual refresh from Firestore requested for user:', user.id);
      
      // Re-initialize session from Firestore
      const sessionMessages = await initializeCoachingSession(
        user.id,
        setAllMessages,
        setHasMoreMessages,
        setDisplayedMessageCount,
        setMessages,
        getToken
      );
      
      if (sessionMessages.length > 0) {
        setMessages(sessionMessages);
        console.log(`✅ Refreshed with ${sessionMessages.length} messages from Firestore`);
      } else {
        console.log('📝 No session found in Firestore');
        // Show welcome message if no session exists
        const welcomeMessage: CoachingMessage = {
          id: '1',
          content: `Hello ${user?.firstName || 'there'}!\n\nI'm here to support your growth and reflection. What's on your mind today? Feel free to share anything that's weighing on you, exciting you, or simply present in your awareness right now.`,
          role: 'assistant',
          timestamp: new Date()
        };
        setMessages([welcomeMessage]);
      }
    } catch (error) {
      console.error('❌ Error refreshing from Firestore:', error);
    }
  }, [user?.id, setMessages, initializeCoachingSession, user?.firstName]);

  // Debug functions available in development
  if (__DEV__) {
    (global as any).clearCoachingData = clearAllCoachingData;
    (global as any).refreshCoachingFromFirestore = refreshFromFirestore;
  }
  
  const [chatInput, setChatInput] = useState('');
  const [isChatInputFocused, setIsChatInputFocused] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputHeight, setInputHeight] = useState(24); // Initial height for minimum 1 line
  const [containerHeight, setContainerHeight] = useState(90); // Dynamic container height
  const [isInputExpanded, setIsInputExpanded] = useState(false); // Expand durumu
  const [currentLineCount, setCurrentLineCount] = useState(1); // Current line count
  const [showCompletionForMessage, setShowCompletionForMessage] = useState<string | null>(null);
  const [sessionStartTime] = useState(new Date());
  const [completionStats, setCompletionStats] = useState({
    minutes: 0,
    words: 0,
    keyInsights: 0
  });
  const [parsedCoachingData, setParsedCoachingData] = useState<{
    components: Array<{ type: string; props: Record<string, string> }>;
    rawData: string;
  } | null>(null);

  // Enhanced loading state management
  const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);

  // Track AI response state more reliably
  const [aiResponseStarted, setAiResponseStarted] = useState(false);

  // Error handling state
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);

  // Log AI errors to BetterStack (only actual errors, not session events)
  useEffect(() => {
    if (error) {
      console.error('🚨 AI error detected:', error);
      
      // Only log actual errors to BetterStack
      betterStackLogger.logInfo('AI response error occurred', {
        userId: user?.id,
        sessionId: getSessionId(),
        category: 'AIError',
        metadata: {
          error: error,
          platform: 'mobile'
        }
      });
    }
  }, [error]);


  // Pagination state for message loading
  const [allMessages, setAllMessages] = useState<CoachingMessage[]>([]);
  const [displayedMessageCount, setDisplayedMessageCount] = useState(300);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const MESSAGES_PER_PAGE = 100;
  
  // Throttling for pagination to prevent multiple rapid calls
  const lastLoadTimeRef = useRef<number>(0);
  const LOAD_THROTTLE_MS = 1000; // 1 second between loads

  // ========================================================================
  // PAGINATION SYSTEM - LOAD MORE MESSAGES
  // ========================================================================
  // Implements pull-to-refresh style pagination for loading older messages
  // Loads messages in chunks when user scrolls to top of conversation
  // ========================================================================
  const loadMoreMessages = useCallback(async () => {
    // Prevent concurrent loading or loading when no more messages available
    if (isLoadingMore || !hasMoreMessages) return;
    
    setIsLoadingMore(true);
    console.log(`🔄 Starting to load ${MESSAGES_PER_PAGE} more messages...`);
    
    try {
      // Add delay for user feedback (shows loading spinner)
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Calculate new message count (current + page size, but not exceeding total)
      const newCount = Math.min(displayedMessageCount + MESSAGES_PER_PAGE, allMessages.length);
      
      // Get messages from the end (newest first display, so slice from end)
      const messagesToShow = allMessages.slice(-newCount);
      
      // Update state with new message set
      setMessages(messagesToShow);
      setDisplayedMessageCount(newCount);
      setHasMoreMessages(newCount < allMessages.length); // Check if more messages exist
      
      console.log(`✅ Loaded ${MESSAGES_PER_PAGE} more messages (${newCount}/${allMessages.length} total)`);
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      // Brief delay before hiding loading indicator for smooth UX
      setTimeout(() => {
        setIsLoadingMore(false);
      }, 200);
    }
  }, [isLoadingMore, hasMoreMessages, displayedMessageCount, allMessages, MESSAGES_PER_PAGE, setMessages]);

  // Deduplicate messages by ID to prevent duplicates
  const deduplicateMessages = useCallback((messages: CoachingMessage[]) => {
    const seen = new Set<string>();
    const deduplicated = messages.filter(msg => {
      if (seen.has(msg.id)) {
        console.log('🔄 [DEDUP] Removing duplicate message:', msg.id);
        return false;
      }
      seen.add(msg.id);
      return true;
    });
    
    if (deduplicated.length !== messages.length) {
      console.log(`🔄 [DEDUP] Removed ${messages.length - deduplicated.length} duplicate messages`);
    }
    
    return deduplicated;
  }, []);

  // Group messages by date and insert separators
  const getMessagesWithSeparators = useCallback((messages: CoachingMessage[]) => {
    if (messages.length === 0) return [];
    
    // First deduplicate messages
    const deduplicatedMessages = deduplicateMessages(messages);
    
    const result: Array<CoachingMessage | { type: 'separator'; date: Date; id: string }> = [];
    let lastDate: string | null = null;
    
    deduplicatedMessages.forEach((message, index) => {
      const messageDate = new Date(message.timestamp).toDateString();
      
      // Add separator if this is a new day
      if (messageDate !== lastDate) {
        result.push({
          type: 'separator',
          date: new Date(message.timestamp),
          id: `separator-${messageDate}-${index}`
        });
        lastDate = messageDate;
      }
      
      result.push(message);
    });
    
    return result;
  }, [deduplicateMessages]);

  // Track when AI response actually starts
  useEffect(() => {
    if (isLoading) {
      setShowLoadingIndicator(true);
    } else {
      // Shorter delay for more responsive UI
      const timer = setTimeout(() => {
        setShowLoadingIndicator(false);
      }, 200); // Reduced from 500ms to 200ms
      
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Monitor when AI response actually starts
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const isLastMessageAI = lastMessage?.role === 'assistant';
      
      if (isLastMessageAI && isLoading) {
        // AI response has started
        setAiResponseStarted(true);
      } else if (!isLoading && aiResponseStarted) {
        // AI response has completed
        setAiResponseStarted(false);
      }
    }
  }, [messages, isLoading, aiResponseStarted]);

  // Enhanced loading indicator logic - memoized for performance
  const shouldShowLoadingIndicator = useMemo(() => {
    return isLoading || (aiResponseStarted && messages.length > 0);
  }, [isLoading, aiResponseStarted, messages.length]);
  
  // Dynamic input constants
  const LINE_HEIGHT = 24;
  const MIN_LINES = 1;
  const MAX_LINES = 10;
  const EXPANDED_MAX_LINES = 18; // Maximum lines when expanded
  const INPUT_PADDING_VERTICAL = 8;
  const CONTAINER_BASE_HEIGHT = 90; // Minimum container height
  const CONTAINER_PADDING = 40; // Total container padding (8+20+12)

  // Use the coaching scroll hook
  const scrollHook = useCoachingScroll({
    messages,
    isLoading,
    shouldShowLoadingIndicator,
    progress
  });

  const {
    contentHeight,
    scrollViewHeight,
    showScrollToBottom,
    scrollViewRef,
    messageRefs,
    scrollToNewMessageRef,
    targetScrollPosition,
    hasUserScrolled,
    didInitialAutoScroll,
    dynamicContentHeight,
    dynamicBottomPadding,
    scrollLimits,
    setContentHeight,
    setScrollViewHeight,
    setShowScrollToBottom,
    scrollToShowLastMessage,
    handleScrollToBottom: hookHandleScrollToBottom,
    handleScroll: hookHandleScroll,
    debugLog
  } = scrollHook;

  // Coaching card renderer props - memoized for performance
  const coachingCardRendererProps: CoachingCardRendererProps = useMemo(() => ({
    messages,
    setMessages,
    firebaseUser,
    getToken,
    saveMessagesToFirestore
  }), [messages, setMessages, firebaseUser, getToken, saveMessagesToFirestore]);




  // Use the audio transcription hook
  const {
    isRecording,
    isTranscribing,
    recordingStartTime,
    audioLevel,
    startRecording,
    stopRecordingAndTranscribe,
    cancelRecording,
  } = useAudioTranscription({
    onTranscriptionComplete: async (transcription) => {
      const existingText = chatInput.trim();
      const newText = existingText 
        ? `${existingText} ${transcription}` 
        : transcription;
      
      // Set the text first
      setChatInput(newText);
      handleTextChange(newText);
      
      // Auto-send the transcribed message
      if (newText.trim().length > 0) {
        console.log('🎤 Auto-sending transcribed message:', newText);
        
        // Use userId as session ID (single session per user)
        const currentSessionId = getSessionId();
        
        // Track coaching session activity
        trackCoachingSessionStarted({
          session_id: currentSessionId,
          session_type: 'regular',
          trigger: 'manual',
        });

        // Session start logging removed - only errors go to BetterStack

        // Clear input immediately
        setChatInput('');
        setInputHeight(24); // Reset to minimum height
        setContainerHeight(90); // Reset container height
        setIsInputExpanded(false);
        setCurrentLineCount(1);
        
        // Set positioning flag
        hasUserScrolled.current = false;
        scrollToNewMessageRef.current = true;

        // Send the message
        await sendMessage(newText, currentSessionId, {
          sessionType: 'default-session'
        });
      }
    },
    onTranscriptionError: (error) => {
      console.error('Transcription error:', error);
    },
  });

  const textInputRef = useRef<TextInput>(null);

  const paywallShownRef = useRef<boolean>(false);
  const accessCheckedRef = useRef<boolean>(false);
  
  // Gate access: ALL coaching requires Pro. Run once per focus, after RevenueCat initialized.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const check = async () => {
        if (accessCheckedRef.current) return;
        if (!initialized) return; // wait for RC init
        accessCheckedRef.current = true;
        // Prevent multiple paywall presentations
        if (paywallShownRef.current) {
          return;
        }
        
        // console.log('🔒 Coaching access check:', { isPro, routeSessionId });
        if (!isPro) {
          // console.log('🚫 Not Pro, showing paywall');
          paywallShownRef.current = true;
          const unlocked = await presentPaywallIfNeeded('reflecta_pro', currentOffering || undefined);
          if (!unlocked && !cancelled) {
            // console.log('🔙 Paywall cancelled, going back');
            navigation.goBack();
          } else if (unlocked) {
            // console.log('✅ Pro unlocked via paywall');
            // Reset flag so future navigation works
            paywallShownRef.current = false;
          }
        } else {
          // console.log('✅ Pro user, allowing access');
        }
      };
      check();
      return () => { cancelled = true; accessCheckedRef.current = false; };
    }, [initialized, isPro, presentPaywallIfNeeded, currentOffering, navigation])
  );

  // Track session completion when user leaves the screen (only once)
  const sessionCompletedRef = useRef(false);
  const messagesRef = useRef(messages);
  const sessionStartRef = useRef(sessionStartTime);
  
  // Keep refs updated
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  
  useFocusEffect(
    useCallback(() => {
      // Reset completion flag when entering screen
      sessionCompletedRef.current = false;
      
      // Real-time listener handles updates automatically, no manual refresh needed
      console.log('🔄 CoachingScreen focused - real-time listener will handle updates');
      
      // Cleanup function that runs when leaving the screen
      return () => {
        const currentSessionId = getSessionId();
        if (currentSessionId && currentSessionId !== 'anonymous' && !sessionCompletedRef.current) {
          sessionCompletedRef.current = true; // Prevent multiple calls
          
          const sessionMinutes = Math.max(Math.floor((Date.now() - sessionStartRef.current.getTime()) / (1000 * 60)), 1);
          const messageCount = messagesRef.current.length;
          const totalWords = messagesRef.current.reduce((total, msg) => {
            if (msg.role === 'user') {
              return total + msg.content.split(/\s+/).filter(word => word.length > 0).length;
            }
            return total;
          }, 0);

          // Log coaching session completion (only once)
          console.log('✅ [COACHING] Regular coaching session completed (user left screen)', {
            sessionId: currentSessionId,
            duration: sessionMinutes,
            messageCount: messageCount,
            wordsWritten: totalWords
          });

          // Track coaching session completion
          trackCoachingSessionCompleted({
            session_id: currentSessionId,
            duration_minutes: sessionMinutes,
            message_count: messageCount,
            words_written: totalWords,
            insights_generated: 0,
            session_type: 'regular',
          });

          // Session completion logging removed - only errors go to BetterStack
        }
      };
    }, [firebaseUser?.uid, setMessages])
  );

  // Session ID is derived from user.id (Clerk) - no useEffect needed

  // Track current user to detect user switches
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Load conversation history from local storage or show welcome message
  const [isInitialized, setIsInitialized] = useState(false);
  const initializationInProgress = useRef(false);
  
  // Handle user switching - clear state when user changes
  useEffect(() => {
    const newUserId = user?.id || null;
    
    if (currentUserId && newUserId && currentUserId !== newUserId) {
      // User switched - clear previous user's state and reset initialization
      console.log('👤 User switched detected:', currentUserId, '→', newUserId);
      clearCoachingDataForUser(currentUserId);
      setIsInitialized(false); // Force re-initialization for new user
    } else if (currentUserId && !newUserId) {
      // User logged out - clear current user's state
      console.log('🚪 User logged out, clearing state for:', currentUserId);
      clearCoachingDataForUser(currentUserId);
      setIsInitialized(false);
    }
    
    setCurrentUserId(newUserId);
  }, [user?.id, currentUserId, clearCoachingDataForUser]);

  // Real-time listener for coaching session - ONLY during active messaging
  const realTimeListenerActive = useRef(false);
  
  useEffect(() => {
    // Only use real-time listener when not actively messaging (isLoading = false)
    // This prevents conflicts with useAICoaching's state management
    if (!user?.id || !isInitialized || isLoading) return;

    // Prevent multiple listeners
    if (realTimeListenerActive.current) return;
    
    console.log('🔄 [REALTIME] Setting up real-time listener for session:', user.id);
    realTimeListenerActive.current = true;

    const unsubscribe = onSnapshot(
      doc(db, 'coachingSessions', user.id),
      (docSnap) => {
        // Skip updates if currently messaging to avoid conflicts
        if (isLoading) {
          console.log('🔄 [REALTIME] Skipping update - messaging in progress');
          return;
        }
        
        if (docSnap.exists()) {
          console.log('🔄 [REALTIME] Session updated, refreshing messages...');
          const sessionData = docSnap.data();
          const messages = sessionData.messages || [];
          
          // Convert to our message format
          const firestoreMessages: CoachingMessage[] = messages.map((msg: any, index: number) => ({
            id: msg.id || `msg_${index}`,
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content || '',
            timestamp: msg.timestamp ? new Date(msg.timestamp.seconds * 1000) : new Date()
          }));
          
          // Only update if message count changed (prevent unnecessary re-renders)
          if (firestoreMessages.length !== messages.length) {
            setAllMessages(firestoreMessages);
            setMessages(firestoreMessages.slice(-30)); // Show last 30 messages
            setDisplayedMessageCount(Math.min(30, firestoreMessages.length));
            setHasMoreMessages(firestoreMessages.length > 30);
            
            console.log(`✅ [REALTIME] Updated with ${firestoreMessages.length} messages from real-time listener`);
          }
        } else {
          console.log('🔄 [REALTIME] No session document found');
        }
      },
      (error) => {
        console.error('❌ [REALTIME] Error in real-time listener:', error);
        realTimeListenerActive.current = false;
      }
    );

    return () => {
      console.log('🧹 [REALTIME] Cleaning up real-time listener');
      realTimeListenerActive.current = false;
      unsubscribe();
    };
  }, [user?.id, isInitialized, isLoading, messages.length]);
  
  useEffect(() => {
    if (!user?.id || isInitialized || initializationInProgress.current) return;
    
    const initializeChat = async () => {
      // Prevent concurrent initialization
      if (initializationInProgress.current) {
        console.log('⚠️ [COACHING INIT] Initialization already in progress, skipping');
        return;
      }
      
      initializationInProgress.current = true;
      
      console.log('🔄 [COACHING INIT] Starting chat initialization for user:', user!.id);
      console.log('🔄 [COACHING INIT] User details:', {
        uid: user!.id,
        email: firebaseUser?.email,
        firstName: user?.firstName
      });
      
      try {
        // Load existing session from backend (never create from cache)
        console.log('🔄 [COACHING INIT] Calling initializeCoachingSession...');
        const sessionMessages = await initializeCoachingSession(
          user!.id,
          setAllMessages,
          setHasMoreMessages,
          setDisplayedMessageCount,
          setMessages,
          getToken
        );
        
        console.log('🔄 [COACHING INIT] Session initialization result:', {
          messageCount: sessionMessages.length,
          hasMessages: sessionMessages.length > 0
        });
        
        if (sessionMessages.length > 0) {
          // Existing session found - load recent messages
          console.log('✅ [COACHING INIT] Found existing session, loading messages...');
          console.log('✅ [COACHING INIT] Message preview:', {
            firstMessage: {
              id: sessionMessages[0].id,
              role: sessionMessages[0].role,
              contentPreview: sessionMessages[0].content.substring(0, 100) + '...'
            },
            lastMessage: {
              id: sessionMessages[sessionMessages.length - 1].id,
              role: sessionMessages[sessionMessages.length - 1].role,
              contentPreview: sessionMessages[sessionMessages.length - 1].content.substring(0, 100) + '...'
            }
          });
          
          setMessages(sessionMessages);
          console.log(`✅ [COACHING INIT] Successfully loaded existing session with ${sessionMessages.length} messages`);
        } else {
          // No existing session found - show welcome message (session will be created on first user message)
          console.log('📝 [COACHING INIT] No existing session found, creating welcome message');
          const initialMessage: CoachingMessage = {
            id: '1',
            content: `Hello ${user?.firstName || 'there'}!\n\nI'm here to support your growth and reflection. What's on your mind today? Feel free to share anything that's weighing on you, exciting you, or simply present in your awareness right now.`,
            role: 'assistant',
            timestamp: new Date()
          };
          setMessages([initialMessage]);
          console.log('✅ [COACHING INIT] Welcome message created - ready for new session');
        }
        
        setIsInitialized(true);
        console.log('✅ [COACHING INIT] Chat initialization completed successfully');
        
      } catch (error) {
        console.error('❌ [COACHING INIT] Chat initialization failed:', error);
        console.error('❌ [COACHING INIT] Error details:', {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });
        
        // Fallback: show welcome message even on error
        const fallbackMessage: CoachingMessage = {
          id: '1',
          content: `Hello ${user?.firstName || 'there'}!\n\nI'm here to support your growth and reflection. What's on your mind today? Feel free to share anything that's weighing on you, exciting you, or simply present in your awareness right now.`,
          role: 'assistant',
          timestamp: new Date()
        };
        setMessages([fallbackMessage]);
        setIsInitialized(true);
        console.log('🔄 [COACHING INIT] Fallback initialization completed');
      } finally {
        // Always reset initialization flag
        initializationInProgress.current = false;
      }
    };
    
    initializeChat();
    }, [user?.id, isInitialized, setMessages, user?.firstName, initializeCoachingSession]);

  // Debounced save to prevent multiple rapid saves
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveRef = useRef<string>('');
  
  // Save messages to Firestore whenever messages change
  useEffect(() => {
    if (user?.id && messages.length > 0) {
      // Create a hash of current messages to detect actual changes
      const messageHash = `${user.id}-${messages.length}-${messages[messages.length - 1]?.id}`;
      
      console.log('💾 [SAVE] Message save triggered:', {
        userId: user.id,
        messageCount: messages.length,
        messageHash: messageHash,
        isWelcomeOnly: messages.length === 1 && messages[0].id === '1' && messages[0].role === 'assistant',
        isDuplicate: lastSaveRef.current === messageHash
      });
      
      // Skip if this is the same state we just saved
      if (lastSaveRef.current === messageHash) {
        console.log('💾 [SAVE] Skipping save - no changes detected');
        return;
      }
      
      // Don't save just the welcome message
      if (messages.length === 1 && messages[0].id === '1' && messages[0].role === 'assistant') {
        console.log('💾 [SAVE] Skipping save - welcome message only');
        return;
      }
      
      // Clear any pending save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      // Debounce saves by 1 second
      saveTimeoutRef.current = setTimeout(() => {
        console.log('💾 [SAVE] Executing debounced save...');
        
        // Save to Firestore (all messages)
        saveMessagesToFirestore(messages, user.id);
        
        // Update last save hash
        lastSaveRef.current = messageHash;
        
        console.log('💾 [SAVE] Save operation initiated');
      }, 1000);
      
    } else {
      console.log('💾 [SAVE] Save skipped:', {
        hasUser: !!user?.id,
        messageCount: messages.length
      });
    }
  }, [messages, user?.id, saveMessagesToFirestore]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  

  
  

  // ========================================================================
  // POSITION MAINTENANCE DURING AI RESPONSE
  // ========================================================================
  // Maintains user message position while AI is typing to prevent scroll drift
  // FIXED: Recalculates position to maintain exact MESSAGE_TARGET_OFFSET
  // ========================================================================
  useEffect(() => {
    if (isLoading && targetScrollPosition.current !== null && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      
      // Only maintain position for user messages, not during AI response expansion
      if (lastMessage?.role === 'user') {
        const lastMessageRef = messageRefs.current[lastMessage.id];
        
        if (lastMessageRef && scrollViewRef.current && !hasUserScrolled.current) {
          // Simplified positioning - just maintain stored position without complex recalculation
          const maintainedPosition = targetScrollPosition.current;
          if (maintainedPosition !== null) {
            scrollViewRef.current.scrollTo({
              y: maintainedPosition,
              animated: false
            });
            debugLog('🔧 Position maintained during AI response:', maintainedPosition);
          }
        }
      }
    }
  }, [isLoading, messages]);

  // Simplified positioning - removed complex keyboard-based adjustments

  // ========================================================================
  // POSITIONING CLEANUP AFTER AI RESPONSE
  // ========================================================================
  // Clears positioning system after AI response completes
  // SIMPLIFIED: No timer management needed with fixed padding system
  // ========================================================================
  useEffect(() => {
    if (progress === 100) {
      // Immediate cleanup for smoother experience
      targetScrollPosition.current = null;
      hasUserScrolled.current = false;
      debugLog('🧹 Positioning cleared after AI response completion');
      
      // Auto-scroll to show the complete AI response
      setTimeout(() => {
        hookHandleScrollToBottom(true);
      }, 300); // Quick scroll to bottom to show full response
    }
  }, [progress, hookHandleScrollToBottom]);

  // Check for completion when progress reaches 100%
  useEffect(() => {
    if (progress === 100 && !showCompletionForMessage) {
      console.log('🎯 Progress reached 100%! Showing completion popup...');
      
      // Find the final AI message
      const lastAIMessage = [...messages].reverse().find(msg => msg.role === 'assistant');
      
      if (lastAIMessage) {
        // Calculate session statistics
        const sessionEndTime = new Date();
        const sessionDurationMs = sessionEndTime.getTime() - sessionStartTime.getTime();
        const sessionMinutes = Math.round(sessionDurationMs / 60000);
        
        // Count words from user messages
        const userMessages = messages.filter(msg => msg.role === 'user');
        const totalWords = userMessages.reduce((count, msg) => {
          return count + msg.content.trim().split(/\s+/).filter(word => word.length > 0).length;
        }, 0);

        // Parse coaching completion data if available
        const parsedData = parseCoachingCompletion(lastAIMessage.content);
        const keyInsights = Math.max(parsedData.components.length, 3); // Use actual parsed components count
        
        setCompletionStats({
          minutes: Math.max(sessionMinutes, 1),
          words: totalWords,
          keyInsights
        });
        
        // Store parsed coaching data for future use
        setParsedCoachingData(parsedData);
        
        // Show completion popup for this specific message
        setShowCompletionForMessage(lastAIMessage.id);
      }
    }
  }, [progress, showCompletionForMessage, messages, sessionStartTime]);

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

  // Monitor keyboard height
  useEffect(() => {
    const keyboardWillShow = (event: any) => {
      setKeyboardHeight(event.endCoordinates.height);
    };

    const keyboardWillHide = () => {
      setKeyboardHeight(0);
    };

    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      keyboardWillShow
    );
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      keyboardWillHide
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  // Text change handlers for dynamic input
  const handleTextChange = (text: string) => {
    setChatInput(text);
    
    // More precise calculation - word-based line wrapping
    const containerWidth = 380; // chatInputWrapper width
    const containerPadding = 16; // 8px left + 8px right padding
    const textInputPadding = 8; // 4px left + 4px right padding
    
    // First estimate the line count
    const estimatedLines = Math.max(1, text.split('\n').length);
    const isMultiLine = estimatedLines > 1 || text.length > 30; // Earlier multi-line detection
    const expandButtonSpace = isMultiLine ? 36 : 0; // Space for expand button
    const availableWidth = containerWidth - containerPadding - textInputPadding - expandButtonSpace;
    
    // Character width based on font size (fontSize: 15, fontWeight: 400)
    // More conservative calculation - extra margin for words
    const baseCharsPerLine = isMultiLine ? 36 : 42; // Fewer characters in multi-line
    const charsPerLine = baseCharsPerLine;
    
    // Line calculation - including word wrapping
    const textLines = text.split('\n');
    let totalLines = 0;
    
    textLines.forEach(line => {
      if (line.length === 0) {
        totalLines += 1; // Empty line
      } else {
        // Word-based calculation - for risk of long words wrapping
        const words = line.split(' ');
        let currentLineLength = 0;
        let linesForThisTextLine = 1;
        
        words.forEach((word, index) => {
          const wordLength = word.length;
          const spaceNeeded = index > 0 ? 1 : 0; // Space before word (except first)
          
          // If this word won't fit on current line, new line
          if (currentLineLength + spaceNeeded + wordLength > charsPerLine && currentLineLength > 0) {
            linesForThisTextLine++;
            currentLineLength = wordLength;
          } else {
            currentLineLength += spaceNeeded + wordLength;
          }
        });
        
        totalLines += linesForThisTextLine;
      }
    });
    
    // Save line count
    setCurrentLineCount(totalLines);
    
    // Min/Max limits - based on expand state
    const maxLines = isInputExpanded ? EXPANDED_MAX_LINES : MAX_LINES;
    const actualLines = Math.max(MIN_LINES, Math.min(maxLines, totalLines));
    
    // Height calculation
    const newInputHeight = actualLines * LINE_HEIGHT;
    
    // Container height - optimized for real layout
    const topPadding = 12; // TextInput top padding increased
    const bottomPadding = 8;
    const buttonHeight = 32; // Voice/Send button height
    const buttonTopPadding = 8; // Button container padding top
    
    const totalContainerHeight = topPadding + newInputHeight + buttonTopPadding + buttonHeight + bottomPadding;
    const newContainerHeight = Math.max(CONTAINER_BASE_HEIGHT, totalContainerHeight);
    
    setInputHeight(newInputHeight);
    setContainerHeight(newContainerHeight);
  };

  const handleContentSizeChange = (event: any) => {
    const { height } = event.nativeEvent.contentSize;
    
    // Calculate Min/Max heights
    const minHeight = MIN_LINES * LINE_HEIGHT; // 24px
    const maxHeight = MAX_LINES * LINE_HEIGHT; // 240px
    
    // Use real content height but round to LINE_HEIGHT
    const rawHeight = Math.max(minHeight, Math.min(maxHeight, height));
    
    // Round to nearest LINE_HEIGHT multiple (multiples of 24px)
    const roundedLines = Math.round(rawHeight / LINE_HEIGHT);
    const newInputHeight = Math.max(MIN_LINES, Math.min(MAX_LINES, roundedLines)) * LINE_HEIGHT;
    
    // Container height - same calculation as handleTextChange
    const topPadding = 12; // TextInput top padding increased
    const bottomPadding = 8;
    const buttonHeight = 32; // Voice/Send button height
    const buttonTopPadding = 8; // Button container padding top
    
    const totalContainerHeight = topPadding + newInputHeight + buttonTopPadding + buttonHeight + bottomPadding;
    const newContainerHeight = Math.max(CONTAINER_BASE_HEIGHT, totalContainerHeight);
    
    setInputHeight(newInputHeight);
    setContainerHeight(newContainerHeight);
  };

  // Ensure last lines remain visible when input grows to a new line - DISABLED to prevent auto-scroll
  useEffect(() => {
    // Disabled: This was causing unwanted auto-scroll when typing
    // Only scroll if user explicitly wants it, not automatically on input height change
    return;
  }, [inputHeight, containerHeight]);

  // Expand toggle function
  const handleExpandToggle = () => {
    setIsInputExpanded(!isInputExpanded);
    
    // Recalculate based on current text
    setTimeout(() => {
      handleTextChange(chatInput);
    }, 0);
  };

  
  const handleSendMessage = async () => {
    if (chatInput.trim().length === 0) return;

    const messageContent = chatInput.trim();

    // Use userId as session ID (single session per user)
    const currentSessionId = getSessionId();
    
    // Log coaching session (session is always the user ID)
    console.log('🎯 [COACHING] User coaching session...', {
      sessionId: currentSessionId,
      userId: firebaseUser?.uid,
      sessionType: 'single-user-session',
      trigger: 'manual'
    });
    
    // Track coaching session activity
    trackCoachingSessionStarted({
      session_id: currentSessionId,
      session_type: 'regular',
      trigger: 'manual',
    });

    // Session start logging removed - only errors go to BetterStack
    setChatInput('');
    
    // Close keyboard and blur input
    textInputRef.current?.blur();
    Keyboard.dismiss();
    setIsChatInputFocused(false);
    
    // Reset input height and expand state
    setInputHeight(LINE_HEIGHT);
    setContainerHeight(CONTAINER_BASE_HEIGHT);
    setIsInputExpanded(false);
    setCurrentLineCount(1);
    
    // Set positioning flag
    hasUserScrolled.current = false;
    scrollToNewMessageRef.current = true; // This flag will trigger positioning

    debugLog('📤 Sending message, positioning will be triggered');

    await sendMessage(messageContent, currentSessionId, {
        sessionType: 'default-session'
    });
  };

  const handleStopGeneration = () => {
    console.log('🛑 Stopping AI response generation');
    if (stopGeneration) {
      stopGeneration();
    }
    // Focus back to input after stopping
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 100);
  };

  const handleMicrophonePress = () => {
    // Start recording without losing keyboard focus
    const wasInputFocused = isChatInputFocused;
    startRecording();
    
    // Keep input focused if it was focused before
    if (wasInputFocused && textInputRef.current) {
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    }
  };


  const handleRecordingCancel = () => {
    // Remember if input was focused before recording started
    const wasInputFocused = isChatInputFocused;
    cancelRecording();
    
    // Restore focus after canceling recording
    if (wasInputFocused && textInputRef.current) {
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    }
  };

  const handleRecordingConfirm = () => {
    // Remember if input was focused before recording started
    const wasInputFocused = isChatInputFocused;
    stopRecordingAndTranscribe();
    
    // Restore focus after recording ends
    if (wasInputFocused && textInputRef.current) {
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 200);
    }
  };

  // ========================================================================
  // SCROLL-TO-BOTTOM FUNCTIONALITY
  // ========================================================================
  // Intelligently scrolls to show the most recent message
  // Handles different strategies for short vs long messages
  // ========================================================================
  const handleScrollToBottom = (animated: boolean = true) => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const lastMessageRef = messageRefs.current[lastMessage.id];
      
      if (lastMessageRef) {
        // PRECISE POSITIONING: Use actual message dimensions
        lastMessageRef.measureLayout(
          scrollViewRef.current as any,
          (x, y, width, height) => {
            // Determine scroll strategy based on message characteristics
            const isLongResponse = lastMessage.role === 'assistant' && lastMessage.content.length >= 200;
            
            if (isLongResponse) {
              // LONG MESSAGE STRATEGY: Show the end of the message
              // This ensures user sees the conclusion and any coaching cards
              const targetY = Math.max(0, y + height - 300); // Show end with 100px buffer
              scrollViewRef.current?.scrollTo({
                y: targetY,
                animated
              });
            } else {
              // SHORT MESSAGE STRATEGY: Show the entire message with minimal offset
              const targetY = Math.max(0, y - 20); // Small offset from top
              scrollViewRef.current?.scrollTo({
                y: targetY,
                animated
              });
            }
          },
          () => {
            // FALLBACK STRATEGY: Estimation-based positioning
            // Used when measurement fails (rare edge cases)
            const estimatedPosition = Math.max(0, (messages.length - 1) * 80 - 30);
            scrollViewRef.current?.scrollTo({
              y: estimatedPosition,
              animated
            });
          }
        );
      } else {
        // SECONDARY FALLBACK: When message ref is not available
        const estimatedPosition = Math.max(0, (messages.length - 1) * 80 - 30);
        scrollViewRef.current?.scrollTo({
          y: estimatedPosition,
          animated
        });
      }
    } else {
      // EMPTY STATE: Basic scroll to end when no messages
      scrollViewRef.current?.scrollToEnd({ animated });
    }
  };

  // Initial auto-scroll to bottom once after messages initialize
  useEffect(() => {
    if (!isInitialized) return;
    if (didInitialAutoScroll.current) return;
    if (!scrollViewRef.current) return;
    if (messages.length === 0) return;

    // Allow layout to settle, then scroll to last message precisely (no blank overscroll)
    setTimeout(() => {
      if (!hasUserScrolled.current && scrollViewRef.current) {
        hookHandleScrollToBottom(false);
        didInitialAutoScroll.current = true;
      }
    }, 300); // Increased timeout for initial auto-scroll reliability
  }, [isInitialized, messages.length]);

  // ========================================================================
  // SCROLL EVENT HANDLER - MAIN SCROLL LOGIC
  // ========================================================================
  // Handles all scroll-related events including:
  // 1. Manual scroll detection (clears auto-positioning)
  // 2. Pull-to-refresh pagination (loads older messages)
  // 3. Scroll-to-bottom button visibility
  // ========================================================================
  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollY = contentOffset.y;
    
    // ====================================================================
    // MANUAL SCROLL DETECTION
    // ====================================================================
    // Detects when user manually scrolls away from auto-positioned location
    // Clears positioning system to prevent interference with user intent
    // ====================================================================
    if (targetScrollPosition.current !== null) {
      const savedPosition = targetScrollPosition.current;
      const scrollDifference = Math.abs(scrollY - savedPosition);
      
      // If user scrolled more than 50px from saved position, consider it manual
      if (scrollDifference > 50) { // Larger threshold to avoid false positives
        debugLog('👆 User scrolled manually, clearing positioning');
        hasUserScrolled.current = true;
        targetScrollPosition.current = null;
      }
    }
    
    // ====================================================================
    // PULL-TO-REFRESH PAGINATION
    // ====================================================================
    // Triggers loading of older messages when user pulls to very top
    // Implements throttling to prevent rapid consecutive loads
    // ====================================================================
    const isAtVeryTop = scrollY <= 10; // Must be within 10px of absolute top
    const isPullingUp = scrollY < 0; // Negative scroll (over-scroll/bounce)
    const now = Date.now();
    const timeSinceLastLoad = now - lastLoadTimeRef.current;
    
    // Check all conditions for pagination trigger
    if ((isAtVeryTop || isPullingUp) && 
        hasMoreMessages && 
        !isLoadingMore && 
        !isLoading && 
        timeSinceLastLoad > LOAD_THROTTLE_MS) {
      console.log('📄 User pulled to top, loading more messages...');
      lastLoadTimeRef.current = now;
      loadMoreMessages();
    }
    
     // ====================================================================
     // SCROLL-TO-BOTTOM BUTTON VISIBILITY - Simplified
     // ====================================================================
     // Shows button when user can scroll down, but not during AI responses
     // ====================================================================
     if (!isLoading && messages.length > 0) {
       const contentHeight = contentSize.height;
       const screenHeight = layoutMeasurement.height;
       const distanceFromBottom = contentHeight - screenHeight - scrollY;
       
       // Show button when user is more than 150px from bottom (reduced threshold)
       setShowScrollToBottom(distanceFromBottom > 150);
     } else {
       // Hide button during AI responses or when no messages
       setShowScrollToBottom(false);
     }
  };

  // Conversation starters removed - function kept for potential future use
  const handleConversationStarterPress = (starter: string) => {
    setChatInput(starter);
    textInputRef.current?.focus();
  };

  // Handle retry for failed messages
  const handleRetryMessage = async (messageId: string) => {
    if (!user?.id || retryingMessageId) return;
    
    console.log('🔄 [ERROR RETRY] Retrying message:', messageId);
    setRetryingMessageId(messageId);
    
    // Find the original error message for context
    const errorMessage = messages.find(msg => msg.id === messageId && msg.isError);
    
    try {
      const currentSessionId = getSessionId();
      
      // Retry attempt logging removed - only errors go to BetterStack
      
      await resendMessage(messageId, currentSessionId, {
        sessionType: 'default-session'
      });
      
      console.log('✅ [ERROR RETRY] Message retry successful');
      
      // Retry success logging removed - only errors go to BetterStack
      
    } catch (error) {
      console.error('❌ [ERROR RETRY] Message retry failed:', error);
      
      // Log failed retry to BetterStack
      if (error instanceof Error) {
        betterStackLogger.logCoachingError(error, {
          userId: user!.id,
          sessionId: getSessionId(),
          messageId,
          errorType: 'retry_failed',
          userMessage: errorMessage?.originalUserMessage,
          metadata: {
            isRetryAttempt: true,
            originalError: errorMessage?.content,
            platform: 'mobile'
          }
        });
      }
    } finally {
      setRetryingMessageId(null);
    }
  };

  const handleCompletionAction = async () => {
    console.log('User clicked End this session');
    console.log('📊 Session Stats:', completionStats);
    console.log('🎯 Parsed Coaching Data:', parsedCoachingData);
    
    if (parsedCoachingData) {
      parsedCoachingData.components.forEach((component, index) => {
        console.log(`  ${index + 1}. ${component.type.toUpperCase()}:`, component.props);
      });
    }
    
    // Create goal breakout session and link to journal entry
    const currentSessionId = getSessionId();
    if (currentSessionId && currentSessionId !== 'anonymous' && firebaseUser) {
      try {
        console.log('🎯 Creating goal breakout session for completed coaching session:', currentSessionId);
        await createGoalBreakoutSession(currentSessionId);
      } catch (error) {
        console.error('❌ Failed to create goal breakout session:', error);
      }
    }
    
    // Navigate to compass story for coaching completion immediately
    (navigation as any).navigate('CompassStory', { 
      fromCoaching: true,
      sessionId: currentSessionId,
      parsedCoachingData: parsedCoachingData || undefined
    });
    setShowCompletionForMessage(null);
    
    // Trigger insight extraction in background if we have a session ID
    if (currentSessionId && currentSessionId !== 'anonymous') {
      console.log('🧠 Starting insight extraction for session:', currentSessionId);
      triggerInsightExtraction(currentSessionId); // Don't await - run in background
    }
  };

  // Function to trigger insight extraction
  const triggerInsightExtraction = async (sessionId: string) => {
    try {
      const token = await getToken();
      if (!token) {
        console.error('❌ No auth token available for insight extraction');
        return;
      }

      console.log('📤 Calling insight extraction API...', {
        endpoint: `${process.env.EXPO_PUBLIC_API_URL}api/coaching/insightExtractor`,
        sessionId: sessionId,
        hasToken: !!token
      });

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}api/coaching/insightExtractor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: sessionId
        }),
      });

      console.log('📥 Insight extraction API response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Insight extraction successful:', result);
      } else {
        const errorText = await response.text();
        console.error('❌ Insight extraction failed:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText
        });
      }
    } catch (error) {
      console.error('❌ Error calling insight extraction API:', error);
    }
  };

  // Function to create goal breakout session and link to journal entry
  const createGoalBreakoutSession = async (completedSessionId: string) => {
    try {
      const token = await getToken();
      if (!token) {
        console.error('❌ No auth token available for goal breakout session creation');
        return;
      }

      // Generate new session ID for the goal breakout session
      const goalBreakoutSessionId = Crypto.randomUUID();
      
      console.log('🎯 Creating goal breakout session...', {
        completedSessionId,
        goalBreakoutSessionId,
        userId: firebaseUser?.uid
      });

      // Create the goal breakout session via API
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}api/coaching/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: goalBreakoutSessionId,
          sessionType: 'default-session',
          parentSessionId: completedSessionId, // Link to the completed coaching session
          messages: [
            {
              id: Crypto.randomUUID(),
              role: 'assistant',
              content: 'Based on our coaching session, I\'ve created a personalized goal breakout plan for you. Let\'s dive deeper into your action steps and create a concrete plan to move forward.',
              timestamp: new Date().toISOString()
            }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create goal breakout session: ${response.status}`);
      }

      const sessionResult = await response.json();
      console.log('✅ Goal breakout session created:', sessionResult);

      // Create a new journal entry linked to this goal breakout session
      const entryId = Crypto.randomUUID();
      const newEntry = {
        uid: firebaseUser!.uid,
        content: '', // Empty content - user will fill this in
        timestamp: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        linkedCoachingSessionId: goalBreakoutSessionId, // Link to the goal breakout session
        title: `Goal Breakout - ${new Date().toLocaleDateString()}`
      };

      const docRef = doc(db, 'journal_entries', entryId);
      await setDoc(docRef, newEntry);

      console.log('✅ Journal entry created and linked to goal breakout session:', {
        entryId,
        linkedSessionId: goalBreakoutSessionId
      });

      // Track goal breakout session creation
      trackEntryCreated({
        entry_id: entryId,
      });

    } catch (error) {
      console.error('❌ Error creating goal breakout session:', error);
      throw error;
    }
  };


  return (
    <CoachingErrorBoundary 
      colorScheme={colorScheme ?? 'light'}
      onError={(error, errorInfo) => {
        console.error('🚨 [COACHING ERROR BOUNDARY] Coaching screen error:', error, errorInfo);
        
        // Log to BetterStack
        betterStackLogger.logErrorBoundary(error, errorInfo, {
          userId: user?.id,
          sessionId: getSessionId(),
          componentStack: errorInfo.componentStack,
          metadata: {
            messagesCount: messages.length,
            isInitialized,
            isLoading,
            platform: 'mobile',
            screen: 'CoachingScreen'
          }
        });
      }}
      onRetry={() => {
        console.log('🔄 [COACHING ERROR BOUNDARY] Restarting coaching session');
        
        // Error boundary retry logging removed - only errors go to BetterStack
        
        // Clear any error states and reinitialize
        setIsInitialized(false);
        setMessages([]);
      }}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
        {/* Header */}
        <View style={[styles.chatHeader, { backgroundColor: colors.background, paddingTop: insets.top + 25, borderColor: `${colors.tint}12` }]}>
          <Text style={[styles.chatHeaderText, { color: colors.text }]}>
            Coach
          </Text>
        </View>

        {/* Messages */}
        <View style={styles.messagesContainer}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesList}
            contentContainerStyle={[
              styles.messagesContent, 
              { 
                minHeight: scrollLimits.minContentHeight,
                paddingBottom: dynamicBottomPadding
              }
            ]}
            scrollEventThrottle={16}
            onScroll={(event) => {
              // Call existing handleScroll function
              handleScroll(event);
              
              // Update content height
              const { contentSize } = event.nativeEvent;
              setContentHeight(contentSize.height);
            }}
            onLayout={(event) => {
              // Save ScrollView height
              const { height } = event.nativeEvent.layout;
              setScrollViewHeight(height);
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="interactive"
            bounces={false}
            overScrollMode="never"
            // Scroll limit enforcement - prevent endless scrolling
            onScrollEndDrag={(event) => {
              const { contentOffset } = event.nativeEvent;
              
              // If scroll exceeds maximum limit, bring it back
              if (contentOffset.y > scrollLimits.maxScrollDistance) {
                scrollViewRef.current?.scrollTo({
                  y: scrollLimits.maxScrollDistance,
                  animated: true
                });
              }
            }}
            // Momentum scroll limit enforcement
            onMomentumScrollEnd={(event) => {
              const { contentOffset } = event.nativeEvent;
              
              if (contentOffset.y > scrollLimits.maxScrollDistance) {
                scrollViewRef.current?.scrollTo({
                  y: scrollLimits.maxScrollDistance,
                  animated: true
                });
              }
            }}
          >
            {/* Simple loading spinner */}
            {isLoadingMore && (
              <View style={{
                alignItems: 'center',
                paddingVertical: 16,
              }}>
                <ModernSpinner colorScheme={colorScheme} size={20} />
              </View>
            )}

            {getMessagesWithSeparators(messages).map((item) => {
              // Render date separator
              if ('type' in item && item.type === 'separator') {
                return (
                  <DateSeparator 
                    key={item.id} 
                    date={item.date} 
                    colorScheme={colorScheme} 
                  />
                );
              }
              
              // Render message
              const message = item as CoachingMessage;
              return (
              <View
                key={message.id}
                ref={(ref) => {
                  messageRefs.current[message.id] = ref;
                }}
                style={[
                  styles.messageContainer,
                  message.role === 'user' ? styles.userMessageContainer : styles.aiMessageContainer
                ]}
              >
                                  <View style={message.role === 'user' ? [
                                    styles.userMessageBubble,
                                    {
                                      backgroundColor: colorScheme === 'dark' 
                                        ? 'rgba(255, 255, 255, 0.12)' 
                                        : 'rgba(0, 0, 0, 0.06)',
                                      borderWidth: colorScheme === 'dark' ? 0.5 : 0,
                                      borderColor: colorScheme === 'dark' 
                                        ? 'rgba(255, 255, 255, 0.15)' 
                                        : 'transparent'
                                    }
                                  ] : undefined}>
                     <Text
                       style={[
                         styles.messageText,
                         message.role === 'user'
                           ? [
                               styles.userMessageText, 
                               { 
                                 color: colorScheme === 'dark' 
                                   ? 'rgba(255, 255, 255, 0.85)' 
                                   : 'rgba(0, 0, 0, 0.75)' 
                               }
                             ]
                           : { color: colors.text }
                       ]}
                       numberOfLines={message.role === 'user' ? undefined : undefined}
                       ellipsizeMode={message.role === 'user' ? 'tail' : 'tail'}
                     >
                       {getDisplayContent(message.content)}
                     </Text>

                   {/* Render coaching cards for AI messages */}
                   <CoachingCardRenderer 
                     message={message} 
                     rendererProps={coachingCardRendererProps} 
                   />

                   {/* Show error message for failed AI responses */}
                   {message.role === 'assistant' && message.isError && (
                     <ErrorMessage
                       onRetry={() => handleRetryMessage(message.id)}
                       colorScheme={colorScheme}
                       isRetrying={retryingMessageId === message.id}
                     />
                   )}
                 </View>

                 {/* Completion Popup - appears on final message when progress reaches 100% */}
                 {message.role === 'assistant' && showCompletionForMessage === message.id && (
                   <View style={[
                     styles.aiPopup,
                     {
                       backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
                       borderColor: colorScheme === 'dark' ? '#333' : '#0000001A',
                     }
                   ]}>
                     <View style={styles.aiPopupContent}>
                       <Text style={[styles.aiPopupHeader, { color: colors.text }]}>
                         Session complete!
                       </Text>
                       <Text style={[styles.aiPopupText, { color: `${colors.text}80` }]}>
                         Great work on your coaching session.
                       </Text>
                       
                       <Text style={[styles.aiPopupText, { color: `${colors.text}66`, fontSize: 13, marginTop: 4 }]}>
                         {completionStats.minutes} min • {completionStats.words} words • {completionStats.keyInsights} key insights
                       </Text>

                       <View style={styles.aiPopupButtons}>
                         <Button
                           variant="primary"
                           size="sm"
                           onPress={handleCompletionAction}
                           style={{ flex: 1 }}
                         >
                           View your compass
                         </Button>
                       </View>
                     </View>
                   </View>
                 )}
               </View>
              );
            })}
            {shouldShowLoadingIndicator && (
              <View style={[
                styles.messageContainer, 
                styles.aiMessageContainer,
                styles.loadingMessageContainer
              ]}>
                <AnimatedTypingIndicator colorScheme={colorScheme} />
              </View>
            )}
          </ScrollView>
          
          {/* Scroll to bottom button */}
          {showScrollToBottom && (
            <TouchableOpacity
              style={[
                styles.scrollToBottomButton,
                {
                  backgroundColor: colorScheme === 'dark' ? '#333333' : '#FFFFFF',
                  bottom: keyboardHeight > 0 
                    ? containerHeight + 50  // When keyboard open: position above input container
                    : containerHeight + 140, // When keyboard closed: give more space above input
                }
              ]}
              onPress={() => hookHandleScrollToBottom(true)}
            >
              <ArrowDown size={20} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>


        {/* Input */}
        <View style={[styles.chatInputContainer, { 
          bottom: keyboardHeight > 0 ? keyboardHeight - 10 : 80, // If keyboard open: slightly overlapping, otherwise 80px above navbar
          paddingBottom: Math.max(insets.bottom, 0)
        }]} pointerEvents="box-none">
          <View
            pointerEvents="auto"
            style={[
            styles.chatInputWrapper,
            {
                backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
                borderColor: colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#00000012',
                height: containerHeight, // Dynamic height
                shadowColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                shadowOpacity: colorScheme === 'dark' ? 0.1 : 0.2,
              }
            ]}
          >
            {/* Expand Button - sadece 1 satırdan fazlayken görünür */}
            {currentLineCount > 1 && (
              <TouchableOpacity
                style={[styles.expandButton, {
                  backgroundColor: colorScheme === 'dark' ? '#404040' : '#F0F0F0',
                }]}
                onPress={handleExpandToggle}
              >
                <IconSymbol
                  name={isInputExpanded ? "arrow.down.right.and.arrow.up.left" : "arrow.up.left.and.arrow.down.right"}
                  size={14}
                  color={colorScheme === 'dark' ? '#FFFFFF' : '#666666'}
                />
              </TouchableOpacity>
            )}
            
            {!isRecording && !isTranscribing ? (
              /* Main Input Container - vertical layout */
              <View style={styles.mainInputContainer}>
                {/* TextInput at the top */}
              <TextInput
                ref={textInputRef}
                style={[
                  styles.chatInput,
                    { 
                      color: colors.text,
                      height: inputHeight, // Dynamic height
                      width: currentLineCount > 1 ? '92%' : '100%', // Leave space for expand button (~28px less)
                      paddingRight: currentLineCount > 1 ? 32 : 4, // Right padding for expand button
                    }
                ]}
                value={chatInput}
                  onChangeText={handleTextChange} // Main controller
                  onContentSizeChange={undefined} // Disabled - only use handleTextChange
                onFocus={() => setIsChatInputFocused(true)}
                onBlur={() => setIsChatInputFocused(false)}
                  placeholder="Write how you think..."
                  placeholderTextColor={colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.50)'}
                multiline
                maxLength={15000} // ~2000 words limit
                returnKeyType='default'
                onSubmitEditing={handleSendMessage}
                cursorColor={colors.tint}
                  scrollEnabled={inputHeight >= (isInputExpanded ? EXPANDED_MAX_LINES : MAX_LINES) * LINE_HEIGHT} // Scroll active at maximum height
                  textBreakStrategy="balanced" // Word breaking strategy
                />
                
                {/* Button Container at the bottom - Separate Mic and Send buttons */}
                <View style={styles.buttonContainer}>
                  {/* Microphone Button - Always visible for transcription */}
                  <TouchableOpacity
                    style={[styles.microphoneButtonRound, { 
                      backgroundColor: colorScheme === 'dark' ? '#404040' : '#E6E6E6' 
                    }]}
                    onPress={handleMicrophonePress}
                  >
                    <Mic
                      size={18}
                      color={colorScheme === 'dark' ? '#AAAAAA' : '#737373'}
                      strokeWidth={1.5}
                    />
                  </TouchableOpacity>

                  {/* Send Button - Only for sending messages */}
                  <TouchableOpacity
                    style={[styles.sendButtonRound, { 
                      backgroundColor: isLoading 
                        ? (colorScheme === 'dark' ? '#404040' : '#E6E6E6') 
                        : (colorScheme === 'dark' ? '#FFFFFF' : '#000000'),
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.2,
                      shadowRadius: 4,
                      elevation: 3,
                      opacity: chatInput.trim().length > 0 || isLoading ? 1 : 0.5,
                    }]}
                    onPress={isLoading ? handleStopGeneration : handleSendMessage}
                    disabled={chatInput.trim().length === 0 && !isLoading}
                  >
                    {isLoading ? (
                      <Square
                        size={14}
                        color={colorScheme === 'dark' ? '#FFFFFF' : '#666666'}
                        fill={colorScheme === 'dark' ? '#FFFFFF' : '#666666'}
                        strokeWidth={0}
                      />
                    ) : (
                      <ArrowUp
                        size={18}
                        color={colorScheme === 'dark' ? '#000000' : '#FFFFFF'}
                        strokeWidth={1.5}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : isTranscribing ? (
              <View style={styles.transcribingContainer}>
                <SpinningAnimation colorScheme={colorScheme} />
              </View>
            ) : (
              /* Recording state */
              <View style={styles.recordingStateContainer}>
                    <TouchableOpacity
                  style={[styles.recordingButton, { backgroundColor: `${colors.text}20` }]}
                  onPress={handleRecordingCancel}
                    >
                  <X size={20} color={colors.text} />
                    </TouchableOpacity>
                
                <View style={styles.recordingCenterSection}>
                  <AudioLevelIndicator audioLevel={audioLevel} colorScheme={colorScheme} />
                </View>
                
                <View style={styles.recordingRightSection}>
                  <RecordingTimer startTime={recordingStartTime} colorScheme={colorScheme} />
                    <TouchableOpacity
                    style={[styles.recordingButton, { backgroundColor: colors.text }]}
                    onPress={handleRecordingConfirm}
                  >
                    <Check size={20} color={colors.background} />
                    </TouchableOpacity>
                  </View>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
    </CoachingErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  chatHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    zIndex: 10,
  },
  chatHeaderText: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'left',
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  messagesList: {
    flex: 1,
    paddingTop: 12,
    zIndex: 0,
    overflow: 'visible',
    backgroundColor: 'transparent'
  },
  messagesContent: {
    flexGrow: 1,
  },
  messageContainer: {
    marginBottom: 16,
    paddingVertical: 6,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  aiMessageContainer: {
    alignItems: 'flex-start',
  },
  userMessageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderTopRightRadius: 4,
    maxWidth: '85%',
    alignSelf: 'flex-end',
  },
  messageText: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
  },
  userMessageText: {
    textAlign: 'left',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 32, // Fixed minimum height
  },
  
  // For message container in loading state
  loadingMessageContainer: {
    minHeight: 60, // Fixed space for loading indicator
    justifyContent: 'center',
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chatInputContainer: {
    paddingHorizontal: 20,
    paddingBottom: 0,
    paddingTop: 0,
    position: 'absolute',
    bottom: 0, // 40px above navbar
    left: 0,
    right: 0,
    justifyContent: 'flex-end', // Align content to bottom (for upward expansion)
    zIndex: 1000, // Base z-index
  },
  chatInputWrapper: {
    alignSelf: 'center',
    width: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderTopWidth: 0.5,
    borderRightWidth: 0.5,
    borderBottomWidth: 0,
    borderLeftWidth: 0.5,
    borderColor: '#00000012',
    padding: 8,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'flex-end', // Align buttons to bottom
    justifyContent: 'flex-start',
    overflow: 'visible',
    opacity: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  mainInputContainer: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 12, // Top padding increased
    paddingBottom: 8,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    width: '100%',
  },
  chatInput: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 24,
    minHeight: 24, // Minimum height
    paddingVertical: 0,
    paddingHorizontal: 4,
    backgroundColor: 'transparent',
    textAlignVertical: 'top',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    paddingTop: 8,
  },
  microphoneButtonRound: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonRound: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcribingContainer: {
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  recordingStateContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: 24,
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  microphoneButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  recordingCenterSection: {
    flex: 1,
    alignItems: 'flex-start',
    paddingLeft: 10,
  },
  recordingRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  loadingSpinner: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 20,
    width: 20,
  },
  spinner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderTopColor: '#333333',
  },
  audioLevelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  audioLevelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  recordingTimer: {
    fontSize: 14,
    fontWeight: '500',
  },
  aiPopup: {
    width: '105%',
    alignSelf: 'center',
    gap: 4,
    borderRadius: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#0000001A',
  },
  aiPopupContent: {
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 8,
    paddingLeft: 16,
    gap: 4,
  },
  aiPopupHeader: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 16,
  },
  aiPopupText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 16,
  },
  aiPopupButtons: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
  },
  scrollToBottomButton: {
    position: 'absolute',
    right: 20,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0, // Remove border, only arrow
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 999, // Lower z-index than input
  },
  expandButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
  },
}); 