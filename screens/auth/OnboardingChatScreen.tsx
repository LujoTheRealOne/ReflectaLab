import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { StyleSheet, Text, TextInput, View, useColorScheme, TouchableOpacity, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform, Keyboard, ColorSchemeName, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Mic, X, Check, ArrowUp, ArrowDown, Square } from 'lucide-react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import * as Crypto from 'expo-crypto';
import { Colors } from '@/constants/Colors';
import { AuthStackParamList } from '@/navigation/AuthNavigator';
import * as Progress from 'react-native-progress';
import { Button } from '@/components/ui/Button';

// Define CoachingMessage interface with error handling support
interface CoachingMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isError?: boolean;
  originalUserMessage?: string; // For error retry context
}

import { useNotificationPermissions } from '@/hooks/useNotificationPermissions';
import { useAuth } from '@/hooks/useAuth';
import { useAudioTranscription } from '@/hooks/useAudioTranscription';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';
import { useAnalytics } from '@/hooks/useAnalytics';
import { FirestoreService } from '@/lib/firestore';
import { useCoachingScroll } from '@/hooks/useCoachingScroll';
import { AnimatedTypingIndicator } from '@/components/coaching/ui/AnimatedTypingIndicator';
import { SpinningAnimation } from '@/components/coaching/ui/SpinningAnimation';
import { ModernSpinner } from '@/components/coaching/ui/ModernSpinner';
import { DateSeparator } from '@/components/coaching/ui/DateSeparator';
import { AudioLevelIndicator } from '@/components/coaching/ui/AudioLevelIndicator';
import { RecordingTimer } from '@/components/coaching/ui/RecordingTimer';
import { ErrorMessage } from '@/components/coaching/ui/ErrorMessage';
import { UserAccount } from '@/types/journal';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { CoachingCardRenderer, parseCoachingCards, getDisplayContent, parseCoachingCompletion } from '@/components/coaching/CoachingCardRenderer';
import { SessionEndCard } from '@/components/cards';
import { onboardingCacheService, OnboardingMessage } from '@/services/onboardingCacheService';

type OnboardingChatScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'OnboardingChat'>;
type OnboardingChatScreenRouteProp = RouteProp<AuthStackParamList, 'OnboardingChat'>;

// Removed - now using imported component

// Removed - now using imported component

// Removed - now using imported component

// Removed - now using imported component

export default function OnboardingChatScreen() {
  const navigation = useNavigation<OnboardingChatScreenNavigationProp>();
  const route = useRoute<OnboardingChatScreenRouteProp>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  


  // Extract all the onboarding data from navigation params
  const {
    name,
    selectedRoles,
    selectedSelfReflection,
    clarityLevel,
    stressLevel,
    coachingStylePosition,
    timeDuration
  } = route.params;

  // ========================================================================
  // MESSAGE STATE MANAGEMENT
  // ========================================================================
  // Core message state for onboarding conversation
  const [messages, setMessages] = useState<CoachingMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(7);

  // ========================================================================
  // PAGINATION SYSTEM - MESSAGE LOADING (from CoachingScreen)
  // ========================================================================
  // Implements pull-to-refresh style pagination for loading older messages
  // Loads messages in chunks when user scrolls to top of conversation
  // ========================================================================
  const [allMessages, setAllMessages] = useState<CoachingMessage[]>([]);
  const [displayedMessageCount, setDisplayedMessageCount] = useState(300);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const MESSAGES_PER_PAGE = 100;
  
  // Throttling for pagination to prevent multiple rapid calls
  const lastLoadTimeRef = useRef<number>(0);
  const LOAD_THROTTLE_MS = 1000; // 1 second between loads

  // Load more messages when user pulls to top
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

  // Error handling state
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);
  const { requestPermissions, expoPushToken, savePushTokenToFirestore, permissionStatus } = useNotificationPermissions();
  const { completeOnboarding, firebaseUser, getToken } = useAuth();
  const { clearProgress, saveProgress } = useOnboardingProgress();
  const { 
    trackOnboardingStep,
    trackNotificationPermissionRequested,
    trackNotificationPermissionGranted,
    trackNotificationPermissionDenied,
    trackCoachingMessagesOptIn
  } = useAnalytics();

  // Save progress as step 17 (OnboardingChat) when entering this screen
  useEffect(() => {
    console.log('💾 OnboardingChatScreen - Component mounted, saving progress as step 17');
    console.log('📋 OnboardingChatScreen - Route params:', {
      name,
      selectedRoles,
      selectedSelfReflection,
      clarityLevel,
      stressLevel,
      coachingStylePosition,
      timeDuration
    });
    
    // CRITICAL: Ensure onboarding is NOT marked as completed in Firestore
    // This fixes cases where user was previously marked as completed but is still in deep dive
    const ensureOnboardingNotCompleted = async () => {
      if (firebaseUser?.uid) {
        try {
          console.log('🔄 Ensuring onboarding is not marked as completed in Firestore...');
          await FirestoreService.updateUserAccount(firebaseUser.uid, {
            onboardingData: {
              onboardingCompleted: false,
              onboardingCompletedAt: 0,
              whatDoYouDoInLife: selectedRoles,
              selfReflectionPracticesTried: selectedSelfReflection,
              clarityInLife: clarityLevel * 10,
              stressInLife: stressLevel * 10,
            },
            updatedAt: new Date(),
          });
          console.log('✅ Onboarding completion status reset in Firestore');
        } catch (error) {
          console.error('❌ Failed to reset onboarding completion status:', error);
        }
      }
    };
    
    // Immediately save progress to ensure consistency
    const progressData = {
      currentStep: 17, // Special step for OnboardingChat
      name,
      selectedRoles,
      selectedSelfReflection,
      clarityLevel,
      stressLevel,
      hasInteractedWithClaritySlider: true,
      hasInteractedWithStressSlider: true,
      coachingStylePosition,
      hasInteractedWithCoachingStyle: true,
      timeDuration,
    };
    
    console.log('💾 Saving progress data:', progressData);
    
    // Run both operations
    Promise.all([
      saveProgress(progressData),
      ensureOnboardingNotCompleted()
    ]).then(() => {
      console.log('✅ OnboardingChatScreen - Progress saved and completion status reset');
    }).catch(error => {
      console.error('❌ Failed to save OnboardingChat progress or reset completion:', error);
    });
  }, []); // Only run once when component mounts
  
  // Save progress when component unmounts (user navigates away) - NO DEPENDENCIES TO AVOID INFINITE LOOP
  useEffect(() => {
    return () => {
      // Don't save progress if onboarding is already completed to prevent endless loop
      if (isOnboardingCompletedRef.current) {
        console.log('🚪 OnboardingChatScreen - Component unmounting but onboarding completed, skipping progress save');
        return;
      }
      
      console.log('🚪 OnboardingChatScreen - Component truly unmounting, saving final progress');
      // Use ref to get latest values or save what we have
      saveProgress({
        currentStep: 17,
        name,
        selectedRoles,
        selectedSelfReflection,
        clarityLevel,
        stressLevel,
        hasInteractedWithClaritySlider: true,
        hasInteractedWithStressSlider: true,
        coachingStylePosition,
        hasInteractedWithCoachingStyle: true,
        timeDuration,
      }).catch(error => {
        console.error('❌ Failed to save progress on unmount:', error);
      });
    };
  }, []); // EMPTY DEPENDENCIES - only run on actual unmount

  // Use consistent session ID for life deep dive (based on user ID + constant)
  const getSessionId = (): string => {
    return firebaseUser?.uid ? `onboarding-life-deep-dive-${firebaseUser.uid}` : 'anonymous-onboarding';
  };
  
  const [chatInput, setChatInput] = useState('');
  const [isChatInputFocused, setIsChatInputFocused] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputHeight, setInputHeight] = useState(24); // Initial height for minimum 1 line
  const [containerHeight, setContainerHeight] = useState(90); // Dynamic container height
  const [isInputExpanded, setIsInputExpanded] = useState(false); // Expand durumu
  const [currentLineCount, setCurrentLineCount] = useState(1); // Current line count
  const [showPopupForMessage, setShowPopupForMessage] = useState<string | null>(null);
  // Completion is now handled directly by sessionEnd cards, no separate popup needed
  const [showSchedulingForMessage, setShowSchedulingForMessage] = useState<string | null>(null);
  const [selectedFrequency, setSelectedFrequency] = useState<string>('daily');
  const [confirmedSchedulingForMessage, setConfirmedSchedulingForMessage] = useState<string | null>(null);
  const [confirmedSchedulingMessages, setConfirmedSchedulingMessages] = useState<Set<string>>(new Set());
  const [sessionStartTime] = useState(new Date());
  const [sessionStats, setSessionStats] = useState<{
    duration_minutes?: number;
    message_count?: number;
    insights_generated?: number;
    session_id?: string;
  }>({});
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState(false);
  const [isProcessingInsights, setIsProcessingInsights] = useState(false);
  
  const isOnboardingCompletedRef = useRef(false);

  // State for tracking expanded messages
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  // Function to check if a USER message is long and should be collapsible (only user messages)
  const isLongMessage = (content: string, role: string) => {
    if (role !== 'user') return false; // Only user messages can be collapsible
    const cleanContent = getDisplayContent(content);
    return cleanContent.length > 300; // Messages longer than 300 characters
  };

  // Function to get truncated message content
  const getTruncatedContent = (content: string, maxLength: number = 200) => {
    const cleanContent = getDisplayContent(content);
    if (cleanContent.length <= maxLength) return cleanContent;
    return cleanContent.substring(0, maxLength) + '...';
  };

  // Function to toggle message expansion
  const toggleMessageExpansion = (messageId: string) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

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
    onTranscriptionComplete: (transcription) => {
      const existingText = chatInput.trim();
      const newText = existingText 
        ? `${existingText} ${transcription}` 
        : transcription;
      setChatInput(newText);
      setTimeout(() => {
        textInputRef.current?.focus();
      }, 100);
    },
    onTranscriptionError: (error) => {
      console.error('Transcription error:', error);
    },
  });
  const [completionStats, setCompletionStats] = useState({
    minutes: 0,
    words: 0,
    keyInsights: 0
  });
  const [parsedCoachingData, setParsedCoachingData] = useState<{
    components: Array<{ type: string; props: Record<string, string> }>;
    rawData: string;
  } | null>(null);

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

  // Expand toggle function
  const handleExpandToggle = () => {
    setIsInputExpanded(!isInputExpanded);
    
    // Recalculate based on current text
    setTimeout(() => {
      handleTextChange(chatInput);
    }, 0);
  };

  // Function to parse coaching cards from any content
  const parseCoachingCards = (content: string) => {
    const components: Array<{ type: string; props: Record<string, string> }> = [];
    
    // First check for simple card format without parameters (e.g., [checkin], [sessionEnd])
    const simpleComponentRegex = /\[(\w+)\]/g;
    let simpleMatch;
    while ((simpleMatch = simpleComponentRegex.exec(content)) !== null) {
      const componentType = simpleMatch[1];
      
      // Add empty props for simple cards
      const props: Record<string, string> = {};
      components.push({ type: componentType, props });
    }
    
    // Also parse component markers with parameters like [checkin:frequency="once a day"] or [sessionEnd:title="...",message="..."]
    // Use improved regex that handles escaped quotes and newlines like the backend
    const componentRegex = /\[(\w+):((?:[^\]\\]|\\.)*)\]/g;
    let match;
    while ((match = componentRegex.exec(content)) !== null) {
      const componentType = match[1];
      const propsString = match[2];
      
      // Parse props from key="value" format with proper escaping
      const props: Record<string, string> = {};
      const propRegex = /(\w+)="((?:[^"\\]|\\.)*)"/g;
      let propMatch;
      
      while ((propMatch = propRegex.exec(propsString)) !== null) {
        const [, key, value] = propMatch;
        // Unescape quotes and newlines in the value like backend tokenParser
        props[key] = value.replace(/\\"/g, '"').replace(/\\n/g, '\n');
      }
      
      // Replace simple version if we have a parameterized version
      const existingIndex = components.findIndex(comp => comp.type === componentType);
      if (existingIndex !== -1) {
        components[existingIndex] = { type: componentType, props };
      } else {
        components.push({ type: componentType, props });
      }
    }
    
    return components;
  };

  // Function to parse coaching completion data from sessionEnd tokens
  const parseCoachingCompletion = (content: string) => {
    // ✅ NEW: Check for sessionEnd tokens (web standard)
    const sessionEndMatch = content.match(/\[sessionEnd(?::([^\]]+))?\]/);
    
    if (sessionEndMatch) {
      console.log('🎯 Found sessionEnd token:', sessionEndMatch[0]);
      
      // Parse sessionEnd attributes if present
      const attributesStr = sessionEndMatch[1] || '';
      const sessionEndProps: Record<string, string> = {};
      
      if (attributesStr) {
        // Use improved regex that handles escaped quotes and newlines like the backend
        const propRegex = /(\w+)="((?:[^"\\]|\\.)*)"/g;
        let propMatch;
        while ((propMatch = propRegex.exec(attributesStr)) !== null) {
          const [, key, value] = propMatch;
          // Unescape quotes and newlines in the value like backend tokenParser
          sessionEndProps[key] = value.replace(/\\"/g, '"').replace(/\\n/g, '\n');
        }
      }
      
      // Create sessionEnd component with consistent structure
      const sessionEndComponent = {
        type: 'sessionEnd',
        props: {
          title: sessionEndProps.title || 'Ready to Complete Your Session',
          message: sessionEndProps.message || 'I have gathered enough context to create your personalized life compass.'
        }
      };
      
      // Also parse any other coaching cards in the message
      const otherComponents = parseCoachingCards(content);
      const allComponents = [...otherComponents, sessionEndComponent];
      
      console.log('🎯 Parsed coaching completion (sessionEnd):', { 
        componentsCount: allComponents.length, 
        components: allComponents,
        sessionEndProps
      });
      
      return { components: allComponents, rawData: content };
    }
    
    // ❌ LEGACY: Still support old finish tokens for backward compatibility
    const finishStartIndex = content.indexOf('[finish-start]');
    const finishEndIndex = content.indexOf('[finish-end]');
    
    if (finishStartIndex !== -1 && finishEndIndex !== -1) {
      const finishContent = content.slice(finishStartIndex + '[finish-start]'.length, finishEndIndex).trim();
      const components = parseCoachingCards(finishContent);
      
      console.log('🎯 Parsed coaching completion (legacy finish tokens):', { 
        componentsCount: components.length, 
        components,
        rawFinishContent: finishContent
      });
      
      return { components, rawData: finishContent };
    }
    
    return { components: [], rawData: '' };
  };

  // Function to call coaching chat API for coaching blocks
  const callCoachingInteractionAPI = async (entryContent: string) => {
    try {
      // Validate input
      if (!entryContent || entryContent.trim().length === 0) {
        throw new Error('Entry content is required and cannot be empty');
      }

      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      // Use user ID as session ID for onboarding
      const currentSessionId = getSessionId();
      console.log(`🆔 Using user ID as session ID for onboarding: ${currentSessionId}`);

      const requestBody = {
        message: entryContent.trim(),
        sessionId: currentSessionId,
        sessionType: 'initial-life-deep-dive',
        sessionDuration: timeDuration,
        conversationHistory: messages.slice(0, 5) // Limit history to avoid large requests
      };

      console.log('📤 API Request:', {
        endpoint: `${process.env.EXPO_PUBLIC_API_URL}api/coaching/chat`,
        messageLength: requestBody.message.length,
        sessionId: requestBody.sessionId,
        historyCount: requestBody.conversationHistory.length
      });

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}api/coaching/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('❌ Coaching Chat API Error:', errorText);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      // Note: The coaching/chat endpoint returns streaming SSE, but we're just checking if the call succeeds
      // for now since we're using it to trigger backend processing
      console.log('✅ API call successful');
      return { success: true };
    } catch (error) {
      console.error('❌ Error calling coaching chat API:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };

  // Function to map UI frequency to UserAccount type and update coaching config
  const updateCoachingConfiguration = async (selectedFrequency: string) => {
    if (!firebaseUser?.uid) {
      console.error('❌ No user ID available for updating coaching config');
      return { success: false, error: 'User not authenticated' };
    }

    try {
      // Map UI frequency to UserAccount type
      const frequencyMap: Record<string, 'daily' | 'multipleTimesPerWeek' | 'onceAWeek'> = {
        'once a week': 'onceAWeek',
        'couple times a week': 'multipleTimesPerWeek',
        'daily': 'daily'
      };

      const mappedFrequency = frequencyMap[selectedFrequency];
      if (!mappedFrequency) {
        console.error('❌ Invalid frequency:', selectedFrequency);
        return { success: false, error: 'Invalid frequency' };
      }

      console.log('📊 Updating coaching configuration:', {
        userId: firebaseUser.uid,
        frequency: selectedFrequency,
        mappedFrequency,
        enableCoachingMessages: true
      });

      // Get current user account to preserve existing coaching settings
      const currentAccount = await FirestoreService.getUserAccount(firebaseUser.uid);
      
      // Update user's coaching configuration in Firestore, preserving existing settings
      const updates: Partial<UserAccount> = {
        coachingConfig: {
          challengeDegree: currentAccount.coachingConfig?.challengeDegree || 'moderate',
          harshToneDegree: currentAccount.coachingConfig?.harshToneDegree || 'supportive',
          coachingMessageFrequency: mappedFrequency,
          enableCoachingMessages: true,
          lastCoachingMessageSentAt: 0,
          coachingMessageTimePreference: 'morning',
        }
      };

      await FirestoreService.updateUserAccount(firebaseUser.uid, updates);
      
      console.log('✅ Successfully updated coaching configuration');
      return { success: true };
    } catch (error) {
      console.error('❌ Error updating coaching configuration:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  };

  // Function to clean message content by removing sessionEnd tokens and coaching cards
  const getDisplayContent = (content: string) => {
    let cleanContent = content;
    
    // ✅ NEW: Remove sessionEnd tokens (improved regex to match backend behavior)
    cleanContent = cleanContent.replace(/\[sessionEnd(?::(?:[^\]\\]|\\.)*)?]/g, '').trim();
    
    // ❌ LEGACY: Remove content between finish tokens for backward compatibility
    const finishStartIndex = cleanContent.indexOf('[finish-start]');
    const finishEndIndex = cleanContent.indexOf('[finish-end]');
    
    if (finishStartIndex !== -1 && finishEndIndex !== -1) {
      // Keep content before [finish-start] and after [finish-end]
      const beforeFinish = cleanContent.slice(0, finishStartIndex).trim();
      const afterFinish = cleanContent.slice(finishEndIndex + '[finish-end]'.length).trim();
      cleanContent = beforeFinish + (afterFinish ? '\n\n' + afterFinish : '');
    } else if (finishStartIndex !== -1) {
      // If only [finish-start] is found, remove everything after it
      cleanContent = cleanContent.slice(0, finishStartIndex).trim();
    }
    
    // Remove coaching card syntax like [checkin:...], [focus:...], [sessionEnd:...], etc. (with proper escaping support)
    const coachingCardRegex = /\[(\w+):((?:[^\]\\]|\\.)*)\]/g;
    cleanContent = cleanContent.replace(coachingCardRegex, '').trim();
    
    // Remove simple coaching cards like [checkin], [lifeCompassUpdated], [sessionEnd]
    const simpleCardRegex = /\[(\w+)\]/g;
    cleanContent = cleanContent.replace(simpleCardRegex, '').trim();
    
    // Clean up extra whitespace/newlines that might be left
    cleanContent = cleanContent.replace(/\n\s*\n\s*\n/g, '\n\n'); // Replace multiple newlines with double newlines
    cleanContent = cleanContent.trim();
    
    return cleanContent;
  };

  // scrollViewRef now provided by useCoachingScroll hook
  const textInputRef = useRef<TextInput>(null);

  // Dynamic input constants
  const LINE_HEIGHT = 24;
  const MIN_LINES = 1;
  const MAX_LINES = 10;
  const EXPANDED_MAX_LINES = 18; // Maximum lines when expanded
  const INPUT_PADDING_VERTICAL = 8;
  const CONTAINER_BASE_HEIGHT = 90; // Minimum container height
  const CONTAINER_PADDING = 40; // Total container padding (8+20+12)

  // Monitor when AI response actually starts
  const [aiResponseStarted, setAiResponseStarted] = useState(false);
  
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

  const shouldShowLoadingIndicator = useMemo(() => {
    return isLoading || (aiResponseStarted && messages.length > 0);
  }, [isLoading, aiResponseStarted, messages.length]);
  
  // ========================================================================
  // COACHING SCROLL SYSTEM INTEGRATION
  // ========================================================================
  // Uses the same scroll hook as CoachingScreen for consistent behavior
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

  // ========================================================================
  // SCROLL EVENT HANDLER - MAIN SCROLL LOGIC (from CoachingScreen)
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
       
       // Show button when user is more than 150px from bottom (CoachingScreen threshold)
       setShowScrollToBottom(distanceFromBottom > 150);
     } else {
       // Hide button during AI responses or when no messages
       setShowScrollToBottom(false);
     }
  };

  // COACHING SCREEN PATTERN: Trigger positioning when new user message appears
  const lastMessageRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    const lastMessageId = lastMessage?.id;
    
    // If this is a new message since last check, trigger positioning
    if (lastMessageId && lastMessageId !== lastMessageRef.current) {
      lastMessageRef.current = lastMessageId;
      
      // Trigger positioning for new messages (both user and assistant)
      scrollToNewMessageRef.current = true;
      debugLog('🎯 New message detected, triggering positioning');
    }
  }, [messages, debugLog]);

  // COACHING SCREEN PATTERN: Trigger positioning when starting/stopping typing
  const prevLoadingRef = useRef<boolean>(false);
  useEffect(() => {
    // Only trigger when isLoading changes from false to true (start of AI response)
    if (isLoading && !prevLoadingRef.current) {
      // AI started responding - position to show typing indicator
      scrollToNewMessageRef.current = true;
      debugLog('🤖 AI started responding, triggering positioning');
    }
    prevLoadingRef.current = isLoading;
  }, [isLoading, debugLog]);

  // ========================================================================
  // POSITION MAINTENANCE DURING AI RESPONSE (from CoachingScreen)
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

  // ========================================================================
  // POSITIONING CLEANUP AFTER AI RESPONSE
  // ========================================================================
  // NOTE: OnboardingScreen doesn't use completion popup like CoachingScreen,
  // so no special positioning cleanup needed. The useCoachingScroll hook
  // handles all positioning automatically.
  // ========================================================================

  // COACHING SCREEN PATTERN: Initial scroll trigger
  const [isInitialized, setIsInitialized] = useState(false);
  
  useEffect(() => {
    if (messages.length > 0 && !isInitialized) {
      setIsInitialized(true);
      // Initial positioning after messages load
      setTimeout(() => {
        if (scrollViewRef.current && !hasUserScrolled.current) {
          scrollToNewMessageRef.current = true;
          debugLog('🎯 Initial positioning triggered');
        }
      }, 100); // Reduced timeout for more responsive initial scroll
    }
  }, [isInitialized, messages.length, debugLog]);

  // Load saved chat data or initialize with first message
  useEffect(() => {
    const loadOnboardingChat = async () => {
      if (!firebaseUser?.uid) {
        console.log('⏳ Waiting for user authentication...');
        return;
      }

      if (messages.length > 0) {
        console.log('📱 Chat already has messages, skipping load');
        return;
      }

      try {
        console.log('🔍 Loading saved onboarding data for user:', firebaseUser.uid);
        const savedData = await onboardingCacheService.loadOnboardingData(firebaseUser.uid);
        
        if (savedData.messages.length > 0) {
          console.log(`💾 Loaded ${savedData.messages.length} saved onboarding messages`);
          console.log(`📊 Restored progress: ${savedData.progress}%`);
          
          // Convert OnboardingMessage to CoachingMessage
          const coachingMessages: CoachingMessage[] = savedData.messages.map(msg => ({
            id: msg.id,
            content: msg.content,
            role: msg.role,
            timestamp: msg.timestamp
          }));
          
          // Set both allMessages and messages for pagination system
          setAllMessages(coachingMessages);
          setMessages(coachingMessages);
          setDisplayedMessageCount(coachingMessages.length);
          setHasMoreMessages(false); // Onboarding doesn't typically need pagination
          setProgress(savedData.progress);
        } else {
          // No saved data, create initial message
          console.log('📝 No saved data found, creating initial message');
          setTimeout(() => {
            const initialMessage: CoachingMessage = {
              id: '1',
              content: `Hey, ${name}.\n
Once you're ready, I'd love to hear: If you had to name what's most alive in you right now—what would it be?\n
Maybe it's a tension you're holding, a quiet longing, or something you don't quite have words for yet. Whatever shows up—start there.`,
              role: 'assistant',
              timestamp: new Date()
            };
            setMessages([initialMessage]);
            setAllMessages([initialMessage]);
          }, 1000);
        }
      } catch (error) {
        console.error('❌ Error loading onboarding data:', error);
        // Fallback to initial message on error
        setTimeout(() => {
          const initialMessage: CoachingMessage = {
            id: '1',
            content: `Hey, ${name}.\n
Once you're ready, I'd love to hear: If you had to name what's most alive in you right now—what would it be?\n
Maybe it's a tension you're holding, a quiet longing, or something you don't quite have words for yet. Whatever shows up—start there.`,
            role: 'assistant',
            timestamp: new Date()
          };
          setMessages([initialMessage]);
          setAllMessages([initialMessage]);
        }, 1000);
      }
    };

    loadOnboardingChat();
  }, [name, messages.length, firebaseUser?.uid]);

  // Save messages and progress when they change
  useEffect(() => {
    const saveOnboardingData = async () => {
      if (!firebaseUser?.uid || messages.length === 0) {
        return;
      }

      // Don't save if this is just the initial load
      if (messages.length === 1 && messages[0].id === '1' && progress === 7) {
        console.log('⏭️ Skipping save for initial message');
        return;
      }

      try {
        const sessionId = getSessionId();
        
        // Convert CoachingMessage to OnboardingMessage
        const onboardingMessages: OnboardingMessage[] = messages.map(msg => ({
          id: msg.id,
          content: msg.content,
          role: msg.role,
          timestamp: msg.timestamp
        }));

        await onboardingCacheService.saveOnboardingData(
          firebaseUser.uid,
          sessionId,
          onboardingMessages,
          progress
        );

        console.log(`💾 Saved ${messages.length} messages with ${progress}% progress`);
      } catch (error) {
        console.error('❌ Error saving onboarding data:', error);
      }
    };

    // Debounce saving to avoid too frequent saves
    const timeoutId = setTimeout(saveOnboardingData, 1000);
    return () => clearTimeout(timeoutId);
  }, [messages, progress, firebaseUser?.uid]);

  // Modern scroll handling now provided by useCoachingScroll hook

  // Modern scroll to bottom now provided by useCoachingScroll hook



  // Check for notification suggestions in new AI messages
  useEffect(() => {
    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    
    // Only check assistant messages that have content and aren't already showing a popup
    if (lastMessage && 
        lastMessage.role === 'assistant' && 
        lastMessage.content.length > 0 &&
        !showPopupForMessage &&
        lastMessage.content.toLowerCase().includes('notification')) {
      
      // Small delay to ensure message is fully rendered
      setTimeout(() => {
        setShowPopupForMessage(lastMessage.id);
      }, 300);
    }
  }, [messages, showPopupForMessage]);

  // Check for scheduling/checkin cards in new AI messages
  useEffect(() => {
    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    
    // Only check assistant messages that have content and aren't already showing a popup
    if (lastMessage && 
        lastMessage.role === 'assistant' && 
        lastMessage.content.length > 0 &&
        !showSchedulingForMessage &&
        !showPopupForMessage &&
        !confirmedSchedulingForMessage) {
      
      // Parse coaching cards from the message
      const coachingCards = parseCoachingCards(lastMessage.content);
      const hasCheckinCard = coachingCards.some(card => card.type === 'checkin');
      
      if (hasCheckinCard && !confirmedSchedulingMessages.has(lastMessage.id)) {
        console.log('📅 Found checkin card in message:', lastMessage.id, coachingCards);
        
        // Small delay to ensure message is fully rendered
        setTimeout(() => {
          setShowSchedulingForMessage(lastMessage.id);
          setSelectedFrequency('daily');
        }, 300);
      }
    }
  }, [messages, showSchedulingForMessage, showPopupForMessage, confirmedSchedulingMessages]);

  useEffect(() => {
    console.log('🎯 OnboardingChat Progress Update:', progress);
  }, [progress]);

  // Calculate completion stats when progress reaches 100% (for sessionEnd card use)
  useEffect(() => {
    if (progress === 100) {
      console.log('🎯 Progress reached 100%! Calculating completion stats...');
      
      // Calculate session statistics for sessionEnd card
      const sessionEndTime = new Date();
      const sessionDurationMs = sessionEndTime.getTime() - sessionStartTime.getTime();
      const sessionMinutes = Math.round(sessionDurationMs / 60000);
      
      // Count words from user messages
      const userMessages = messages.filter(msg => msg.role === 'user');
      const totalWords = userMessages.reduce((count, msg) => {
        return count + msg.content.trim().split(/\s+/).filter(word => word.length > 0).length;
      }, 0);
      
      // Find sessionEnd token for insights count
      const sessionEndMessage = [...messages].reverse().find(msg => 
        msg.role === 'assistant' && 
        /\[sessionEnd(?::(?:[^\]\\]|\\.)*)?]/.test(msg.content)
      );
      
      let keyInsights = 3; // Default
      if (sessionEndMessage) {
        const parsedData = parseCoachingCompletion(sessionEndMessage.content);
        keyInsights = Math.max(parsedData.components.length, 3);
        setParsedCoachingData(parsedData);
      }
      
      // Update session stats for SessionEndCard
      setSessionStats({
        duration_minutes: sessionMinutes,
        message_count: userMessages.length,
        insights_generated: keyInsights,
        session_id: 'onboarding'
      });
      
      setCompletionStats({
        minutes: Math.max(sessionMinutes, 1),
        words: totalWords,
        keyInsights
      });
      
      // Session completion tracking removed - using single session logic now
    }
  }, [progress, messages, sessionStartTime]);

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





  // 8. Set flag correctly in handleSendMessage:
  const handleSendMessage = async () => {
    if (chatInput.trim().length === 0) return;

    // Use consistent session ID for life deep dive (based on user ID)
    const currentSessionId = getSessionId();
    console.log(`🆔 Using consistent session ID for onboarding: ${currentSessionId}`);
    
    // Log initial life deep dive session activity
    console.log('🎯 [COACHING] Initial life deep dive session activity...', {
      sessionId: currentSessionId,
      sessionType: 'initial_life_deep_dive',
      trigger: 'manual'
    });
    
    // Session tracking removed - using single session logic now
    
    // Also track this as an onboarding step completion
    trackOnboardingStep({
      step_name: 'initial_life_deep_dive_started',
      step_number: 17,
      time_spent: Math.floor((Date.now() - sessionStartTime.getTime()) / 1000),
    });

    const messageContent = chatInput.trim();
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

    try {
      setIsLoading(true);
      
      // Add user message immediately
      const userMessage: CoachingMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: messageContent,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);

      // Get auth token
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      // Add AI placeholder message
      const aiMessageId = (Date.now() + 1).toString();
      const aiMessage: CoachingMessage = {
        id: aiMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);

      // Call backend API for life deep dive
      const apiUrl = `${process.env.EXPO_PUBLIC_API_URL}api/coaching/chat`;
      console.log('📤 Making API call to:', apiUrl);
      
      const requestBody = {
        message: messageContent,
        sessionId: currentSessionId,
        sessionType: 'initial-life-deep-dive',
        sessionDuration: timeDuration,
        conversationHistory: messages.slice(-5) // Last 5 messages for context
      };
      console.log('📤 Request body:', requestBody);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📥 Response status:', response.status, response.statusText);
      console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error response:', errorText);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      // Handle streaming response - React Native compatible approach
      let fullContent = '';
      
      try {
        console.log('📡 Processing streaming response with typing effect...');
        
        // React Native compatible streaming: parse SSE format and simulate typing
        // This provides the illusion of real-time streaming while being compatible
        const responseText = await response.text();
        console.log('📄 Got response text (first 200 chars):', responseText.substring(0, 200) + '...');
        
        // Parse the server-sent events format
        const lines = responseText.split('\n');
        const contentChunks: string[] = [];
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'content') {
                contentChunks.push(data.content);
                fullContent += data.content;
              } else if (data.type === 'done') {
                console.log('✅ Streaming marked as complete');
              }
            } catch (parseError) {
              console.warn('Parse error for line:', line.substring(0, 50) + '...', parseError);
            }
          }
        }
        
        // Simulate typing effect by progressively showing content chunks
        console.log(`📊 Starting typing animation with ${contentChunks.length} chunks`);
        let currentContent = '';
        
        // Break large chunks into smaller pieces for smoother typing effect
        const smallChunks: string[] = [];
        for (const chunk of contentChunks) {
          if (chunk.length > 100) {
            // Split large chunks into ~50 character pieces
            for (let i = 0; i < chunk.length; i += 50) {
              smallChunks.push(chunk.substring(i, i + 50));
            }
          } else {
            smallChunks.push(chunk);
          }
        }
        
        console.log(`📊 Created ${smallChunks.length} small chunks for smooth typing`);
        
        for (let i = 0; i < smallChunks.length; i++) {
          currentContent += smallChunks[i];
          
          // Update UI with progressive content
          setMessages(prev => prev.map(msg => 
            msg.id === aiMessageId 
              ? { ...msg, content: currentContent }
              : msg
          ));
          
          // Update progress based on content length and sessionEnd detection
          let estimatedProgress = Math.min(Math.floor(currentContent.length / 15) + 10, 90);
          if (currentContent.includes('sessionEnd')) {
            estimatedProgress = 100;
          }
          setProgress(estimatedProgress);
          
          // Add small delay to simulate typing (except for last chunk)
          if (i < smallChunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 30)); // 30ms delay for smoother effect
          }
        }
        
        console.log(`📊 Processed ${contentChunks.length} content chunks, total length: ${fullContent.length}`);
        
        // Ensure final content is set
        if (fullContent) {
          setMessages(prev => prev.map(msg => 
            msg.id === aiMessageId 
              ? { ...msg, content: fullContent }
              : msg
          ));
          setProgress(100);
        } else {
          throw new Error('No content received from streaming response');
        }
        
      } catch (streamError) {
        console.error('❌ Streaming processing failed:', streamError);
        throw new Error('Failed to process AI response');
      }

      // Update session stats when session is complete
      if (fullContent.includes('sessionEnd')) {
        const sessionEndTime = new Date();
        const sessionDurationMs = sessionEndTime.getTime() - sessionStartTime.getTime();
        const sessionMinutes = Math.round(sessionDurationMs / 60000);
        
        const userMessages = messages.filter(msg => msg.role === 'user');
        
        setSessionStats({
          duration_minutes: sessionMinutes,
          message_count: userMessages.length + 1, // +1 for current message
          insights_generated: 5, // Could be parsed from content
          session_id: currentSessionId
        });
        
        console.log('🎯 Session completed, stats updated');
      }

    } catch (error) {
      console.error('❌ Error sending message:', error);
      // Add error message with retry context
      const errorMessage: CoachingMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
        isError: true,
        originalUserMessage: messageContent // Store original message for retry
      };
      setMessages(prev => [...prev, errorMessage]);
      setAllMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // ========================================================================
  // ERROR HANDLING AND RETRY LOGIC (from CoachingScreen)
  // ========================================================================
  // Handles retry functionality for failed AI responses
  // ========================================================================
  const handleRetryMessage = async (messageId: string) => {
    if (retryingMessageId) return;
    
    console.log('🔄 [ERROR RETRY] Retrying message:', messageId);
    setRetryingMessageId(messageId);
    
    // Find the original error message for context
    const errorMessage = messages.find(msg => msg.id === messageId && msg.isError);
    
    try {
      const currentSessionId = getSessionId();
      
      if (errorMessage?.originalUserMessage) {
        // Remove the error message and retry with original content
        const filteredMessages = messages.filter(msg => msg.id !== messageId);
        setMessages(filteredMessages);
        setAllMessages(prev => prev.filter(msg => msg.id !== messageId));
        
        // Resend the original user message
        setChatInput(errorMessage.originalUserMessage);
        setTimeout(() => {
          handleSendMessage();
        }, 100);
      }
      
      console.log('✅ [ERROR RETRY] Message retry initiated');
      
    } catch (error) {
      console.error('❌ [ERROR RETRY] Message retry failed:', error);
    } finally {
      setRetryingMessageId(null);
    }
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

  const handlePopupAction = async (action: string, messageId: string) => {
    console.log(`Action: ${action} for message: ${messageId}`);
    setShowPopupForMessage(null);
    
    // Handle specific actions here
    switch (action) {
      case 'decline':
        console.log('User declined notification permissions');
        // Track notification permission denied
        trackNotificationPermissionDenied({ denied_via: 'onboarding' });
        break;
      case 'accept':
        try {
          // Track notification permission requested
          trackNotificationPermissionRequested();
          const granted = await requestPermissions();
          if (granted) {
            console.log('✅ Notification permissions granted and push token saved');
            // Track notification permission granted
            trackNotificationPermissionGranted({ granted_via: 'onboarding' });
            
            // Send confirmation message to chat
            const confirmationMessage: CoachingMessage = {
              id: (Date.now() + 3).toString(),
              role: 'assistant',
              content: "Perfect! I've saved your notification preferences. You'll receive thoughtful reflection prompts to help you stay connected with your insights and growth.",
              timestamp: new Date()
            };
            setMessages([...messages, confirmationMessage]);
          } else {
            console.log('❌ Notification permissions denied');
            // Track notification permission denied
            trackNotificationPermissionDenied({ denied_via: 'onboarding' });
            // Add message about manual setup
            const declineMessage: CoachingMessage = {
              id: (Date.now() + 3).toString(),
              role: 'assistant',
              content: "No problem! You can always enable notifications later in your device settings if you change your mind.",
              timestamp: new Date()
            };
            setMessages([...messages, declineMessage]);
          }
        } catch (error) {
          console.error('Error setting up notifications:', error);
        }
        break;
    }
  };

  const handleSchedulingAction = async (action: string, messageId: string, frequency?: string) => {
    console.log(`Scheduling action: ${action} for message: ${messageId}`, { frequency, selectedFrequency });
    
    // Find the message with checkin card
    const message = messages.find(msg => msg.id === messageId);
    if (!message) return;
    
    const coachingCards = parseCoachingCards(message.content);
    const checkinCard = coachingCards.find(card => card.type === 'checkin');
    
    if (!checkinCard) return;
    
    switch (action) {
      case 'decline':
        console.log('User declined scheduling checkins');
        setShowSchedulingForMessage(null);
        // Track coaching messages opt-in as declined
        trackCoachingMessagesOptIn({
          opted_in: false,
          context: 'onboarding',
        });
        // Add optional decline message
        const declineMessage: CoachingMessage = {
          id: (Date.now() + 3).toString(),
          role: 'assistant',
          content: "No worries! You can always set up check-ins later when you're ready to dive deeper into your growth journey.",
          timestamp: new Date()
        };
        setMessages([...messages, declineMessage]);
        break;
        
      case 'toggle-frequency':
        if (frequency) {
          console.log('User toggled frequency to:', frequency);
          setSelectedFrequency(frequency);
        }
        break;
        
      case 'confirm':
        try {
          console.log('✅ User confirmed scheduling:', { frequency: selectedFrequency, checkinCard: checkinCard.props });
          
          // Track coaching messages opt-in as confirmed
          trackCoachingMessagesOptIn({
            opted_in: true,
            frequency: selectedFrequency === 'once a week' ? 'weekly' : selectedFrequency === 'couple times a week' ? 'weekly' : 'daily',
            context: 'onboarding',
          });
          
          // Show confirmed state immediately
          setShowSchedulingForMessage(null);
          setConfirmedSchedulingForMessage(messageId);
          setConfirmedSchedulingMessages(prev => new Set([...prev, messageId]));
          
          // 1. Request notification permissions and save push token
          console.log('📱 Requesting notification permissions for check-ins...');
          const notificationGranted = await requestPermissions();
          
          // 2. Update user's coaching configuration in Firestore
          console.log('💾 Saving coaching configuration to user profile...');
          const configResult = await updateCoachingConfiguration(selectedFrequency);
          
          // 3. Call coaching interaction API with user's current context
          const userMessages = messages.filter(msg => msg.role === 'user');
          const contextContent = userMessages.map(msg => msg.content).join(' ').trim();
          
          // Provide a meaningful message for the API call
          const apiMessage = contextContent || `User confirmed ${selectedFrequency} check-ins about ${checkinCard.props.what || 'their progress'}`;
          
          console.log('📤 Sending to API:', { message: apiMessage, contextLength: contextContent.length });
          const apiResult = await callCoachingInteractionAPI(apiMessage);
          
          // 4. Show appropriate confirmation message based on results
          const what = checkinCard.props.what || 'your progress';
          
          if (configResult.success && apiResult && apiResult.success) {
            console.log('📅 Both config update and API call successful');
            
            const confirmationMessage: CoachingMessage = {
              id: (Date.now() + 3).toString(),
              role: 'assistant',
              content: notificationGranted 
                ? `Perfect! I've scheduled ${selectedFrequency} check-ins about ${what}. You'll receive thoughtful prompts to help you stay on track with your goals.`
                : `Great! I've scheduled ${selectedFrequency} check-ins about ${what}. You can enable notifications in your device settings to receive prompts directly.`,
              timestamp: new Date()
            };
            setMessages([...messages, confirmationMessage]);
          } else if (configResult.success) {
            console.log('📊 Config saved successfully, API call failed');
            
            const confirmationMessage: CoachingMessage = {
              id: (Date.now() + 3).toString(),
              role: 'assistant',
              content: notificationGranted
                ? `Great! I've saved your preference for ${selectedFrequency} check-ins about ${what}. Your coaching schedule is now active and you'll receive notifications.`
                : `Great! I've saved your preference for ${selectedFrequency} check-ins about ${what}. Your coaching schedule is now active.`,
              timestamp: new Date()
            };
            setMessages([...messages, confirmationMessage]);
          } else {
            console.log('⚠️ Config update failed, showing fallback message');
            
            const confirmationMessage: CoachingMessage = {
              id: (Date.now() + 3).toString(),
              role: 'assistant',
              content: notificationGranted
                ? `Got it! I've noted your preference for ${selectedFrequency} check-ins about ${what}. This will help you stay accountable to your goals, and you'll receive notifications when it's time to check in.`
                : `Got it! I've noted your preference for ${selectedFrequency} check-ins about ${what}. This will help you stay accountable to your goals.`,
              timestamp: new Date()
            };
            setMessages([...messages, confirmationMessage]);
          }
          
          // Keep confirmed popup visible permanently
          
        } catch (error) {
          console.error('Error setting up scheduling:', error);
          setShowSchedulingForMessage(null);
          // Add error message
          const errorMessage: CoachingMessage = {
            id: (Date.now() + 3).toString(),
            role: 'assistant',
            content: "I had trouble setting up the scheduling right now, but don't worry - we can try again later.",
            timestamp: new Date()
          };
          setMessages([...messages, errorMessage]);
        }
        break;
    }
  };

  // Function to trigger insight extraction (background - no wait)
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

  // Function to trigger insight extraction with wait (for completion screen)
  const triggerInsightExtractionWithWait = async (sessionId: string): Promise<void> => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('No auth token available for insight extraction');
      }

      console.log('📤 Calling insight extraction API with wait...', {
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
        console.log('✅ Insight extraction completed successfully:', result);
        return; // Success
      } else {
        const errorText = await response.text();
        console.error('❌ Insight extraction failed:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText
        });
        throw new Error(`Insight extraction failed: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('❌ Error calling insight extraction API with wait:', error);
      throw error; // Re-throw so timeout/retry logic can handle it
    }
  };

  const handleCompletionAction = async () => {
    console.log('User clicked View Compass Results');
    console.log('📊 Session Stats:', completionStats);
    console.log('🎯 Parsed Coaching Data:', parsedCoachingData);
    
    if (parsedCoachingData) {
      parsedCoachingData.components.forEach((component, index) => {
        console.log(`  ${index + 1}. ${component.type.toUpperCase()}:`, component.props);
      });
    }
    
    try {
      console.log('🚀 Starting onboarding completion from deep dive...');
      
      // Show processing state
      setIsProcessingInsights(true);
      
      // Complete onboarding first
      const result = await completeOnboarding();
      console.log('✅ Onboarding completion finished successfully', result);
      
      // Clear onboarding progress from AsyncStorage
      await clearProgress();
      
      // Clear onboarding chat cache since session is completed
      if (firebaseUser?.uid) {
        await onboardingCacheService.clearOnboardingData(firebaseUser.uid);
        console.log('🗑️ Cleared onboarding chat cache');
      }

      // Trigger insight extraction and wait for it if we have a session ID
      const finalSessionId = getSessionId();
      if (finalSessionId && finalSessionId !== 'anonymous-onboarding') {
        console.log('🧠 Starting insight extraction for onboarding session:', finalSessionId);
        
        try {
          // Wait for insight extraction to complete (but with timeout)
          await Promise.race([
            triggerInsightExtractionWithWait(finalSessionId),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Insight extraction timeout')), 3000) // 45 second timeout
            )
          ]);
          console.log('✅ Insight extraction completed');
        } catch (error) {
          console.warn('⚠️ Insight extraction failed or timed out, proceeding anyway:', error);
          // Continue with navigation even if insight extraction fails
        }
      }

      // Hide processing state
      setIsProcessingInsights(false);

      // Navigate to compass story with onboarding completed
      navigation.navigate('CompassStory', { 
        fromOnboarding: true,
        sessionId: finalSessionId, // Pass sessionId for insight tracking
        parsedCoachingData: parsedCoachingData || undefined
      });

      // Note: Navigation to main app is now handled by CompassStoryScreen
      // when user manually closes the compass or completes viewing it

    } catch (error) {
      console.error('❌ Error completing onboarding from deep dive:', error);
      setIsProcessingInsights(false);
    }
  };


  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={[styles.chatHeader, { backgroundColor: colors.background, paddingTop: insets.top + 25, borderColor: `${colors.tint}12` }]}>
          <View style={styles.headerContent}>
          <Text style={[styles.chatHeaderText, { color: colors.text }]}>
            Life Deep Dive
          </Text>
          
          <View style={styles.progressSection}>
            <Text style={[styles.chatProgressText, { color: `${colors.text}66` }]}>
              {Math.round(progress)}%
            </Text>
            
            {/* Circular Progress Bar */}
            <Progress.Circle
              size={20}
              animated={true}
              progress={Math.min(progress / 100, 1)} // Ensure it doesn't exceed 1
              color={colors.tint}
              unfilledColor={`${colors.text}20`}
              borderWidth={0}
              thickness={4}
              strokeCap='round'
              showsText={false}
            />
            </View>
          </View>
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
            {/* Loading spinner for pagination (from CoachingScreen) */}
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
                  {/* Collapsible message content */}
                  <TouchableOpacity
                    activeOpacity={isLongMessage(message.content, message.role) ? 0.7 : 1}
                    onPress={() => {
                      if (isLongMessage(message.content, message.role)) {
                        toggleMessageExpansion(message.id);
                      }
                    }}
                  >
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
                    >
                      {isLongMessage(message.content, message.role) && !expandedMessages.has(message.id)
                        ? getTruncatedContent(message.content)
                        : getDisplayContent(message.content)
                      }
                    </Text>
                    
                    {/* Show expand/collapse indicator for long messages */}
                    {isLongMessage(message.content, message.role) && (
                      <Text
                        style={[
                          styles.expandIndicator,
                          {
                            color: message.role === 'user' 
                              ? (colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)')
                              : `${colors.text}80`
                          }
                        ]}
                      >
                        {expandedMessages.has(message.id) ? 'Show less' : 'Show more'}
                      </Text>
                    )}
                  </TouchableOpacity>
                  
                  {/* Render coaching cards for AI messages */}
                  {message.role === 'assistant' && (() => {
                    const coachingCards = parseCoachingCards(message.content);
                    
                    return coachingCards.map((card, index) => {
                      // Special handling for sessionEnd cards to use our completion logic
                      if (card.type === 'sessionEnd') {
                        return (
                          <View key={`${message.id}-sessionend-${index}`} style={{ marginTop: 12 }}>
                            <SessionEndCard
                              data={{
                                type: 'sessionEnd',
                                title: card.props.title,
                                message: card.props.message
                              }}
                              onCompleteSession={handleCompletionAction}
                              sessionStats={sessionStats}
                              isProcessingInsights={isProcessingInsights}
                            />
                          </View>
                        );
                      }
                      
                      // For other cards, use the standard renderer
                      return (
                        <View key={`${message.id}-card-${index}`} style={{ marginTop: 12 }}>
                          <CoachingCardRenderer
                            message={{
                              ...message,
                              content: `[${card.type}:${Object.entries(card.props).map(([k, v]) => `${k}="${v}"`).join(',')}]`
                            }}
                            rendererProps={{
                              messages,
                              setMessages,
                              firebaseUser,
                              getToken,
                              saveMessagesToFirestore: async (msgs: any[], userId: string) => {
                                // For onboarding, we don't need to save messages to Firestore
                                console.log('📝 Onboarding: Skipping message save to Firestore');
                              }
                            }}
                          />
                        </View>
                      );
                    });
                  })()}

                  {/* Show error message for failed AI responses (from CoachingScreen) */}
                  {message.role === 'assistant' && message.isError && (
                    <ErrorMessage
                      onRetry={() => handleRetryMessage(message.id)}
                      colorScheme={colorScheme}
                      isRetrying={retryingMessageId === message.id}
                    />
                  )}
                </View>

                                {/* AI Chat Popup */}
                {message.role === 'assistant' && showPopupForMessage === message.id && (
                  <View style={[
                    styles.aiPopup,
                    {
                      backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
                      borderColor: colorScheme === 'dark' ? '#333' : '#0000001A',
                    }
                  ]}>
                    <View style={styles.aiPopupContent}>
                      <Text style={[styles.aiPopupHeader, { color: colors.text }]}>
                        Accept suggested notifications?
                      </Text>
                      <Text style={[styles.aiPopupText, { color: `${colors.text}80` }]}>
                        Would you like to implement this notification schedule?
                      </Text>

                      <View style={styles.aiPopupButtons}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onPress={() => handlePopupAction('decline', message.id)}
                          style={{ flex: 1 }}
                        >
                          Decline
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onPress={() => handlePopupAction('accept', message.id)}
                          style={{ flex: 1 }}
                        >
                          Accept
                        </Button>
                      </View>
                    </View>
                  </View>
                )}

                {/* Scheduling Popup - appears when checkin cards are detected */}
                {message.role === 'assistant' && showSchedulingForMessage === message.id && (() => {
                  const coachingCards = parseCoachingCards(message.content);
                  const checkinCard = coachingCards.find(card => card.type === 'checkin');
                  const what = checkinCard?.props.what || 'your progress';
                  
                  return (
                    <View style={[
                      styles.aiPopup,
                      {
                        backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
                        borderColor: colorScheme === 'dark' ? '#333' : '#0000001A',
                      }
                    ]}>
                      <View style={styles.aiPopupContent}>
                        <Text style={[styles.aiPopupHeader, { color: colors.text }]}>
                          How often would you like check-ins?
                        </Text>
                        <Text style={[styles.aiPopupText, { color: `${colors.text}80` }]}>
                          Choose a frequency for check-ins about {what}
                        </Text>

                        {/* Frequency Toggle Options */}
                        <View style={[styles.aiPopupButtons, { flexDirection: 'column', gap: 8, marginBottom: 8 }]}>
                          <Button
                            variant={selectedFrequency === 'daily' ? 'primary' : 'secondary'}
                            size="sm"
                            onPress={() => handleSchedulingAction('toggle-frequency', message.id, 'daily')}
                            style={{ width: '100%' }}
                          >
                            Daily
                          </Button>
                          <Button
                            variant={selectedFrequency === 'once a week' ? 'primary' : 'secondary'}
                            size="sm"
                            onPress={() => handleSchedulingAction('toggle-frequency', message.id, 'once a week')}
                            style={{ width: '100%' }}
                          >
                            Once a week
                          </Button>
                          <Button
                            variant={selectedFrequency === 'couple times a week' ? 'primary' : 'secondary'}
                            size="sm"
                            onPress={() => handleSchedulingAction('toggle-frequency', message.id, 'couple times a week')}
                            style={{ width: '100%' }}
                          >
                            Couple times a week
                          </Button>
                        </View>

                        {/* Action Buttons */}
                        <View style={styles.aiPopupButtons}>
                          <Button
                            variant="primary"
                            size="sm"
                            onPress={() => handleSchedulingAction('confirm', message.id)}
                            style={{ width: '100%' }}
                          >
                            Confirm
                          </Button>
                        </View>
                      </View>
                    </View>
                  );
                })()}

                {/* Confirmed Scheduling Popup - appears after user confirms */}
                {message.role === 'assistant' && confirmedSchedulingForMessage === message.id && (() => {
                  return (
                    <View style={[
                      styles.aiPopup,
                      {
                        backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#FFFFFF',
                        borderColor: colorScheme === 'dark' ? '#333' : '#0000001A',
                      }
                    ]}>
                      <View style={styles.aiPopupContent}>
                        <Text style={[styles.aiPopupHeader, { color: colors.text }]}>
                          Check-in schedule confirmed
                        </Text>
                        <Text style={[styles.aiPopupText, { color: `${colors.text}80` }]}>
                          You'll receive {selectedFrequency} reminders to help you stay on track.
                        </Text>

                        {/* Confirmed Button */}
                        <View style={styles.aiPopupButtons}>
                          <Button
                            variant="secondary"
                            size="sm"
                            onPress={() => {}} // No action needed, disabled state
                            style={{ width: '100%', opacity: 0.6 }}
                            disabled={true}
                          >
                            Confirmed
                          </Button>
                        </View>
                      </View>
                    </View>
                  );
                })()}

                {/* Completion is now handled by sessionEnd card directly in the message */}
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
                    : containerHeight + 80, // When keyboard closed: less space since no navbar (was 140)
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
          bottom: keyboardHeight > 0 ? keyboardHeight - 10 : 20, // If keyboard open: slightly overlapping, otherwise 20px from bottom (no navbar)
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
                // Enhanced shadow for both light and dark modes - all directions
                shadowColor: colorScheme === 'dark' ? '#FFFFFF' : '#000000',
                shadowOffset: {
                  width: 0,
                  height: 0, // Centered shadow for all directions
                },
                shadowOpacity: colorScheme === 'dark' ? 0.2 : 0.3,
                shadowRadius: colorScheme === 'dark' ? 12 : 15,
                elevation: colorScheme === 'dark' ? 12 : 15,
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
                  placeholder="Share whats on your mind..."
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
                    onPress={isLoading ? () => {} : handleSendMessage}
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
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  chatHeaderText: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'left',
  },
  chatProgressText: {
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
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
    // Shadow properties are now set dynamically based on theme
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
  recordingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingTop: 8,
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
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transcribingInputContainer: {
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingLeft: 4,
  },
  // Removed - using imported components
  recordingVisualizer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recordingTimer: {
    fontSize: 14,
    fontWeight: '500',
  },
  bottomSection: {
    backgroundColor: 'transparent',
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
  expandIndicator: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'left',
  },
});